---

# Library: segmented

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, styling, testing, or public API changes.

## Overview

`@malva-ui/core/segmented` provides a segmented control: `mlv-segmented` (a grey, rounded track with a raised pill sliding behind the active segment — the boxed-tabs look) plus the `mlvSegmentedItem` attribute component applied to native `<button>` / `<a>` children. Two modes are derived from the projected items:

- **Radio mode** — `<button mlvSegmentedItem value="…">`. The group is a signal-form control (`[(value)]`, `[(ngModel)]`, `[formField]`) with `role="radiogroup"` / `role="radio"` semantics, arrow-key navigation and a roving tabindex.
- **Link mode** — `<a mlvSegmentedItem routerLink="…">`. Plain navigation links; the active one is derived from the router (`routerLinkActive` on the host when present, else `Router.isActive()` on the host's `routerLink`) and marked `aria-current="page"`.

The mode is per-group, not per-item: link mode wins as soon as **any** projected item is an `<a>`.

Not supported: mixing `<a>` and `<button>` items in one group.

**Items must be direct children of `<mlv-segmented>`** — do not wrap them in a `<div>`, an `@if` container element, or any other element. Everything projected lands inside the track, and the pill is measured with `offsetLeft`/`offsetTop`, which are only meaningful relative to the track itself; a wrapped item becomes a segment whose pill is positioned against the wrapper instead. (`@if` / `@for` blocks are fine — they add no element.)

## Public API

Exported from `libs/core/segmented/src/index.ts`:

| Export                          | Kind      | Description                                                              |
| ------------------------------- | --------- | ------------------------------------------------------------------------ |
| `MlvSegmented`                  | Component | Track container — `mlv-segmented`                                        |
| `MlvSegmentedItem`              | Component | One segment — `button[mlvSegmentedItem]`, `a[mlvSegmentedItem]`          |
| `MlvSegmentedTone`              | Type      | `'neutral' \| 'accent' \| MlvTone`                                       |
| `MlvSegmentedOrientation`       | Type      | `'horizontal' \| 'vertical'`                                             |
| `MlvSegmentedLinkActiveOptions` | Type      | `{ exact: boolean } \| IsActiveMatchOptions`                             |
| `MlvSegmentedAccessor`          | Interface | Contract items use to talk to their group                                |
| `MLV_SEGMENTED`                 | Token     | `InjectionToken<MlvSegmentedAccessor>` — provided by every `MlvSegmented` |

---

## Components

### `MlvSegmented` (`mlv-segmented`)

**File:** `libs/core/segmented/src/lib/segmented/segmented.ts`
**Template:** `libs/core/segmented/src/lib/segmented/segmented.html`
**Styles:** `libs/core/segmented/src/lib/segmented/segmented.scss`
**Change detection:** `OnPush` · **Encapsulation:** `None`
**Extends:** `MlvSignalFormControlBase<unknown>` (`@malva-ui/core/form-utils`) · **Implements:** `MlvSegmentedAccessor`
**Provides:** `MLV_SEGMENTED`, `MLV_FORM_CONTROL`, `MLV_DENSITY_ELEMENT: 'segmented'`
**Host directives:** `MlvDensityDirective` (re-exposes the `mlvDensity` input)

#### Model

| Name    | Type      | Default     | Description                                                                                       |
| ------- | --------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `value` | `unknown` | `undefined` | Two-way bindable selected segment value (radio mode). Compared with each item's `value` by `===`. |

#### Inputs

| Name          | Type                                               | Default        | Description                                                                                                                                                                                                                                                                                                      |
| ------------- | -------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tone`        | `MlvSegmentedTone`                                 | `'neutral'`    | Active pill colour: `neutral` or a semantic tone (`accent`/`info`/`success`/`warning`/`danger`) — `neutral` is the raised pill (`--mlv-elevation-bg-4` / `--mlv-text-primary`), every semantic tone its pale pill and semantic text (see _Tone map_); a segmented choice never renders as a filled accent block. |
| `orientation` | `MlvSegmentedOrientation`                          | `'horizontal'` | Track axis. Reflected as `mlv-segmented--horizontal` / `mlv-segmented--vertical` and as `aria-orientation` on the radiogroup.                                                                                                                                                                                    |
| `equalWidth`  | `boolean` (coerced)                                | `false`        | Track fills its container and every item becomes `flex: 1 1 0`.                                                                                                                                                                                                                                                  |
| `mlvDensity`  | `MlvDensity`                                       | inherited      | _(host directive)_ Density override for this group; scales item padding and font size.                                                                                                                                                                                                                           |
| `disabled`    | `boolean` (coerced)                                | `false`        | _(inherited)_ Disables every segment. Also the signal-forms field binding — `[formField]` writes this very input, which is the single source read by `computedDisabled()`.                                                                                                                                       |
| `readonly`    | `boolean` (coerced)                                | `false`        | _(inherited)_ Segments stay focusable and arrow keys still move focus, but selection is blocked.                                                                                                                                                                                                                 |
| `required`    | `boolean` (coerced)                                | `false`        | _(inherited)_ Renders the `mlv-label` marker and sets `aria-required` on the radiogroup.                                                                                                                                                                                                                         |
| `state`       | `MlvFormState`                                     | `'default'`    | _(inherited)_ Explicit validation state. The effective `resolvedState()` is reflected as `mlv-segmented--state-*`.                                                                                                                                                                                               |
| `label`       | `string`                                           | `''`           | _(inherited)_ Rendered as `<mlv-label>` above the track; also the radiogroup's `aria-label` fallback.                                                                                                                                                                                                            |
| `description` | `string`                                           | `''`           | _(inherited)_ Rendered as `<mlv-description>` below the track and referenced by `aria-describedby`.                                                                                                                                                                                                              |
| `message`     | `string`                                           | `''`           | _(inherited)_ Rendered as `<mlv-message>` below the description, coloured by `resolvedState()`, and referenced by `aria-describedby`.                                                                                                                                                                            |
| `ariaLabel`   | `string \| null`                                   | `null`         | _(inherited)_ Accessible name of the radiogroup. Falls back to `label`; `null` in link mode (the track carries no role there).                                                                                                                                                                                   |
| `id`          | `string`                                           | auto           | _(inherited)_ Host `id`; also the prefix of the generated description/message element ids.                                                                                                                                                                                                                       |
| `hint`        | `string`                                           | `''`           | _(inherited)_ **Not rendered** — the segmented label has no `mlv-hint` slot. Use `description`.                                                                                                                                                                                                                  |
| `loading`     | `boolean` (coerced)                                | `false`        | _(inherited)_ **Inert** — the control renders no loading affordance.                                                                                                                                                                                                                                             |
| `clearable`   | `boolean` (coerced)                                | `false`        | _(inherited)_ **Inert** — the control renders no clear button (there is no `mlv-form-control-wrapper`).                                                                                                                                                                                                          |
| `pill`        | `boolean` (coerced)                                | `false`        | _(inherited)_ **Inert** — the track has no wrapper. Round the track with `--mlv-segmented-radius` instead.                                                                                                                                                                                                       |
| `errors`      | `readonly ValidationError.WithOptionalFieldTree[]` | `[]`           | _(inherited)_ Signal-forms field binding; `[formField]` supplies it. Feeds `resolvedState()`.                                                                                                                                                                                                                    |
| `touched`     | `boolean` (coerced)                                | `false`        | _(inherited)_ Signal-forms field binding. A non-empty `errors` becomes a visible `error` state only once this is true.                                                                                                                                                                                           |
| `dirty`       | `boolean` (coerced)                                | `false`        | _(inherited)_ Signal-forms field binding.                                                                                                                                                                                                                                                                        |

#### Outputs

| Name          | Payload   | Description                                                                                                                                                                |
| ------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `valueChange` | `unknown` | Model output of `value` — emits on click selection and on arrow/Home/End selection.                                                                                        |
| `touch`       | `void`    | _(inherited)_ Emitted when focus leaves the track, never on a selection (#347). Link mode emits nothing. `[formField]` subscribes to it and marks the bound field touched. |

#### Methods

| Method                                | Description                                                                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectItem(item: MlvSegmentedItem)`  | Selects `item` and focuses it. No-op when the group is `disabled` or `readonly`, or when the item itself is disabled. Does not emit `touch` (#347). |
| `onItemFocus(item: MlvSegmentedItem)` | Called from each item's `(focus)` host binding; keeps the `FocusKeyManager`'s active index in sync with real DOM focus.                             |
| `setFocused(value: boolean)`          | _(inherited)_ Sets the base's `focused()` signal. Not wired by segmented — the track is not a focus target.                                         |

#### Public members

- `items` — `contentChildren(MlvSegmentedItem, { descendants: true })`, in DOM order.
- `hasValue` — `computed(() => value() != null)`; satisfies the form-control connector contract.
- `focused`, `resolvedState`, `computedDisabled` — inherited signals from `MlvSignalFormUiControlBase`. `computedDisabled` is `computed(() => this.disabled())`: the `disabled` input is the single source (there is no CVA `setDisabledState` side channel to merge in).

#### Host bindings

```ts
host: {
  class: 'mlv-segmented',
  // `mlv-segmented--tone-<tone> mlv-segmented--<orientation> mlv-segmented--state-<resolvedState>`
  '[class]': '_hostModifiers()',
  '[class.mlv-segmented--disabled]': 'computedDisabled()',
  '[class.mlv-segmented--readonly]': 'readonly()',
  '[class.mlv-segmented--equal-width]': 'equalWidth()',
  '[class.mlv-segmented--link]': '_isLinkMode()',
  '[class.mlv-segmented--measured]': '_measured()',
  '[attr.id]': 'id()',
}
```

The host always carries exactly one `--tone-*`, one orientation and one `--state-*` modifier.

#### Template

```
mlv-label?                                    // only when `label` is set
div.mlv-segmented__track  #track              // radiogroup in radio mode, role-less in link mode
  span.mlv-segmented__indicator[aria-hidden]  // the sliding pill
  <ng-content />                              // the projected items
mlv-description?                              // only when `description` is set
mlv-message?                                  // only when `message` is set
```

The track carries `role="radiogroup"` plus `aria-label` / `aria-orientation` / `aria-required` / `aria-disabled` in radio mode, and **none** of them in link mode (`aria-describedby` is bound in both). It is deliberately **not** focusable: focus lives on the items, which own the roving tabindex, so a focusable container would add a second, spurious tab stop. Its `(keydown)` handler only delegates arrow/Home/End to that roving model.

#### Keyboard (radio mode)

`FocusKeyManager` over the projected items, configured with `.skipPredicate((item) => item.isDisabled())` and `.withWrap()` only — no type-ahead, no orientation lock. The handler treats both axes the same, and its horizontal pair is RTL-aware:

| Key                        | Action                        | With no active item yet |
| -------------------------- | ----------------------------- | ----------------------- |
| `ArrowRight` / `ArrowDown` | Next enabled item (wraps)     | First enabled item      |
| `ArrowLeft` / `ArrowUp`    | Previous enabled item (wraps) | Last enabled item       |
| `Home`                     | First enabled item            | First enabled item      |
| `End`                      | Last enabled item             | Last enabled item       |

The third column is the fallback when the key manager has no active item yet (nothing focused since the group was built), so the first arrow press always lands somewhere sensible from either end.

`ArrowLeft` / `ArrowRight` mirror in RTL and resolve their direction **from the group's own host**, via `normalizeArrowKey(event, this._direction())` — the same cached `elementDirection(host)` signal the pill measurement reads, so the two can never disagree (#147). A `[dir="rtl"]` ancestor mirrors the keys while the document stays LTR, as does the `dir` CDK stamps on an overlay pane a group is rendered in. The vertical pair, `Home` and `End` never mirror.

Handled keys are `preventDefault()`ed; every other key is left alone. Moving focus also **selects** (WAI-ARIA radio group) — except while `readonly`, where `selectItem()` no-ops and focus moves alone.

Roving tabindex: the active item is the single tab stop (`tabindex="0"`), falling back to the first enabled item when nothing is selected or the selected item is disabled; every other item is `-1`.

Link mode builds **no** key manager: links keep the natural tab order and arrows are inert.

#### Pill geometry

An `afterRenderEffect` writes the active item's `offsetLeft` / `offsetTop` / `offsetWidth` / `offsetHeight` into `--mlv-segmented-indicator-left` / `-top` / `-width` / `-height` on the track element. It re-runs when the active item, the item set, `orientation` or `equalWidth` changes, and on every track resize (a `MlvResizeObserverService` subscription registered in `afterNextRender`, so fonts, density and content changes are covered). With no active item the pill collapses to `width: 0; height: 0`.

`mlv-segmented--measured` — which is what enables the pill's transitions (`left`, `top`, `width`, `height` **and** `background-color`, so a `tone` swap before the first measurement is instant too) — is set **one macrotask after the first non-zero measurement** (after forcing a style flush), so the pill never slides in from `0` on load. A group first rendered without a box (inside `display: none`, a collapsed `mlv-expand`, a closed drawer) measures `0`, stays unmeasured, and gets its transition only once it is actually laid out. The pending `setTimeout` is cleared on destroy.

#### Dev-mode warnings

An `effect` guarded by `ngDevMode` `console.warn`s the two group shapes that otherwise break silently. Each fires **once per group instance** (`_warnedMixed` / `_warnedMultiActive`); in production the guard returns before reading any signal, so the effect registers no dependency and never re-runs.

| Condition                                                 | Why it is broken                                                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The projected items contain **both** `<a>` and `<button>` | `_isLinkMode()` is `some(isLink)`, so a single link flips the whole group into link mode: the buttons lose `role="radio"`, the roving tabindex and the arrow keys. |
| Radio mode with **more than one active item**             | Two items report `aria-checked="true"` (an invalid radio group) and the pill only ever measures the first. Caused by `[active]` fighting a value-driven selection. |

---

### `MlvSegmentedItem` (`button[mlvSegmentedItem]`, `a[mlvSegmentedItem]`)

**File:** `libs/core/segmented/src/lib/segmented-item/segmented-item.ts`
**Styles:** `libs/core/segmented/src/lib/segmented-item/segmented-item.scss`
**Template:** `<ng-content />` — icons, text and badges are projected.
**Change detection:** `OnPush` · **Encapsulation:** `None`
**Provides:** `MLV_DENSITY_ELEMENT: 'segmented-item'` · **Host directives:** `MlvDensityDirective` (no input, #364) — stamps its own `mlv-segmented-item--<density>`, resolved from the group's scope (an explicit `mlvDensity` on `mlv-segmented`, else the nearest ancestor scope, else `MlvDensityService`). Item sizing keys on that modifier, so an ancestor `mlv--<density>` class no longer reaches it.

Enhances a **native** `<button>` or `<a>` rather than wrapping one, so native `disabled`, `type`, `href`, `routerLink`, `download` and middle-click keep working.

#### Inputs

| Name                | Type                            | Default            | Description                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`             | `unknown`                       | `undefined`        | Written to the group's `value` on selection (radio mode). An item with `value === undefined` is never derived active.                                                                                                                                                                                                                                                                                                                   |
| `disabled`          | `boolean` (coerced)             | `false`            | Disables this segment. Buttons get the native `disabled` attribute; links get `aria-disabled="true"` + `tabindex="-1"` + a click guard.                                                                                                                                                                                                                                                                                                 |
| `active`            | `boolean \| undefined`          | `undefined`        | Explicit override of the derived active state — wins over both the value comparison and router matching. **Uncontrolled:** in radio mode do not combine it with a value-driven selection of another item — two radios would report `aria-checked="true"` and the pill follows the first active item. Dev builds warn once per group instance.                                                                                           |
| `linkActiveOptions` | `MlvSegmentedLinkActiveOptions` | `{ exact: false }` | Link mode: `Router.isActive()` options, used only when the host has a `routerLink` but **no** `routerLinkActive` (same shape as `mlv-tab`). A class field (`readonly exactOptions = { exact: true } as const`) keeps the options stable and greppable; an inline object literal also works — Angular memoises template object literals (`ɵɵpureFunctionN`, and a fully constant literal is hoisted), so the signal input still settles. |

#### Methods

| Method    | Description                                                      |
| --------- | ---------------------------------------------------------------- |
| `focus()` | Focuses the host element. Used by the group's `FocusKeyManager`. |

#### Public members

- `isLink` — `boolean`, computed once from `tagName === 'A'`.
- `isDisabled` — `computed(() => disabled() || group.computedDisabled())`.
- `isActive` — `computed()`: `active()` when set, else the router match (link mode) or `value() !== undefined && group.value() === value()` (radio mode).
- `tabIndex` — `WritableSignal<number>`, the roving tabindex written by the group.
- `elementRef` — the host `ElementRef<HTMLElement>`, read by the group for focus and pill measurement.

#### Host bindings

```ts
host: {
  class: 'mlv-segmented-item',
  '[class.mlv-segmented-item--active]': 'isActive()',
  '[class.mlv-segmented-item--disabled]': 'isDisabled()',
  '[class.mlv-segmented-item--link]': 'isLink',
  '[attr.role]': 'isLink ? null : "radio"',
  '[attr.aria-checked]': 'isLink ? null : isActive()',
  '[attr.aria-current]': 'isLink && isActive() ? "page" : null',
  '[attr.tabindex]': 'isLink ? (isDisabled() ? -1 : null) : tabIndex()',
  '[attr.disabled]': '!isLink && isDisabled() ? "" : null',
  '[attr.aria-disabled]': 'isLink && isDisabled() ? true : null',
  '[attr.type]': 'isLink ? null : _type',   // consumer `type` attribute, else "button"
  '(click)': '_onClick($event)',
  '(focus)': '_group.onItemFocus(this)',
}
```

`_type` is captured with `HostAttributeToken('type')` and defaults to `"button"`, so a segmented inside a `<form>` never submits it. `_onClick` takes an `Event` (not a `MouseEvent`): host-binding type checking types `$event` as `Event` because the compiler cannot infer the host element, and narrowing it breaks every consumer that compiles this source.

#### Link mode caveats

- **A disabled link is stopped by a capture-phase `click` listener** installed in the item constructor, not by `_onClick`. Angular coalesces every host listener for one event on one element into a single native listener and walks that chain unconditionally, so `stopImmediatePropagation()` from `_onClick` cannot stop `RouterLink.onClick` (which calls `Router.navigateByUrl()` without ever reading `defaultPrevented`). Consequence: a disabled link's click reaches **neither** `RouterLink` **nor a consumer's own `(click)` handler on that element** — matching `<button disabled>` semantics. It is bound as `fromEvent(element, 'click', { capture: true }).pipe(takeUntilDestroyed(ref))` (converted in #76) — the capture phase is what orders it ahead of Angular's coalesced listener on the same element, since at `AT_TARGET` the capture pass runs before the bubble pass, and `fromEvent` forwards the options object to the identical `addEventListener` call. It is released on destroy. `<button>` hosts need none of this: a disabled button never dispatches `click`.
- **Middle-click on a disabled link still opens its `href`** in a new tab. The guard listens for `click` only, and `RouterLink` never routes for `button !== 0` anyway, so the browser's native `auxclick` behaviour is untouched.
- **`Router.isActive()` re-derives on `NavigationEnd`.** `RouterLink.urlTree` is not reactive, so a `[routerLink]` bound to a _changing_ expression only updates the item's active state on the next navigation. Put `routerLinkActive` on the host when the link target itself changes — it owns the active state and updates on its own.
- The `Router.isActive(url, options)` overloads used here are **deprecated in Angular 22** (same as `mlv-tab-group`); a signal-based `isActive()` replacement is a tracked follow-up.
- `linkActiveOptions` accepts either the `{ exact: boolean }` shorthand or a full `IsActiveMatchOptions`. They are dispatched to different `Router.isActive` overloads: passing `{ exact: true }` as raw match options would silently ignore the `exact` key.

---

## Types & token

- `MlvSegmentedTone = 'neutral' | 'accent' | MlvTone` — `MlvTone` from `@malva-ui/cdk/utils` (`'info' | 'success' | 'warning' | 'danger'`).
- `MlvSegmentedOrientation = 'horizontal' | 'vertical'`.
- `MlvSegmentedLinkActiveOptions = { exact: boolean } | IsActiveMatchOptions`.
- `MLV_SEGMENTED: InjectionToken<MlvSegmentedAccessor>` — how an item reaches its group without importing the concrete class (breaks the item ↔ container cycle).

```ts
interface MlvSegmentedAccessor {
  readonly value: Signal<unknown>;
  readonly computedDisabled: Signal<boolean>;
  readonly readonly: Signal<boolean>;
  selectItem(item: MlvSegmentedItem): void;
  onItemFocus(item: MlvSegmentedItem): void;
}
```

---

## Styling

Two BEM blocks:

- `.mlv-segmented` — elements `__track`, `__indicator`; modifiers `--tone-{neutral|accent|info|success|warning|danger}`, `--horizontal` / `--vertical`, `--equal-width`, `--disabled`, `--measured`, `--state-{default|info|success|warning|error}`, plus `--readonly` and `--link` which carry **no styles** (state hooks for consumers).
- `.mlv-segmented-item` — modifiers `--active`, `--disabled`, plus `--link` which carries **no styles** (hook only).

Visuals: grey track (`--mlv-background-neutral-1`, radius `button`, `0.1875rem` inset padding, `0.125rem` gap, `overflow: hidden`), raised pill (`--mlv-shadow-raised`, concentric `--mlv-segmented-inner-radius`, `var(--mlv-duration-normal)` (200ms) `--mlv-ease-in-out-strong` slide), items in `--mlv-text-secondary` that transition `color` and `background-color` to the tone's active colour, `--mlv-background-neutral-1-hover` on idle hover, pressed (`:active`) idle segments one shade deeper on `--mlv-background-neutral-1-active`, and a `0.0625rem` hairline separator centred in the gap between two adjacent idle items.

Separator rules: the hairline is hidden on **both** sides of the active, hovered, pressed (`:active`) and `:focus-visible` item, including the active item's own leading hairline. In `orientation="vertical"` the same hairline becomes a horizontal rule on the item's **top** edge (50% width, centred) instead of a vertical rule on its inline-start edge. Sizing is entirely density-driven (`0.375rem 0.625rem` tight → `1.25rem 1.5rem` airy, with `--mlv-font-size-s` / `-l` steps — identical to `mlv-tab-item`); there is **no** `size` input. Only `--state-error` paints (an inset `--mlv-border-error` stroke on the track); `--state-warning` / `--state-success` / `--state-info` / `--state-default` declare nothing (SF-R6). `.mlv-segmented--disabled` declares the disabled track and pill — see _Disabled surface_ below. Reduced motion via `@include mixins.reduced-motion('mlv-segmented')`. Owner override 2026-08-25: the `neutral` tone's pill briefly converged on `--mlv-background-selected`/`--mlv-text-on-selected` (AB-R8, SF-R1), but the owner asked for the previous raised-white pill back (`--mlv-text-primary` label). **Theme follows tokens only (#454):** the track is `--mlv-background-neutral-1` and the neutral pill `--mlv-elevation-bg-4` in every theme — `#f5f5f5` / `#ffffff` in light, `#262626` / `#404040` (one step lighter, so the pill lifts) in dark, `#e8e8e8` / `#ffffff` in high contrast. Until #454 the dark pair was a `[mlvTheme='dark'] .mlv-segmented` / `--tone-neutral` repaint over a `--mlv-background-sunken` / `-raised` default: pure light and dark resolve exactly as before, but the repaint also reached light islands inside a dark page, kept the dark pill under high contrast on a dark `<html>` (2.03:1 under HC's black label) and missed a segmented that carries `mlvTheme` itself. No stylesheet may key on a theme attribute any more (`libs/styles/src/lib/theme-attribute-selectors.spec.mjs`); every arrangement is pinned in `theme-scopes.spec.mjs` and the label/pill pair scored ≥ 4.5:1 in all four themes in `tone-contrast.spec.mjs`. A subtree that re-declares `--mlv-background-sunken` / `-raised` no longer recolours the track / pill — set `--mlv-segmented-track-bg` / `-pill-bg`, the documented knobs. Semantic tones (`accent`/`info`/`success`/`warning`/`danger`) still use their pale pills, which are theme-aware without a component-level repaint.

Consumer-overridable custom properties:

| Variable                             | Declared on                                 | Default                                    |
| ------------------------------------ | ------------------------------------------- | ------------------------------------------ |
| `--mlv-segmented-radius`             | `.mlv-segmented`                            | `var(--mlv-radius-button)`                 |
| `--mlv-segmented-track-padding`      | `.mlv-segmented`                            | `0.1875rem`                                |
| `--mlv-segmented-track-bg`           | `.mlv-segmented`                            | `var(--mlv-background-neutral-1)`          |
| `--mlv-segmented-separator-color`    | `.mlv-segmented`                            | `var(--mlv-border-normal)`                 |
| `--mlv-segmented-indicator-duration` | `.mlv-segmented`                            | `var(--mlv-duration-normal)` (200ms)       |
| `--mlv-segmented-pill-bg`            | `.mlv-segmented`, overridden per `--tone-*` | `var(--mlv-elevation-bg-4)`, then per tone |
| `--mlv-segmented-active-color`       | `.mlv-segmented`, overridden per `--tone-*` | `var(--mlv-text-primary)`, then per tone   |

The two pill variables carry their **neutral** defaults on `.mlv-segmented` itself, so a consumer who replaces the host `[class]` (and with it the `--tone-*` modifier) still gets the neutral pill instead of a transparent one — in dark too, since #454 (the old dark repaint keyed on `--tone-neutral`, so a replaced class left dark on the sinking `raised` pill); the `&--tone-*` rules are emitted after the block at equal specificity, so a tone still wins. Neutral is the raised-pill boxed-tabs look, never a filled accent block.

`--mlv-segmented-inner-radius` (`max(0rem, radius − track-padding)`, shared by the pill and the items) and `--mlv-segmented-indicator-left|top|width|height` (written by the component in `px`) are internal — read them, do not set them.

Tone map — pale background / semantic text: `accent` → `--mlv-background-accent-1-pale` / `--mlv-text-action`; `info` → `--mlv-background-info-1-pale` / `--mlv-text-info`; `success` → `--mlv-background-success-1-pale` / `--mlv-text-positive`; `warning` → `--mlv-background-warning-1-pale` / `--mlv-text-warning`; `danger` → `--mlv-background-danger-1-pale` / `--mlv-text-negative`.

---

## Usage

```ts
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
```

```html
<!-- Radio mode -->
<mlv-segmented [(value)]="period" ariaLabel="Period">
  <button mlvSegmentedItem value="day">Day</button>
  <button mlvSegmentedItem value="week">Week</button>
  <button mlvSegmentedItem value="month" disabled>Month</button>
</mlv-segmented>

<!-- Link mode -->
<mlv-segmented tone="accent">
  <a mlvSegmentedItem routerLink="/inbox">Inbox</a>
  <!-- `exactOptions = { exact: true } as const` — a class field keeps it stable and greppable;
       an inline `[linkActiveOptions]="{ exact: true }"` works too (Angular memoises the literal) -->
  <a mlvSegmentedItem routerLink="/sent" [linkActiveOptions]="exactOptions">Sent</a>
</mlv-segmented>

<!-- Signal forms + radius override -->
<mlv-segmented label="Plan" description="Change any time." [formField]="fields.plan" style="--mlv-segmented-radius: var(--mlv-radius-full)">
  <button mlvSegmentedItem value="starter">Starter</button>
  <button mlvSegmentedItem value="pro">Pro</button>
</mlv-segmented>

<!-- Vertical, full width -->
<mlv-segmented orientation="vertical" equalWidth [(value)]="view">
  <button mlvSegmentedItem value="list">List</button>
  <button mlvSegmentedItem value="grid">Grid</button>
</mlv-segmented>
```

> With `[formField]`, do **not** also set the `required` attribute — binding an input that the field directive also writes is `NG8022`. Express it in the form schema instead (`required(path.plan)`), which drives the inherited `required` input automatically.

---

## Dependencies

- `@angular/cdk/a11y` — `FocusKeyManager`, `FocusableOption`
- `@angular/cdk/coercion` — `coerceBooleanProperty`
- `@angular/router` — `Router`, `RouterLink` and `RouterLinkActive` are injected (`{ optional: true }`, the latter two also `{ self: true }`), so a router-less app works; `NavigationEnd` is only an `instanceof` filter on `Router.events` and `IsActiveMatchOptions` only a type import
- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase`, `MLV_FORM_CONTROL`, `MlvLabel`, `MlvDescription`, `MlvMessage`
- `@malva-ui/cdk/density` — `MlvDensityDirective`, `MLV_DENSITY_ELEMENT`
- `@malva-ui/cdk/utils` — `MlvResizeObserverService`, `MlvTone`

---

## Testing

`yarn nx test core-segmented` — 48 Vitest/jsdom specs across two files: 45 in `segmented.spec.ts` (four suites) and 3 in `segmented-binding-matrix.spec.ts`.

- **radio mode** — an axe run (`aria-*`, `aria-toggle-field-name`, `button-name`, `nested-interactive`, `tabindex`, `duplicate-id-aria` …) with an enabled group, a disabled item and a disabled group; radiogroup/radio semantics, value-derived active, `[active]` override, click selection, roving tabindex (incl. the first-enabled fallback), disabled item / disabled group / readonly, host modifiers, indicator custom properties and `--measured` (offset getters mocked; hidden-container case), the full keyboard model, and the multi-active dev warning (fires once, silent for a single active item).
- **link mode** — the same axe run with an active link and a disabled link; no radiogroup semantics, `aria-current="page"`, subset vs. `linkActiveOptions.exact` matching, host `routerLinkActive`, disabled link (out of the tab order, click prevented, router does not navigate), enabled link still navigates, arrows inert.
- **mixed hosts** — a group holding both `<a>` and `<button>` items warns once; a pure-button group stays silent.
- **stylesheet** — guards on the declared custom-property defaults (incl. the neutral `--mlv-segmented-pill-bg` / `-active-color` pair on the block), the pale tone map, the neutral pill on `--mlv-elevation-bg-4` and no rule keyed on a theme attribute (#454), the `--measured` transition gate + reduced-motion path, `--mlv-padding-*` pair misuse, the separator rules, and the idle hover / pressed feedback.
- **forms bindings matrix** (`segmented-binding-matrix.spec.ts`) — `verifyFormsBinding()` from `@malva-ui/core/form-utils/testing` run once per binding mode (`[formControl]`, `[(ngModel)]`, `[formField]`): form→control write round-trip, a real click on the second segment propagating back to the form side, `touched` once focus then leaves the track (#347 — a click alone no longer touches), and disabled propagation into `computedDisabled()` (reactive + signal forms).

Lint: `yarn nx lint core-segmented`. Style-token gate: `yarn nx run styles:check-padding-tokens`.

Docs page: `apps/docs/src/app/pages/segmented` — five examples (basic, links, forms, tones & radius, layout & density).

## Disabled surface (2026-09, #366)

- A disabled group dimmed its track to 0.4 and every item (`isDisabled` includes the group) to 0.4 again — labels at 16 % alpha (1.27:1 light). Now `.mlv-segmented--disabled` declares `--mlv-segmented-track-bg: --mlv-background-disabled`, `--mlv-segmented-pill-bg: --mlv-elevation-bg-4` (neutral whatever the tone), `--mlv-segmented-active-color: --mlv-text-disabled`, and a flat pill (`box-shadow: none`); emitted after the tone loop. `.mlv-segmented-item--disabled` takes `color: --mlv-text-disabled` after `--active`.
- Idle label on track: light 1.27 → 3.76, dark 1.46 → 3.44. Selected label on pill: light 1.40 → 4.74, dark 1.57 → 2.19 (`#737373` on the `#404040` dark pill — up, still low; disabled text is exempt from 1.4.3).
- Spec: `segmented-disabled-styles.spec.ts` (group + item).
- Guard: `styles:check-disabled-surface` (`scripts/check-disabled-surface.mjs`, a `styles:lint` dependency) fails any other disabled `opacity` and any `--state-success/warning/info` rule.
