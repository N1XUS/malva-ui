# Library: swipe-actions

> **Keep this file up to date.** Update this file whenever you change any component, directive, public API, template, styling, or dependency wiring in this library.

## Overview

`@malva-ui/core/swipe-actions` provides **iOS-style swipe-to-reveal actions** for a list row: `mlv-swipe-actions` wraps the row's content and any number of `[mlvSwipeAction]` elements on either inline edge — bare `<button>`s painted as full-height tone blocks, or (`appearance="plain"`) any control that paints itself: `button[mlvButton]`, `mlv-switch`, `mlv-icon-toggle`. Closes #162.

The mechanism is deliberately not a JavaScript drag. The host is a horizontal **CSS scroll-snap container** with a hidden scrollbar, whose three snap stops are `[start actions][content][end actions]`. The browser's own scrolling drives the gesture — momentum, rubber-banding, axis locking against the vertical list, trackpad and Shift+wheel on a desktop, and a focused action scrolling itself into view for keyboard users — with no JavaScript running per frame. Inside each side the actions are `position: sticky` against the edge they reveal from, constrained to their own slot: while the side is only partly scrolled in every action pins to the row's edge and the later ones paint over the earlier, so the **outermost action is the hero**, then each slides out from beneath the next as the slot comes fully into view. That is the stacked fan-out with no per-action measurement, no equal-width assumption and no `perspective` (Taiga's `tui-swipe-actions` needs both, plus a `ResizeObserver` on its actions; this row observes only its start slot — see _Design notes_).

- **Leaf project (Nx):** `core-swipe-actions` at `libs/core/swipe-actions`
- **Secondary entry point:** `@malva-ui/core/swipe-actions` (also re-exported from the grouped `@malva-ui/core` barrel)
- **Package tag:** `scope:ui`

## Public API

Exported from `libs/core/swipe-actions/src/index.ts`:

| Symbol                     | Kind      | Selector            | Description                                                                      |
| -------------------------- | --------- | ------------------- | -------------------------------------------------------------------------------- |
| `MlvSwipeActions`          | Component | `mlv-swipe-actions` | The row: scroll-snap container, settled-side model, open/close/peek API.         |
| `MlvSwipeAction`           | Directive | `[mlvSwipeAction]`  | One action: a tone-filled block, or a plain host; closes the row when activated. |
| `MlvSwipeActionsSide`      | Type      | —                   | `'start' \| 'end'` — a logical inline edge.                                      |
| `MlvSwipeActionTone`       | Type      | —                   | `MlvTone \| 'neutral' \| 'accent'`.                                              |
| `MlvSwipeActionAppearance` | Type      | —                   | `'block' \| 'plain'`.                                                            |
| `MLV_SWIPE_ACTIONS`        | Token     | —                   | `InjectionToken<MlvSwipeActionsHost>` — how an action reaches its row.           |
| `MlvSwipeActionsHost`      | Interface | —                   | `{ close(): void }` — what the row provides under `MLV_SWIPE_ACTIONS`.           |

`MlvSwipeActionsCoordinator` (`swipe-actions-coordinator.ts`, `providedIn: 'root'`) is internal and **not** in the barrel.

## Components

### `MlvSwipeActions` — `mlv-swipe-actions`

- **Change detection:** `OnPush` · **Encapsulation:** `None`
- **Template** (inline): three slots in DOM order —
  `.mlv-swipe-actions__start` ← `<ng-content select="[mlvSwipeAction][side=start]" />`,
  `.mlv-swipe-actions__content` ← `<ng-content />`,
  `.mlv-swipe-actions__end` ← `<ng-content select="[mlvSwipeAction]" />`.
  Projection is static, so `side` must be a literal attribute; an `[side]` binding is a template error (the directive declares no such input), never a silently misplaced action.
- **Providers:** `MLV_SWIPE_ACTIONS` → itself.

#### Inputs / Model

| Name       | Type                                 | Default | Description                                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opened`   | `model<MlvSwipeActionsSide \| null>` | `null`  | Two-way: the **settled** side. Updates once a scroll comes to rest (`scrollend`, or a debounced `scroll` where the browser lacks it), never mid-gesture. Writing it scrolls the row there — smoothly, or instantly under `prefers-reduced-motion`. `openedChange` is the derived output. |
| `disabled` | `boolean` (coerced)                  | `false` | Locks the row on its content: `overflow-x: hidden`, an open row is closed, `open()` / `peek()` are ignored. Actions stay in the DOM and the accessibility tree.                                                                                                                          |
| `hint`     | `boolean` (coerced)                  | `false` | Plays `peek('end')` once, the first time the row is positioned. Never under `prefers-reduced-motion`, never when the end side is empty, at most once per instance. Meant for the first row of a list.                                                                                    |

#### Methods

| Method                                  | Description                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `open(side: MlvSwipeActionsSide): void` | Scrolls to `side`. Ignored while `disabled`. `opened` follows on settle.                                                                                                                   |
| `close(): void`                         | Scrolls back onto the content. A no-op while already resting there (so `disabled` toggling, coordinator hand-offs and action clicks never emit a spurious scroll). Cancels a pending peek. |
| `peek(side = 'end'): void`              | Reveals `side` and slides back after ~900 ms. No-op while `disabled`, when that side has no actions, or under `prefers-reduced-motion` (a jump would teach nothing).                       |

`contains(target)` (`@internal`, not in the extracted API) is the coordinator's hook — whether a node is inside the row.

#### Host bindings

```ts
host: {
  class: 'mlv-swipe-actions',
  '[class.mlv-swipe-actions--ready]': '_ready()',        // start slot measured, row positioned
  '[class.mlv-swipe-actions--displaced]': '_displaced()', // offset ≠ closed offset (from the first pixel)
  '[class.mlv-swipe-actions--open]': 'opened() !== null', // settled on a side
  '[class.mlv-swipe-actions--disabled]': 'disabled()',
  '(keydown.escape)': '_onEscape($event)',
}
```

#### Behaviour

- **Closed offset.** The row rests on its content at a logical scroll offset equal to the start slot's width (`0` with no start actions). A `MlvResizeObserverService` subscription on the start slot keeps it current (late fonts, actions added later). The first report flips `_ready`, which puts the slot back in flow; the render effect then writes `scrollLeft` before the frame paints. Until then the stylesheet keeps the slot `position: absolute; visibility: hidden`, so **server-rendered markup shows the content at offset zero**, not the start actions.
- **Scroll listeners** are `fromEvent` streams (passive), not `(scroll)` host bindings: a template binding would notify the change-detection scheduler on every event of a momentum scroll; these write one boolean signal (`_displaced`) that changes twice per gesture. `scrollend` is always listened to; where `'onscrollend' in element` is false a `debounceTime(120)` on `scroll` stands in.
- **Settle → model.** On settle the side is derived from `offset − closedOffset` (`< −0.5` start, `> 0.5` end, else `null`) and written to `opened`. The model→scroll `afterRenderEffect` starts a scroll only when the **model itself changed** (it tracks the previous `opened` value) **and** the new value differs from `_knownSide` — the side the row rests on **or is scrolling towards**, written by every settle and by every scroll the component starts. So its own echo is a no-op, a consumer write that lands while the previous one is still in flight is honoured, and a run of the effect caused by anything else never steers a scroll that `open()` / `peek()` started while the model still reads the previous side.
- **Closed offset moves.** `_displaced` is derived against the closed offset, and a row that becomes closed because that offset moved under it (the start slot resized to where the row already rests) fires no scroll event. The same effect therefore, whenever the closed offset changes: re-aligns a row resting on its content instantly (`_knownSide === null` and not displaced — an open row, or one scrolling somewhere, keeps its position); re-derives the displaced state; and re-settles (`opened` → `null`, coordinator released) **only a row at rest** — `_isAtKnownSide()`, read from the geometry rather than kept as a flag — because mid-flight the model would report a side the row is merely passing through, and `scrollend` settles it anyway. Accepted edge: a start slot that resizes _during_ a closing scroll lands the row at the old closed offset, and that settle reports a side.
- **RTL.** `scrollLeft` is physical and runs negative through an RTL scroller; `_logicalOffset()` / `_physicalOffset()` convert once at the boundary using `MlvRtlService.elementDirection(host)`, so a scoped `[dir]` works. Everything else is logical CSS.
- **Coordinator.** On the first displaced pixel the row calls `MlvSwipeActionsCoordinator.activate(this)`, which closes the previously active row (iOS: starting to swipe another cell dismisses the open one) and attaches **one** document `pointerdown` (capture, passive) + `focusin` listener pair; a press or a focus move outside the active row closes it. `release()` on returning to the closed offset or on destroy drops the listeners. Nothing is attached while every row is closed, however many rows a list renders.
- **Escape** closes the row and moves focus to the first tabbable element of the content (`MlvTabbableElementService`), so focus never stays on an action that just slid out of view; with nothing to focus, a focused action is blurred. The event is consumed (`stopPropagation`) **only when the row acted on it** — an Escape on a resting row still reaches an enclosing `mlv-drawer` or dialog, while one that closed the row does not also close the overlay.
- **`overscroll-behavior-x`** is `none` while closed (no rubber-band at the content edge, no chaining into an outer scroller or a browser navigation gesture) and `contain` while displaced (the local bounce at a fully revealed side is natural).

### `MlvSwipeAction` — `[mlvSwipeAction]`

Directive (no template). Any host. On a bare `<button>` it paints the iOS block (`appearance="block"`, the default); on a host that paints itself — `button[mlvButton]`, `mlv-switch`, `mlv-icon-toggle` — `appearance="plain"` adds no chrome and only places the element on the row. **The host must be interactive on its own**: the directive adds no role, tabindex or key handling, so a `<span mlvSwipeAction>` is pointer-only. Use a `<button>` or a component that handles its keys.

| Name              | Type                              | Default     | Description                                                                                                                                                     |
| ----------------- | --------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tone`            | `MlvSwipeActionTone \| undefined` | `undefined` | Fill of a `block` action: `neutral` (default), `accent`, `info`, `success`, `warning`, `danger` → `mlv-swipe-action--tone-<tone>`. A `plain` action ignores it. |
| `appearance`      | `MlvSwipeActionAppearance`        | `'block'`   | `block`: full-height tone-filled block, icon above label. `plain`: the host's own look, centred on the row. → `mlv-swipe-action--block` / `--plain`.            |
| `closeOnActivate` | `boolean` (coerced)               | `true`      | Whether activating the action closes the row. `false` for a control whose state lives on the row (a switch, a rating), so it stays open after each change.      |

- `side="start"` is a **static attribute**, read by the row's projection, not an input.
- Native `type` defaults to `"button"` **on a `<button>` host** through a `HostAttributeToken` (an explicit static `type` wins), so a row inside a `<form>` never submits on activation; any other host gets no `type` attribute.
- `(click)` → `MLV_SWIPE_ACTIONS.close()` when `closeOnActivate` (optional injection; standalone use is styling only). A directive host listener runs **before** the template's `(click)` on the same element, so this only starts the closing scroll; since `opened` changes on settle, the consumer's handler still observes the open side.

## Accessibility

- **Inside a list the row is the list item** — `<mlv-swipe-actions role="listitem">`. The host and its content slot carry no role, no tabindex and no global ARIA attribute, so per ARIA 1.2 (_Required Owned Elements_) they are generic intermediates and a `listitem` projected as content _would_ still find its `list` ancestor; but the actions sit beside the content, and a list may own nothing but items — axe's `aria-required-children` collects focusable descendants through generics and reports the buttons as children the list does not allow. With `mlv-list`, the projected `mlv-list-item` steps down to `itemRole="none"` so the row is the only item (docs example 1; nested `listitem`s fail `aria-required-parent` instead); a plain content `<div>` needs nothing (examples 2 and 6). The spec runs axe on the whole `role="list"` fixture and pins the reason: with the role moved off the row onto the content, `aria-required-children` fires with the three actions as related nodes.
- An empty state (`@empty` / `@else` copy) sits **outside** the list, not inside `role="list"`.
- Actions are real `<button>`s (or self-handling components) and stay in the accessibility tree while hidden off-screen — screen-reader users reach them directly, without the gesture. Icon-only actions need an `aria-label`; projected `<svg>`s should be `aria-hidden="true"`. The cost: every action is a tab stop — a 50-row inbox with three actions each is ~150 stops between the list and whatever follows it; Tab into an action scrolls it into view and the previous row closes on `focusin`, so the order stays legible.
- Keyboard: Tab into an action scrolls it into view (native); Escape closes and returns focus into the content; `focusin` outside closes.
- Focus ring: Form B (inset) — the row clips its overflow.
- `axe-core` runs in the spec on the projected markup (`button-name`, `nested-interactive`, ARIA attribute rules).

## Styling

BEM block `.mlv-swipe-actions` (host, `__start`, `__content`, `__end`, modifiers `--ready`, `--displaced`, `--open`, `--disabled`) and `.mlv-swipe-action` (`--block` / `--plain`, `--tone-*`). Everything inside `@layer mlv.components`; `mixins.reduced-motion` on both blocks.

Row-level custom properties (declare on `mlv-swipe-actions` or any ancestor):

| Property                          | Default  | Effect                                                                                                                                                                                            |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mlv-swipe-actions-action-size` | `4.5rem` | `min-inline-size` of one `block` action (iOS uses 74pt).                                                                                                                                          |
| `--mlv-swipe-actions-gap`         | `0`      | `gap` between the actions of one side.                                                                                                                                                            |
| `--mlv-swipe-actions-inset`       | `0`      | Distance from the row's edge: `padding-inline` on the slot **and** the sticky `inset-inline-*` of each action, so the stack sits the same distance off the edge while sliding in and once landed. |

- Host: `display: flex; overflow-x: scroll; overflow-y: hidden; scroll-snap-type: x mandatory; scrollbar-width: none` (+ `::-webkit-scrollbar { display: none }`).
- `__content`: `flex: 0 0 100%; scroll-snap-align: start; scroll-snap-stop: always` — a flick from one side never skips the content and lands on the other.
- `__start`: `scroll-snap-align: start`; `__end`: `scroll-snap-align: end` — each side's target is exact, not reliant on the browser clamping an out-of-range snap position.
- `__start` / `__end`: `display: flex; gap: var(--mlv-swipe-actions-gap); padding-inline: var(--mlv-swipe-actions-inset)`; an `:empty` side drops the padding so it never becomes a phantom snap stop (an empty start slot would otherwise measure `2 × inset` and shift the closed offset).
- The bare `.mlv-swipe-action` selector **emits no rule** (spec-enforced) — the directive also decorates hosts that paint themselves. Placement is **slot-scoped**: `.mlv-swipe-actions__end > .mlv-swipe-action { position: sticky; flex: 0 0 auto; inset-inline-end: var(--mlv-swipe-actions-inset) }` and the `__start` mirror with `inset-inline-start`. At (0,2,0) it beats the `position` a self-painting host declares for itself at (0,1,0) in the same layer (`.mlv-switch { position: relative }`); a bare (0,1,0) rule would win or lose by stylesheet load order alone. On the start side the paint order is reversed with `z-index` for the first `$stack-depth` (8) children (`nth-child(i) → 9 − i`), keeping the outermost action on top on both sides; children past that depth paint in document order again (inner over outer).
- `--plain`: `align-self: center` and nothing else.
- `--block` (all the chrome, `mixins.base` included): `min-inline-size: var(--mlv-swipe-actions-action-size)`, column inline-flex (icon above label), `gap: --mlv-spacing-1`, `padding: --mlv-padding-xs`, `body-s` type, solid fill from the tone map (`--mlv-background-<tone>-1` / `-hover` / `-active`, `--mlv-text-on-<tone>`; neutral → `--mlv-background-neutral-1` + `--mlv-text-primary`; accent → `--mlv-background-accent-1` + `--mlv-text-primary-on-accent-1`), no radius, `transition: background-color --mlv-duration-fast`, Form B focus ring, `:disabled` surface (`--mlv-background-disabled` fill for rest / hover / press + `--mlv-text-disabled`, #366). A plain host keeps its own hover / focus / disabled styling.
- No physical inline property anywhere (spec-enforced); `overscroll-behavior-x` toggles through `--displaced`; `--disabled` → `overflow-x: hidden`.

## Design notes (vs Taiga UI `tui-swipe-actions`)

| Concern               | Taiga                                                                                                                                                                                    | Malva                                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gesture               | CSS scroll-snap                                                                                                                                                                          | Same — the right call; kept.                                                                                                                                                                                               |
| Stacked reveal        | `perspective: 1px` + per-`nth-child` `translateZ`/`scale` maths, needs equal-width actions, a `ResizeObserver` for `--t-actions-width`, and a Safari `translateZ(-0.00001px)` workaround | `position: sticky` against the revealing edge — no measurement of the actions, any widths, mirrors through the logical inset, compositor-driven. One `ResizeObserver` per row, on the start slot only (the closed offset). |
| Action hosts          | `<button tuiSwipeAction>` blocks; the docs' icon-button and custom-control demos style them by hand                                                                                      | `appearance="plain"` on any self-painting host (`mlvButton` circles, `mlv-switch`), `closeOnActivate="false"`, row-level `--mlv-swipe-actions-gap` / `-inset`.                                                             |
| Sides                 | Trailing only                                                                                                                                                                            | Both (`side="start"`), with a hydration-safe initial offset.                                                                                                                                                               |
| Pointer: fine devices | Actions `display: none` under `@media (hover)` — desktop users get nothing                                                                                                               | Kept: trackpad / Shift+wheel / Tab reveal; `open()` for an explicit affordance.                                                                                                                                            |
| Outside close         | `autoClose` directive: `document:pointerdown` + `document:focusin` **per row**                                                                                                           | One root coordinator, listeners attached only while a row is open; also closes the previous row when another starts moving.                                                                                                |
| Action activation     | Row stays open                                                                                                                                                                           | Closes the row (iOS).                                                                                                                                                                                                      |
| Onboarding            | `onboarding` directive: 3 chained keyframes on every child + `scroll-snap-type: none` toggle                                                                                             | `peek()` / `hint`: two `scrollTo` calls; reduced motion skips it.                                                                                                                                                          |
| State                 | none                                                                                                                                                                                     | `[(opened)]` settled-side model, `--open` / `--displaced` classes, Escape.                                                                                                                                                 |

Deferred (follow-up): full-swipe commit of the edge action (`performsFirstActionWithFullSwipe`).

## Usage

```html
<!-- Plain hosts: a fanned-out row of icon buttons and a switch that keeps the row open. -->
<mlv-swipe-actions class="card" style="--mlv-swipe-actions-gap: 0.5rem; --mlv-swipe-actions-inset: 0.75rem">
  <div class="card__body">…</div>
  <mlv-switch mlvSwipeAction appearance="plain" closeOnActivate="false" [(checked)]="muted" ariaLabel="Mute" />
  <button mlvSwipeAction appearance="plain" mlvButton shape="circle" variant="error" aria-label="Delete" (click)="remove()">
    <svg lucideTrash2 [size]="18" aria-hidden="true" />
  </button>
</mlv-swipe-actions>

<!-- Inside a list the row is the list item; the projected mlv-list-item steps down to a plain box. -->
<mlv-list>
  <mlv-swipe-actions role="listitem" [(opened)]="side" [hint]="first">
    <button mlvSwipeAction side="start" tone="success" (click)="archive(item)">
      <svg lucideArchive [size]="20" aria-hidden="true" />
      Archive
    </button>

    <mlv-list-item itemRole="none">
      <span mlvListItemTitle>{{ item.title }}</span>
    </mlv-list-item>

    <button mlvSwipeAction (click)="more(item)">
      <svg lucideEllipsis [size]="20" aria-hidden="true" />
      More
    </button>
    <button mlvSwipeAction tone="danger" (click)="remove(item)">
      <svg lucideTrash2 [size]="20" aria-hidden="true" />
      Delete
    </button>
  </mlv-swipe-actions>
</mlv-list>
```

```ts
import { MlvSwipeAction, MlvSwipeActions } from '@malva-ui/core/swipe-actions';

@Component({ imports: [MlvSwipeActions, MlvSwipeAction] })
```

## Dependencies

- `@angular/cdk/coercion` — `BooleanInput`, `coerceBooleanProperty`
- `@angular/core` — `ElementRef`, `HostAttributeToken` (the directive reads its host's tag name and static `type`)
- `@angular/core/rxjs-interop` — `takeUntilDestroyed`
- `@malva-ui/cdk/accessibility` — `MlvTabbableElementService`
- `@malva-ui/cdk/utils` — `MlvRtlService`, `MlvResizeObserverService`, `MlvTone` (type)
- `rxjs` — `fromEvent`, `merge`, `debounceTime`, `timer`, `EMPTY`
- Malva UI CSS design tokens (`--mlv-*`)

## Tests

`swipe-actions.spec.ts` (53): projection by static side / content routing / DOM order; axe on the whole `role="list"` fixture with the row as `listitem`, plus the negative — role moved onto the content → `aria-required-children` with the three actions as related nodes; initial position (not ready before measurement, rests at the start width, re-aligns on resize while closed, re-derives displaced + re-settles when the closed offset moves onto the current position, leaves an open row alone, mirrored offset in RTL); scroll-driven state (`--displaced` from the first pixel, settle → `'end'` / `'start'` / `null` and `opened` emissions, negative `scrollLeft` in RTL, the debounced fallback in a window without `onscrollend`); programmatic control (`open` targets, `close`, a consumer write landing mid-scroll, an imperative `open()` kept on course when the closed offset moves mid-flight, no settle reported while a scroll the row started is in flight, echo suppression, RTL targets, reduced-motion `'instant'`, `peek` open → hold → close, no peek under reduced motion); `hint` once; closing interactions (action click still runs the consumer handler, Escape + focus hand-off, Escape consumed only when it acted, outside press, inside press stays, focus-out, listener dropped once closed); disabled (class + close, ignored open/peek); the coordinator (previous row closes when another starts moving, exactly one `pointerdown` + `focusin` pair added/removed across two rows, released on destroy); and compiled-CSS assertions (snap container, `overscroll-behavior` toggle, snap alignment/stop, slot-scoped sticky + flex + inset logical pins, start-side paint order, no rule on the bare action selector / chrome under `--block` / `--plain` centring / gap + inset custom properties, pre-ready start slot, disabled overflow, no physical inline property, reduced-motion media rule).

`swipe-action.spec.ts` (13): block + default tone class, every tone modifier, `--block` default vs `--plain`, `type="button"` default and explicit-type precedence, no `type` on a non-button host, standalone click untouched; inside a row (a stub `MLV_SWIPE_ACTIONS`): closes on activation, `closeOnActivate="false"` keeps it open; on self-painting hosts (`@malva-ui/core/button`, `@malva-ui/core/switch` — spec-only imports): an `mlvButton` circle keeps its chrome, still gets `type="button"` and closes the row; an `mlv-switch` toggles through its native input without closing when `closeOnActivate="false"`, closes with the default, gets no `type`; axe on the composed hosts.

## Disabled surface (2026-09, #366)

- Block action `:disabled` was a 0.4 multiply that let the row bleed through the tone fill; now `--mlv-swipe-action-bg` / `-hover` / `-active: --mlv-background-disabled`, `--mlv-swipe-action-color: --mlv-text-disabled` at (0,2,0), above every tone. Label on fill (danger): light 1.95 → 3.76, dark 1.80 → 3.44.
- Spec: `swipe-actions-disabled-styles.spec.ts`.
- Guard: `styles:check-disabled-surface` (`scripts/check-disabled-surface.mjs`, a `styles:lint` dependency) fails any other disabled `opacity` and any `--state-success/warning/info` rule.
