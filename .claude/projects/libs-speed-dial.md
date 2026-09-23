# Library: speed-dial

> **Keep this file up to date.** Update this file whenever you change any component, directive, public API, template, styling, or dependency wiring in this library.

## Overview

`@malva-ui/core/speed-dial` provides a **floating action button that unfolds
into related actions** (`mlv-speed-dial`) — feature parity target: PrimeNG
SpeedDial. The trigger is a circular `button[mlvButton]`; the actions are
`button[mlvButton]`s laid out either in a line (`linear`) or on an arc
(`circle`, `semi-circle`, `quarter-circle`).

The actions render in a **CDK overlay centred on the trigger** (not inline),
so an `overflow: hidden` ancestor never clips them, `mask` is a real CDK
backdrop, and click-outside comes from the overlay. Actions enter and leave
with a per-item stagger that reverses on close.

- **Leaf project (Nx):** `core-speed-dial` at `libs/core/speed-dial`
- **Secondary entry point:** `@malva-ui/core/speed-dial` (also re-exported from the grouped `@malva-ui/core` barrel)
- **Package tag:** `scope:ui`

## Public API

Exported from `libs/core/speed-dial/src/index.ts`:

| Symbol                       | Kind      | Selector / shape                                                                                | Description                                                                         |
| ---------------------------- | --------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `MlvSpeedDial`               | Component | `mlv-speed-dial`                                                                                | Trigger + overlay-rendered actions.                                                 |
| `MlvSpeedDialItemDef`        | Directive | `[mlvSpeedDialItemDef]`                                                                         | Structural: custom content for every action button; context `{ $implicit, index }`. |
| `MlvSpeedDialTriggerIcon`    | Directive | `[mlvSpeedDialTriggerIcon]`                                                                     | Marker: projected element replaces the default `lucidePlus` "open" glyph.           |
| `MlvSpeedDialItem`           | Interface | `{ id?, icon?, label, disabled?, command? }`                                                    | One action.                                                                         |
| `MlvSpeedDialItemEvent`      | Interface | `{ item, index, originalEvent }`                                                                | Payload of `itemSelect` and of an item's `command`.                                 |
| `MlvSpeedDialItemDefContext` | Interface | `{ $implicit, index }`                                                                          | Template context of `[mlvSpeedDialItemDef]`.                                        |
| `MlvSpeedDialType`           | Type      | `'linear' \| 'circle' \| 'semi-circle' \| 'quarter-circle'`                                     | Layout.                                                                             |
| `MlvSpeedDialDirection`      | Type      | `'up' \| 'down' \| 'left' \| 'right' \| 'up-left' \| 'up-right' \| 'down-left' \| 'down-right'` | Unfold direction.                                                                   |
| `MlvSpeedDialTriggerType`    | Type      | `'click' \| 'hover' \| 'focus'`                                                                 | What opens the dial (same vocabulary as `[mlvPopupTrigger]`'s `triggerOn`).         |

## Component

### `MlvSpeedDial` — `mlv-speed-dial`

- **Change detection:** `OnPush` · **Encapsulation:** `None`
- **Template:** `speed-dial.html` — the trigger `button[mlvButton]` in place,
  plus an `ng-template #panelTemplate` that is portaled to the CDK overlay
  while open (`div.mlv-speed-dial__panel > ul[role=menu].mlv-speed-dial__list > li.mlv-speed-dial__item > button[mlvButton][role=menuitem].mlv-speed-dial__action`).
- **Imports:** `NgTemplateOutlet`, `MlvButton`, `MlvTooltip`, `LucidePlus`, `LucideX`, `LucideDynamicIcon`

#### Inputs

| Name               | Type                                                            | Default       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`            | `readonly MlvSpeedDialItem[]` (required)                        | —             | The actions, in reading order.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `type`             | `MlvSpeedDialType`                                              | `'linear'`    | Layout of the actions around the trigger.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `triggerOn`        | `MlvSpeedDialTriggerType \| readonly MlvSpeedDialTriggerType[]` | `'click'`     | One type or several, like `[mlvPopupTrigger]`. The trigger's click (pointer or Enter/Space) **always** toggles so the menu button stays keyboard/touch-operable; the others add openers. `'hover'`: opens on a mouse/pen `pointerenter` of the trigger, closes 200 ms (`HOVER_CLOSE_DELAY_MS`) after the pointer has left both the trigger and the actions (re-entering either cancels), touch pointers ignored, focus never moves, a trigger click cancels a pending hover close. `'focus'`: opens on `focusin` of the trigger (focus stays there), closes on a `focusout` whose `relatedTarget` is outside both the host and the overlay. |
| `direction`        | `MlvSpeedDialDirection`                                         | `'up'`        | Where the actions unfold. Cardinal values drive `linear`/`semi-circle`; corner values drive `quarter-circle`. A cardinal value on a quarter-circle resolves to a corner (`up`/`right` → `up-right`, `down` → `down-right`, `left` → `up-left`); a corner on linear/semi resolves to its vertical half. **Logical:** `left` is inline-start — under RTL (`dir="rtl"` ancestor or `MlvRtlService`) `left`/`right` and the corners are mirrored; `up`/`down` never change.                                                                                                                                                                     |
| `radius`           | `number`                                                        | `80`          | Px from the trigger's centre to each action's centre (radial layouts only; `linear` uses the density gap).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `transitionDelay`  | `number`                                                        | `30`          | Stagger in ms between consecutive actions. Reversed on close (farthest leaves first). `0` moves everything at once; `prefers-reduced-motion` drops it entirely.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `mask`             | `boolean` (coerced)                                             | `false`       | CDK backdrop (`.mlv-speed-dial__backdrop`, `--mlv-background-overlay`) behind the open dial; closes on click. The host gets `mlv-speed-dial--masked` (`z-index: var(--mlv-z-max)`) so the trigger stays above the mask — an ancestor stacking context defeats that lift.                                                                                                                                                                                                                                                                                                                                                                    |
| `disabled`         | `boolean` (coerced)                                             | `false`       | Native `disabled` on the trigger; closes the dial if open; `open()`/`opened=true` become no-ops.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `ariaLabel`        | `string \| undefined`                                           | `undefined`   | Accessible name of the trigger. Consumers must supply this or `ariaLabelledby`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ariaLabelledby`   | `string \| undefined`                                           | `undefined`   | Id of the element labelling the trigger; wins over `ariaLabel`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `variant`          | `MlvButtonVariant`                                              | `'primary'`   | Trigger `mlv-button` variant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `itemVariant`      | `MlvButtonVariant`                                              | `'secondary'` | Action `mlv-button` variant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `showTooltips`     | `boolean` (coerced)                                             | `true`        | Shows each action's `label` as an `[mlvTooltip]` on hover/focus.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `tooltipPlacement` | `MlvTooltipPlacement \| undefined`                              | `undefined`   | Explicit tooltip side. Default: `left` for vertical linear layouts, `top` otherwise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `mlvDensity`       | `MlvDensity \| undefined`                                       | `undefined`   | Density for trigger and actions. Resolved once (`_density`: input → `MLV_DENSITY_CONTEXT` → `MlvDensityService`) and bound as `[mlvDensity]` on the trigger **and every action** — the actions are portaled out of the page cascade and `MlvButton` stamps its own `mlv-button--{density}`, so an ancestor class alone would not reach them. The same value is stamped as `mlv--{density}` on the panel for the list geometry.                                                                                                                                                                                                              |

#### Model / outputs

| Name           | Kind             | Description                                                                                           |
| -------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `opened`       | `model<boolean>` | Two-way open state. Flips false immediately on close; the overlay detaches after the exit transition. |
| `openedChange` | `output`         | Model change output of `opened` — fires on every open/close, whatever triggered it.                   |
| `itemSelect`   | `output`         | `MlvSpeedDialItemEvent` after the item's `command` ran, before the dial closes.                       |

#### Public methods

| Method     | Description                                    |
| ---------- | ---------------------------------------------- |
| `open()`   | Opens unless `disabled`.                       |
| `close()`  | Closes.                                        |
| `toggle()` | Toggles; a closed, disabled dial stays closed. |

#### Host bindings

```ts
host: {
  class: 'mlv-speed-dial',
  '[class.mlv-speed-dial--open]': 'opened()',
  '[class.mlv-speed-dial--masked]': '_overlayAttached() && mask()',
  '[class.mlv-speed-dial--disabled]': 'disabled()',
}
```

Hover/focus listeners are deliberately **not** host bindings — see "Listener registration" below.

`--open` and `--disabled` carry no rules of their own — they are consumer styling hooks. `--masked` lifts the host (`z-index: var(--mlv-z-max)`) and is tied to the overlay being **attached** (`_overlayAttached`), not to `opened()`, so the trigger stays above the backdrop through the exit transition — otherwise the lingering backdrop would dim the trigger mid-fade and would have swallowed the pointer coming back (hover) or the next click before #272 made a fading mask `pointer-events: none`.

## Behaviour

### Overlay lifecycle

- `effect(opened, disabled)` → `_attach()` / `_scheduleDetach()`; `opened && disabled` resets `opened` to `false`. Browser-only (`isPlatformBrowser`) — SSR renders the trigger and nothing else.
- `_attach()`: `Overlay.create()` with a `flexibleConnectedTo(trigger)` strategy, one **centre-on-centre** position, `withPush(false)`, `withFlexibleDimensions(false)`, `withViewportMargin(0)`, `withLockedPosition()`, `reposition` scroll strategy; the pane is sized to the trigger's `getBoundingClientRect()` so the panel's centre **is** the trigger's centre. Direction is resolved from the trigger via `MlvRtlService`. `hasBackdrop: mask()`, `backdropClass: 'mlv-speed-dial__backdrop'`. After `attach(TemplatePortal)` the pane's `offsetWidth` is read once to flush the closed styles before `_panelOpen` flips true (otherwise the enter transition would not run).
- Close: `_panelOpen` flips false at once (exit transition starts, `aria-expanded` is already `false`), then `dispose()` after `transitionDelay × (n − 1) + 250 ms` (`CLOSE_SETTLE_MS` — `--mlv-duration-normal` plus slack for the CD pass and style flush before the transition starts) — `0 ms` under `prefers-reduced-motion`. Reopening during that window cancels the timer and reuses the attached overlay, unless `mask` changed meanwhile (`hasBackdrop` is fixed at creation), in which case the overlay is disposed and recreated. A pending keyboard focus request is dropped on close so it cannot leak into a later pointer open.
- Leaving actions are inert: during the settle window they are still rendered, clickable and possibly focused, but `_onItemClick` returns unless `_panelOpen()` — so a double-click's second click, or Enter on the action that kept focus, runs `command` / emits `itemSelect` once, not twice. The second click is absorbed by the leaving action (it does not reach the page); this is a TS check, not `pointer-events: none` on the items, because CSS would not stop the keyboard activation and would pass that click to whatever sits under a still-visible action.
- Mask fade (#272): CDK removes `cdk-overlay-backdrop-showing` only in `BackdropRef.detach()` (reached via `OverlayRef.detach()` and the public `OverlayRef.detachBackdrop()`); `dispose()` is a bare `element.remove()`, so the mask used to sit at full opacity for the whole exit and then vanish (the same cut in dialog, drawer and full-screen popup is #276). `_setBackdropShowing(showing)` toggles that class on `overlayRef.backdropElement` itself:
  - `false` in `_scheduleDetach()`, plus inline `pointer-events: none` (mirrors `BackdropRef.detach()`).
  - **Click-through while the mask fades (behaviour change):** from the moment the close starts until the overlay is disposed (`transitionDelay × (n − 1) + 250 ms`), a click on the dimmed area reaches the page underneath. Before #272 the mask swallowed it — e.g. in docs example 3, double-clicking the mask over a page button used to close the dial and swallow the second click; now the second click presses the button. CDK's own teardown behaves the same way.
  - `false` also registers one `requestAnimationFrame` that removes the class again if the dial is still closing and the backdrop is unchanged. CDK reveals a fresh backdrop from an uncancellable `requestAnimationFrame` in `_attachBackdrop()` (`@angular/cdk` 22.1.8 `_overlay-module-chunk.mjs:979-984`); frame callbacks run in registration order, so without the second removal a close in the same frame as the open (programmatic `opened` / `disabled` flip, a double-tap on a busy main thread) would be revealed to full opacity and cut at dispose.
  - `true` when `_attach()` reuses an overlay mid-fade; inline `pointer-events` cleared. A fresh attach needs nothing — CDK adds the class itself one frame later.
  - No-op without `mask` (`backdropElement` is `null`).
  - Never `OverlayRef.detachBackdrop()` for the leave: with animations on, `BackdropRef.detach()` schedules the element's removal on its next `transitionend` or a 500 ms fallback, and re-adding the class cancels neither. A new backdrop is only created by the private `_attachBackdrop()`, which runs from `attach()` — never on the reuse path — so the reopened dial would lose its mask moments later.
  - The fade is CDK's own `opacity 400ms cubic-bezier(0.25, 0.8, 0.25, 1)`, deliberately not shortened. It outlasts the shortest settle (250 ms) but eases out hard — measured in the docs app: 0.028–0.036 opacity left at 250 ms (< 0.8% black at the token's 0.22 alpha), ~0.018 at 280 ms, ~0.003 at 340 ms (4 actions, default delay).
  - Why not shortened: with CDK's runtime style loader the rule sits in `@layer cdk-overlay`, named after `mlv.*`, so it outranks `mlv.components`; `overlay-prebuilt.css` and the `cdk.overlay()` mixin emit it unlayered, which beats every layered rule. Either way only `!important` would win from here, and a layered `!important` also beats a consumer's unlayered override. (An app naming `cdk-overlay` before `mlv.*` flips the order, but nothing here can rely on it.) No `transition-delay` either — a delay past the settle would cut the fade outright.
  - Reduced motion: settle `0 ms`; the class comes off before the timer is scheduled; `mixins.reduced-motion` (`[class*=' mlv-speed-dial__']`) zeroes the backdrop's duration.
- Dismissal: `backdropClick` (mask), `outsidePointerEvents` (excluding the trigger, which toggles on its own click), overlay `keydownEvents` Escape (the single Escape handler — it covers focus on an action and on the trigger alike). Everything is torn down in `_disposeOverlay()` (also on `DestroyRef`).
- Known limit: the pane geometry is measured once at creation; a trigger that resizes while the dial is open (font swap, density change) is not re-measured until the next open.

### Layout & stagger (`_entries`)

- Every action gets `--mlv-stagger-index` = `index` while opening and `count − 1 − index` while closing; the panel carries `--mlv-speed-dial-stagger: {transitionDelay}ms` and `--mlv-speed-dial-radius: {radius}px`.
- **Direction resolution:** `_resolvedDirection` maps the logical `direction` input through the host's reading direction (`MlvRtlService.elementDirection(host)` — reacts to a global flip and to any `dir` attribute change) and mirrors the horizontal component under RTL (`left` ↔ `right`, `up-left` ↔ `up-right`, `down-left` ↔ `down-right`). Every layout computation below reads the resolved value; the CSS modifiers and radial angles stay physical.
- **Linear:** the list is a flex row/column hung off the panel edge facing the resolved direction (`mlv-speed-dial__list--linear-{up|down|left|right}`; `column-reverse`/`row-reverse` for up/left so the first item sits nearest the trigger).
- **Pane hit-testing:** the CDK pane (`.mlv-speed-dial__pane`) is centred exactly on top of the trigger, so it is `pointer-events: none` (the panel and list too); only `.mlv-speed-dial__item` opts back in. Without that the trigger's own second click would land on the pane and never close the dial.
- **Radial:** `mlv-speed-dial__list--radial`; each `li` is absolutely centred and gets `--mlv-speed-dial-item-x/y` = `calc(<cos|sin> * var(--mlv-speed-dial-radius))` (rounded to 4 decimals, `-0` → `0`). Angles: `circle` starts at −90° (12 o'clock) and steps `360 / n`; `semi-circle` arcs — up `[180, 360]`, down `[0, 180]`, left `[90, 270]`, right `[270, 450]`; `quarter-circle` arcs — up-left `[180, 270]`, up-right `[270, 360]`, down-left `[90, 180]`, down-right `[0, 90]`. Arc endpoints are inclusive; a single action sits at the arc midpoint.

### Hover and focus (`triggerOn`)

- `triggerOn` is normalised to a `Set` (`_triggers`); `_hasTrigger(type)` gates every handler below. `'click'` is not gated — `_onTriggerClick` always toggles.
- **Listener registration:** an `effect` keyed on `_triggers()` subscribes with rxjs `fromEvent` on the host (`_subscribeHostListeners`, browser only) — `pointerenter` for `'hover'`; `focusin`/`focusout`/`pointerdown` for `'focus'`; `pointerleave` for either — and unsubscribes on change/destroy via the effect's `onCleanup` (not `takeUntilDestroyed`, which would only fire at destroy and leak across a `triggerOn` change; see best-practices). A click-mode dial registers nothing. The point: an Angular template/host listener marks the view dirty and schedules a change-detection pass _before_ the handler runs, even when it early-returns; a `fromEvent` handler only triggers CD when it actually writes a signal. The subscriptions run `NgZone.runOutsideAngular` so a zone.js consumer app does not tick per boundary crossing either (signal writes still schedule CD). `_triggers` compares sets by content, so a fresh array bound on every CD pass does not churn listeners; the effect also resets `_pointerPressed`/`_focusJustOpened` on every trigger change. The overlay element gets `pointerenter`/`pointerleave`/`focusout` the same way in `_attach()` (torn down with the overlay through `_cleanups`); those handlers gate on the trigger types themselves, so a `triggerOn` change while open needs no re-registration.

- `pointerenter` / `pointerleave` are listened to on the host **and** on the overlay element — the panel is not a DOM descendant of the host, so the host's own leave fires when the pointer heads for an action. Leaving either starts a 200 ms timer (`_hoverCloseTimer`); entering either clears it. The panel is `pointer-events: none`, so its enter/leave fire on the items (ancestors receive `pointerenter` for a descendant hit-target) — crossing the empty space between actions leans on the grace period.
- Guard (`_hoverApplies`): `'hover'` listed, `pointerType !== 'touch'`, not `disabled`. `_onTriggerClick` clears the timer first, so a click while hover-open closes and stays closed until the pointer re-enters. The timer is cleared on destroy.
- When the timer fires it re-checks that `'hover'` is still listed (a flip to `click` during the grace period leaves the dial open), and if keyboard focus sits inside the overlay it goes through `_closeAndRefocus()` so focus lands on the trigger instead of `<body>`.
- Focus: `focusin` on the host (`_onFocusIn`) opens; `focusout` on the host **and** on the overlay element (`_onFocusOut`) closes unless `relatedTarget` is inside the host or the overlay (ArrowDown into the menu, moving between actions). `_closeAndRefocus()` sets `_suppressFocusOpen` around its `focus()` call — `focusin` fires synchronously inside `focus()` — so Escape / Tab / keyboard activation / hover close can park focus on the trigger without reopening it. `_focusJustOpened` is set by a focus-open that happens during a pointer press (`_pointerPressed`, from the host's `pointerdown`, cleared by `click` or `pointerleave`) and consumed by that press's `click`: Chrome and Windows browsers focus a button on `mousedown`, so `focusin` opens the dial before the `click` arrives, and that click must not toggle it shut again. A keyboard focus-open never sets the flag, so the next mouse click toggles normally. macOS Safari/Firefox do not focus a button on `mousedown`: there a pointer click never opens through `'focus'` — it opens through the always-on click toggle instead — and only Tab reaches the focus opener.

### Keyboard (WAI-ARIA menu button)

| Where   | Key                    | Effect                                                                                                                     |
| ------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Trigger | Enter / Space          | Native click → toggle. A keyboard activation (`click.detail === 0`) that opens also focuses the first action.              |
| Trigger | ArrowDown / ArrowUp    | Open (if closed) and focus the first / last enabled action.                                                                |
| Menu    | ArrowDown / ArrowRight | Next enabled action (wraps). ArrowRight/ArrowLeft swap under RTL.                                                          |
| Menu    | ArrowUp / ArrowLeft    | Previous enabled action (wraps).                                                                                           |
| Menu    | Home / End             | First / last enabled action.                                                                                               |
| Menu    | Escape                 | Close and refocus the trigger.                                                                                             |
| Menu    | Tab                    | Close and park focus on the trigger; not prevented, so the browser continues tabbing from the trigger's place in the page. |
| Action  | Enter / Space / click  | `command?.(event)` → `itemSelect.emit(event)` → close (keyboard also refocuses the trigger). Disabled actions are inert.   |

Focus targets are read from the live pane (`[role="menuitem"]:not(:disabled)`), not from view queries, so they are always current inside the attach effect.

## Accessibility

- Trigger: native `<button type="button">` with `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` (only while open), `aria-label` / `aria-labelledby` from the inputs. **Consumers must supply an accessible name.**
- Menu: `ul[role="menu"][tabindex="-1"]` labelled by the trigger (`aria-labelledby`); `li[role="none"]`; actions are `button[role="menuitem"][tabindex="-1"]` with `aria-label` = `label`, native `disabled` + `aria-disabled` (from `MlvButton`), and an `[mlvTooltip]` carrying the same label (`aria-describedby` while visible).
- Icons: the default trigger glyph, the close glyph (and its wrapper) and every action icon are `aria-hidden="true"`.
- Reduced motion: `mixins.reduced-motion` on the block (its `[class*=' mlv-speed-dial__']` selector also reaches the mask backdrop) plus an explicit `transition-delay: 0ms !important` on `.mlv-speed-dial__item`; the JS side skips the settle wait.

## Styling

`speed-dial.scss` — BEM block `.mlv-speed-dial`, all in `@layer mlv.components`. Because the panel lives in the overlay container, every panel rule is flat (`.mlv-speed-dial__panel`, never a descendant of the host).

- Trigger: `--mlv-shadow-floating`; actions: `--mlv-shadow-raised`. Both are plain `mlv-button` circles (variants via `variant` / `itemVariant`).
- `.mlv-speed-dial__item` closed: `opacity: 0; transform: scale(0.4)`; open (`.mlv-speed-dial__panel--open`): `opacity: 1; transform: scale(1)` — radial adds `translate(var(--mlv-speed-dial-item-x), var(--mlv-speed-dial-item-y))`. Transitions: `--mlv-duration-normal` with `--mlv-ease-out` (opacity) / `--mlv-ease-spring` (transform), `transition-delay: calc(var(--mlv-speed-dial-stagger, 30ms) * var(--mlv-stagger-index, 0))`.
- Trigger glyphs: `.mlv-speed-dial__trigger-icon` is an `inline-grid` stacking two `.mlv-speed-dial__trigger-glyph`s on one cell — `--open` (default `lucidePlus` or the projected `[mlvSpeedDialTriggerIcon]`) and `--close` (built-in `lucideX`, `aria-hidden`). Closed: the close glyph sits at `opacity: 0; transform: scale(0.85) rotate(-90deg)`. Open (`.mlv-speed-dial__trigger-icon--open`): the open glyph goes to `opacity: 0; scale(0.85) rotate(90deg)` and the close glyph to `opacity: 1; scale(1) rotate(0)`. Both transition `opacity` (`--mlv-ease-out`) and `transform` (`--mlv-ease-spring`) over `--mlv-duration-normal`; reduced motion swaps instantly. A glyph `svg` is sized from the button's `--mlv-icon-font-size` (the button's own `> svg:only-child` rule cannot reach this depth), so trigger and actions scale together across densities.
- `.mlv-speed-dial__backdrop`: `background-color: var(--mlv-background-overlay)` only — no `transition` / `transition-duration` / `transition-delay` / `transition-property` on any `__backdrop` rule, so CDK's 400 ms fade runs and a consumer's unlayered override still reaches it. The component drives the fade-out by toggling `cdk-overlay-backdrop-showing` (see _Overlay lifecycle → Mask fade_); the reduced-motion mixin's `[class*=' mlv-speed-dial__']` selector matches it.
- `.mlv-speed-dial--masked`: `z-index: var(--mlv-z-max)` (see `mask` above).

## Usage

```ts
import { MlvSpeedDial } from '@malva-ui/core/speed-dial';
import { LucidePencil, LucideTrash2, provideLucideIcons } from '@lucide/angular';

@Component({
  imports: [MlvSpeedDial],
  providers: [provideLucideIcons(LucidePencil, LucideTrash2)],
  template: `
    <mlv-speed-dial
      [items]="[
        { label: 'Edit', icon: 'pencil', command: edit },
        { label: 'Delete', icon: 'trash-2', command: remove },
      ]"
      type="semi-circle"
      direction="up"
      mask
      ariaLabel="Actions"
      (itemSelect)="log($event)"
    />
  `,
})
```

Item icons are Lucide **names** resolved at runtime through `LucideDynamicIcon`, so — exactly like `mlv-bottom-nav` and `mlv-tree` — the consumer registers them with `provideLucideIcons(...)`.

## Dependencies

- `@angular/cdk/overlay`, `@angular/cdk/portal`, `@angular/cdk/coercion`
- `@lucide/angular` (`LucidePlus`, `LucideX`, `LucideDynamicIcon`)
- `@malva-ui/core/button`, `@malva-ui/core/tooltip`
- `@malva-ui/cdk/utils` (`MlvRtlService`, `mlvNextId`), `@malva-ui/cdk/density`

## Testing

`speed-dial.spec.ts` (75 specs, jsdom + `OverlayContainer`): trigger ARIA and disabled handling; the two-glyph trigger icon (`--open` wrapper flag, close glyph present and hidden, projected icon lands in the open slot); open/close via click, model, click-outside, Escape (focus return), disabled-while-open; overlay detach after the settle window; action `command` / `itemSelect` / disabled inertness, a repeated click or keyboard activation on a leaving action running `command` and `itemSelect` once; projected trigger icon and item template (separate host — projection is resolved statically, so a conditionally projected slot still suppresses the `ng-content` fallback); listener registration (click mode adds no hover/focus listeners to the host; `hover` adds `pointerenter`/`pointerleave`, switching to `focus` removes them and adds `focusin`/`focusout`/`pointerdown`/`pointerleave`, a same-content array re-registers nothing, destroy removes the host listeners, overlay disposal removes the pane listeners, a press remembered under old trigger types is forgotten); hover mode (`triggerOn="hover"`: click mode ignores pointerenter, mouse enter opens without moving focus and leave closes after the grace period, moving onto the panel keeps it open, re-entering cancels, touch ignored, disabled ignored, click wins over a pending hover close, a mode flip during the grace period keeps it open, a focused action is refocused to the trigger, `--masked` outlives `opened()` until the backdrop is disposed); focus mode (`triggerOn="focus"`: click mode ignores focus, focus opens without entering the menu and blur to an outside element closes, focus moving into the actions keeps it open and Escape's refocus does not reopen, the click of the press that focused the trigger does not close it while a click after a keyboard focus-open does, `['hover', 'focus']` honours both); keyboard (trigger ArrowDown/ArrowUp, keyboard activation focusing the first action, wrapping arrows that skip disabled actions, Home/End, Tab not swallowed and parking focus on the trigger); reopen during the settle window, overlay recreation when `mask` changed meanwhile, initially-open first render, destroy-while-open; density on trigger, panel and actions; linear list classes and direction changes; circle / semi-circle / quarter-circle / single-item coordinates; RTL mirroring (`MlvRtlService.setRtl(true)` → `left` renders `--linear-right`, horizontal arrows swap, `up-left` lands in the up-right quadrant); stagger indices forward and reversed plus `--mlv-speed-dial-stagger`; mask backdrop presence, `--masked` host class and backdrop click; mask fade (#272: CDK reveals the backdrop a frame after open, the close removes `cdk-overlay-backdrop-showing` and sets `pointer-events: none` while the backdrop is still attached and disposes it after the settle, a reopen mid-fade restores the class on the **same** element and keeps it past a dispatched `transitionend` and the 500 ms fallback (the `detachBackdrop()` trap), a close in the same frame as the open stays hidden after CDK's reveal frame while a reopen in that same frame is still revealed, reduced motion removes the class and disposes at once, `mask` off closes without a backdrop). Stylesheet specs compile `speed-dial.scss` through Sass and assert the stagger `transition-delay`, the reduced-motion delay reset, the pane `pointer-events: none !important` / item `auto` pair, the trigger glyph crossfade states and the glyph `svg` sizing off `--mlv-icon-font-size`, the RTL `flex-direction` flips of the horizontal lists, the backdrop token, that no rule whose selector contains `__backdrop`, at any nesting depth, declares `transition` / `transition-duration` / `transition-delay` / `transition-property` (CDK's fade stays consumer-overridable and is never delayed past the settle), and that the reduced-motion mixin's `[class*=' mlv-speed-dial__']` rule zeroes the duration.

Icons in specs: `provideLucideIcons(LucidePlus, LucidePencil, LucideShare, LucideTrash)` in the TestBed providers — an unregistered `icon` name throws `Unable to resolve icon`.
