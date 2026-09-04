---
# Library: time-picker

Nx project name: `core-time-picker`. Internal scroll controls explicitly use
`type="button"` so embedding the picker in a form cannot submit that form.

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Time Picker library (`@malva-ui/core/time-picker`) provides a popup-based drum-roll style time selection component. A compact trigger displays the current time with a clock icon; clicking it opens a floating popup panel with scrollable columns. Supports 24h and 12h (AM/PM) modes, optional seconds, and signal/reactive/template-driven forms.

The component follows the same trigger → popup pattern as `mlv-day-picker`, `mlv-select`, and `mlv-combobox`, using `mlv-form-control-wrapper` for consistent form control styling (border, background, states, focus, density).

The component is composed of two Angular components:
- `MlvTimePicker` — the main form-control component with trigger + popup panel, label/hint/message support
- `MlvTimePickerColumn` — an internal scrollable column using CSS scroll-snap

---

## Public API

Exported from `libs/core/time-picker/src/index.ts`:

| Export               | Kind      | Description                                                                          |
| -------------------- | --------- | ------------------------------------------------------------------------------------ |
| `MlvTimePicker`      | Component | The primary time picker form control — `mlv-time-picker`                             |
| `MlvTimeMode`        | Type      | `'24h' \| '12h'`                                                                     |
| `MlvTimePickerState` | Type      | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` (alias of `MlvFormState`) |

`MlvTimePickerColumn` is an internal renderer and is intentionally not
exported from the package barrel.

---

## Components

### `MlvTimePicker`

**File:** `libs/core/time-picker/src/lib/time-picker/time-picker.ts`
**Template:** `libs/core/time-picker/src/lib/time-picker/time-picker.html`
**Styles:** `libs/core/time-picker/src/lib/time-picker/time-picker.scss`

- **Selector:** `mlv-time-picker`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Extends:** `MlvSignalFormControlBase<string>` from `@malva-ui/core/form-utils`
- **Implements:** `FormValueControl<string>`, `MlvFormControl`

#### Inputs from `MlvSignalFormControlBase`

| Input      | Type                 | Default        | Description                         |
| ---------- | -------------------- | -------------- | ----------------------------------- |
| `id`       | `string`             | auto-generated | HTML id for the inner group element |
| `label`    | `string`             | `''`           | Label text                          |
| `hint`     | `string`             | `''`           | Hint text inside label              |
| `message`  | `string`             | `''`           | Validation/status message           |
| `state`    | `MlvTimePickerState` | `'default'`    | Visual state                        |
| `disabled` | `BooleanInput`       | `false`        | Disables all columns                |
| `readonly` | `boolean`            | `false`        | Read-only mode                      |

#### Own Inputs

| Input         | Type           | Default         | Description                           |
| ------------- | -------------- | --------------- | ------------------------------------- |
| `mode`        | `MlvTimeMode`  | `'24h'`         | Clock mode — 24-hour or 12-hour AM/PM |
| `showSeconds` | `BooleanInput` | `false`         | Shows a seconds column                |
| `ariaLabel`   | `string`       | `'Time picker'` | ARIA label for the group element      |

#### Forms value format

Emits and accepts time strings in `HH:mm` (or `HH:mm:ss` when `showSeconds` is true). Always in 24-hour notation.

#### Host Bindings

```ts
host: {
  class: 'mlv-time-picker',
  '[class]': '"mlv-time-picker--" + state()',
  '[class.mlv-time-picker--disabled]': 'computedDisabled()',
  '[class.mlv-time-picker--open]': 'isOpen()',
  '[class.mlv-time-picker--12h]': 'mode() === "12h"',
  '[class.mlv-time-picker--with-seconds]': 'showSeconds()',
}
```

#### Density

Uses `MlvDensityDirective` as a `hostDirective`. Provides `MLV_DENSITY_ELEMENT = 'time-picker'`.

Since popup content renders in a detached CDK overlay, the effective density is read from the directive and bound as a BEM modifier class on the panel element (`mlv-time-picker__panel--compact`, etc.). The density SCSS mixins on `&__panel` respond to this class, setting the `--mlv-tp-*` CSS custom properties which cascade to columns, dividers, and AM/PM buttons inside the overlay.

#### Architecture

The trigger element has `role="combobox"` with `aria-expanded`, `aria-haspopup="dialog"`, and conditional `tabindex`. Clicking or pressing Enter/Space opens the popup. The popup contains drum-roll columns rendered by `MlvTimePickerColumn`. On popup open, the first column (hours) listbox receives focus automatically. The `mlv-popup` opts into modal-dialog semantics via `panelRole="dialog"` + `[modal]="true"` + `[ariaLabel]` (the popup no longer hard-codes these) — this emits `role="dialog"`/`aria-modal="true"` on the panel and enables the CDK focus trap. ArrowLeft/ArrowRight keyboard navigation moves focus between column listboxes. On popup close, focus is restored to the trigger element via `_onPopupClosed()`.

The popup also opts into `mobileMode="auto"` (`[mobileTitle]="label() || _resolvedAriaLabel()"`), so below the `md` breakpoint (< 768px) the drum-roll columns open in a full-screen sheet with a header + close button and scroll-locked page; above it the panel stays anchored (unchanged). The drum-roll scroll-snap columns and `_onPopupOpened()` (focus first column) / `_onPopupClosed()` (focus restore) compose with the full-screen focus trap. See `libs-popup.md` → _Mobile fullscreen inputs_.

#### Mobile full-screen sheet — `__panel--sheet` (2026-09, #116)

The panel carries `.mlv-time-picker__panel--sheet` while `popupRef.isFullscreen()` is `true`, alongside its density modifier (separate bindings — `[class]` writes the density string, `[class.…--sheet]` toggles this one). It exists because a full-screen sheet is viewport-tall while the drum is fixed-size, so without it the columns sat in the sheet's top-inline-start corner with roughly two-thirds of the sheet blank.

The drum takes the available space by **growing its rows**, not by showing more of them: it goes from five rows to seven, so it still reads as a picker rather than as a long scrolling list.

| Declaration               | On               | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flex: 1 1 0`             | `__panel--sheet` | Claim the leftover height from `.mlv-popup__inner`'s column — and **not** the `flex: 1` shorthand. `flex: 1` expands to a _percentage_ basis (`0%`), which against this indefinite-height ancestor chain leaves the item's block size content-dependent, so the container query below has no definite height and every `cqh` resolves to `0`. A `<length>` basis of `0` plus `flex-grow` makes the used height pure free-space distribution, definite without measuring contents. |
| `padding: 0`              | `__panel--sheet` | `--mlv-popover-inset` is the shared _dropdown_ inset (4px); `.mlv-popup--fullscreen` already pads `__inner` for the sheet.                                                                                                                                                                                                                                                                                                                                                        |
| `flex: 1 1 0`             | `__columns`      | A length basis for the same reason as the panel.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `container-type: size`    | `__columns`      | Size the drum from the space genuinely left. Deriving from `svh` instead would have to guess the sheet header, the safe-area insets and `__inner`'s padding, and is wrong the moment any of them changes.                                                                                                                                                                                                                                                                         |
| `overflow: hidden`        | `__columns`      | Size containment is **not** paint containment. Where the rem floor wins — a container under 7 × 2.75rem, i.e. a sheet shorter than about 430px — the track is taller than this row and would otherwise spill past both ends and be clipped by the scroll viewport instead, cutting rows and leaving the centre stripe off-centre. Clipped here, the drum degrades to fewer visible neighbours around a selected row that stays centred.                                           |
| `justify-content: center` | `__columns`      | The inline-axis half. Invisible in a dropdown, where the panel shrink-wraps to the columns; plain once `__inner`'s default `align-items: stretch` makes the sheet panel full-width.                                                                                                                                                                                                                                                                                               |

Ablated on the running component at 375×812: `flex: 1 1 0` on _either_ element gives `100cqh` = 719px, `flex: 1` on both gives 0px and the drum falls silently to its 2.75rem floor. `min-height: 0` measurably changes nothing on either element and is deliberately **not** written — an earlier draft carried it, and the comment justifying it (a "cyclic dependency" between the container query and its contents) was wrong: size containment means contents contribute no size, so there is no cycle to break.

Overridden tokens, all on `__columns` so they resolve against the size container:

| Variable                                        | Sheet value                                                    | Note                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--mlv-tp-visible-rows`                         | `7`                                                            | Five rows in a viewport-tall sheet put a two-digit numeral in a 144px row. Seven lands near 103px at 375×812. `--mlv-tp-side-rows` follows from it, so the centre stripe, the snap port and the list padding all move together.                                                                                          |
| `--mlv-tp-item-height`                          | `max(2.75rem, calc(100cqh / var(--mlv-tp-visible-rows)))`      | The rows divide the container exactly (7 × 100cqh/7 = 100cqh); the divisor is the variable, not a second `7` (#142). The rem floor keeps the row a usable touch target and the numerals legible on a short viewport (a landscape phone); past that point `overflow: hidden` takes over.                                  |
| `--mlv-tp-track-height`                         | `calc(var(--mlv-tp-item-height) * var(--mlv-tp-visible-rows))` | **Re-declared, not inherited.** A custom property's `var()`s are substituted on the element that _declares_ it, so `__panel`'s `calc(… * var(--mlv-tp-visible-rows, 5))` has already resolved against the density item height by the time it reaches this row — leaving a 180px track around 103px rows, 1.75 rows deep. |
| `--mlv-tp-font-size`                            | `max(var(--mlv-font-size-l), 6cqh)`                            |                                                                                                                                                                                                                                                                                                                          |
| `--mlv-tp-column-width` / `--mlv-tp-ampm-width` | `max(5rem, 26cqw)`                                             |                                                                                                                                                                                                                                                                                                                          |
| `--mlv-tp-ampm-height`                          | `min(var(--mlv-tp-item-height), 3.5rem)`                       | AM/PM does not follow the row height here — it is a two-state button, and at a 103px row it rendered as a 103×81px box around a 14px label.                                                                                                                                                                              |
| `--mlv-tp-ampm-font-size`                       | `var(--mlv-font-size-l)`                                       | Sized for the capped box rather than for a drum row.                                                                                                                                                                                                                                                                     |

Drum depth is parameterised rather than hand-edited in four places: `time-picker-column.scss` derives `--mlv-tp-side-rows: calc((var(--mlv-tp-visible-rows, 5) - 1) / 2)` and every length there — the track height, the centre stripe's offset, the snap port, the list padding — is a multiple of one or the other, so setting `--mlv-tp-visible-rows` alone moves all of them. It must stay **odd** so exactly one row can sit on the centre stripe. The `5` is a `var()` _fallback_ and never a declaration on the column: a declaration there would shadow the sheet's `7` for the whole subtree, which is a real bug that was caught in review — an 88px stripe offset (2 rows) against a 7-row track.

Verified in a browser at 375×812: item height 102.7px, font 43.14px, seven rows, track 719px, centre stripe at 308.14px = exactly three rows down, selected row flush with the stripe, no track overflow. Identical geometry in RTL, with the columns mirrored (hour column at the inline-start = right edge). The desktop dropdown is unchanged at 1280px — 36px rows, 14px font, `container-type: normal`, `padding: 4px`, two rows above the stripe.

The sheet's own sizing cannot be asserted in jsdom, which implements no layout; `time-picker-styles.spec.ts` asserts it against the compiled stylesheet instead (including that the column never _declares_ `--mlv-tp-visible-rows`), and `time-picker.spec.ts` asserts the class switch (full-screen vs. trigger-anchored, and that the density modifier survives alongside it).

The `.mlv-popup__inner` side of this — why sheet content was top-anchored in the first place — is in `libs-popup.md` → _Mobile fullscreen inputs_.

---

### `MlvTimePickerColumn`

**File:** `libs/core/time-picker/src/lib/time-picker-column/time-picker-column.ts`

- **Selector:** `mlv-time-picker-column`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`

#### Inputs

| Input           | Type                  | Description                                            |
| --------------- | --------------------- | ------------------------------------------------------ |
| `label`         | `string` (required)   | Accessible label — `"Hours"`, `"Minutes"`, `"Seconds"` |
| `items`         | `number[]` (required) | Values to display                                      |
| `selectedValue` | `number` (required)   | Currently selected value                               |
| `disabled`      | `boolean`             | Disables the column                                    |

#### Outputs

| Output        | Type     | Description                       |
| ------------- | -------- | --------------------------------- |
| `valueChange` | `number` | Emitted when user selects a value |

#### Methods

| Method        | Description                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `focusList()` | Focuses the column's `<ul>` listbox. Used by parent for inter-column keyboard navigation.                                                                      |
| `listElement` | Getter — the column's `<ul>` listbox element, or `null` before view init. Lets the parent identify which column holds focus when moving focus between columns. |

#### `@angular/aria` backing (Phase 3 migration)

The column's `<ul>` is a headless **`ngListbox`** and each `<li>` an **`ngOption`** (`@angular/aria/listbox`), applied in the template (not as `hostDirectives`) so their inputs bind freely. aria owns the roles (`listbox`/`option`), `aria-selected`, `aria-activedescendant`, roving tabindex, keyboard navigation, and selection. Pinned configuration:

| aria input      | Value              | Why                                                                                                                                                                               |
| --------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `focusMode`     | `activedescendant` | Focus stays on the `<ul>` (parent inter-column ArrowLeft/Right + `focusList()` rely on it). aria moves neither DOM focus nor scroll in this mode, so it cannot fight scroll-snap. |
| `selectionMode` | `follow`           | Drum-roll semantic = "centered is selected" → arrow moves **and** selects (unlike list/select/tree, which pin `explicit`).                                                        |
| `wrap`          | `true`             | Preserves the historical wrapping navigation.                                                                                                                                     |
| `disabled`      | `disabled()`       | A disabled column blocks aria keydown/click.                                                                                                                                      |
| `tabindex`      | `-1` when disabled | Preserves the contract that a disabled listbox leaves the tab order (aria would keep it focusable at `0`).                                                                        |

**Value bridging:** the public scalar `selectedValue` input / `valueChange` output are preserved. Internally `[value]="[selectedValue()]"` bridges the scalar into aria's array (`V[]`) single-select model, and `(valueChange)` collapses `V[]` → scalar (guarding no-op echoes).

**Active-item sync (the scroll-snap coexistence gotcha):** aria's `setDefaultState` auto-activates the selected option only until first interaction — but the popup's open handler focuses the list (`focusin`), defeating it. So the column seeds aria's active item to the selected value via `Listbox.gotoIndex()` in `ngAfterViewInit` (options are registered synchronously by `ngOption.ngOnInit`), re-syncs it from the scroll handler, and re-syncs from the `selectedValue` effect on external writes. Without this seed, the first Arrow key would navigate from a stale/`undefined` active item.

#### Keyboard Navigation (owned by aria)

- ArrowUp/ArrowDown: navigate + select items within the column (wrapping)
- ArrowLeft/ArrowRight: move focus between columns (handled by parent panel)
- Home/End: jump to first/last item
- Enter/Space: select the active item
- **Type-ahead (aria addition):** typing digits seeks to the matching zero-padded option `label`

#### Scroll Behavior

The scroll listener is registered outside the template on the `<ul>` — as
`fromEvent(listEl, 'scroll', { passive: true })` from `afterNextRender`, inside
`runOutsideAngular`, torn down with `takeUntilDestroyed(this._destroyRef)` (the
`DestroyRef` is passed explicitly because an `afterNextRender` callback is not
an injection context) — not as a `(scroll)` binding in the template, and
`_onScroll` is `private`. A template
listener runs inside Angular's `wrapListenerIn_markDirtyAndPreventDefault`
wrapper, which marks the ancestor view chain dirty and notifies the
change-detection scheduler on every event; this handler only resets a debounce
timer and writes nothing reactive, so every one of those passes was pure waste
at momentum-scroll frequency (20 scroll events: 0 passes, was 20). The debounced
`_syncIndexFromScroll()` does not need the zone either — it writes aria's
active-item signal and emits `valueChange`, and Angular wraps a parent's output
binding in the same listener wrapper, so the emit still marks the parent dirty
whichever zone raised it. Covered by `time-picker-column.spec.ts`.

Uses CSS `scroll-snap-type: y mandatory` for item snapping — retained on top of aria (aria attaches no scroll listener and never calls its opt-in `scrollActiveItemIntoView()`). The scroll handler is debounced (150 ms) to avoid fighting with scroll-snap during large swipes; on a scroll-driven change the aria active item is re-aligned via `gotoIndex` so a following Arrow key moves from the centered value. Programmatic smooth scrolling is used only for keyboard/click/external-value interactions.

---

## Styling

### CSS Custom Properties

| Variable                  | Default                                                           | Purpose                                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--mlv-tp-item-height`    | `2.25rem`                                                         | Item height (density-aware)                                                                                                                                                                                                                                                                                                                            |
| `--mlv-tp-column-width`   | `3.5rem`                                                          | Column width (density-aware)                                                                                                                                                                                                                                                                                                                           |
| `--mlv-tp-ampm-width`     | `3.5rem`                                                          | AM/PM column width (density-aware)                                                                                                                                                                                                                                                                                                                     |
| `--mlv-tp-visible-rows`   | `5`                                                               | Drum depth, including the selected row. Must be **odd** so exactly one row sits on the centre stripe. Consumed only as a `var()` fallback on `mlv-time-picker-column`, never declared there — a declaration would shadow an ancestor's override for the whole subtree.                                                                                 |
| `--mlv-tp-side-rows`      | `calc((var(--mlv-tp-visible-rows, 5) - 1) / 2)`                   | Derived, not set directly. Drives the centre stripe's offset, the scroll-snap port and the list padding, so all three follow `--mlv-tp-visible-rows`.                                                                                                                                                                                                  |
| `--mlv-tp-track-height`   | `calc(var(--mlv-tp-item-height) * var(--mlv-tp-visible-rows, 5))` | Drum viewport height, read by the columns, the `:` divider and the AM/PM column. Re-declare it wherever `--mlv-tp-item-height` is overridden: a custom property's `var()`s are substituted on the declaring element, so an inherited value keeps the ancestor's item height. The row count is a `var()` fallback on the panel, never a literal (#142). |
| `--mlv-tp-font-size`      | `var(--mlv-font-size-m)`                                          | Numeral size (density-aware). Read by `__list` and `__item` as `var(--mlv-tp-font-size, var(--mlv-font-size-m))` — before #116 both re-stated the raw `m` token through `mixins.base`, which shadowed this for every descendant, so the density font ramp reached nothing.                                                                             |
| `--mlv-tp-ampm-height`    | `var(--mlv-tp-item-height)`                                       | AM/PM button height, so the pair lines up with the drum rows it sits beside. Overridden (capped) in the mobile sheet, where a row is far taller than a button should be.                                                                                                                                                                               |
| `--mlv-tp-ampm-font-size` | `var(--mlv-tp-font-size)`                                         | AM/PM label size. Follows the numerals by default; set independently wherever `--mlv-tp-ampm-height` is capped.                                                                                                                                                                                                                                        |

Eight of the nine are overridden on `.mlv-time-picker__panel--sheet .mlv-time-picker__columns` in the mobile sheet — see _Mobile full-screen sheet_ above. `--mlv-tp-side-rows` is not among them: it is derived from `--mlv-tp-visible-rows` and follows on its own.

**Density font ramp — visible change (#116).** `--mlv-tp-font-size` already existed and was already set per density, but `__list` and `__item` both passed the raw `--mlv-font-size-m` to `mixins.base`, so the numerals rendered at `m` at **every** density while the `:` divider followed the ramp. Fixing that changes the anchored desktop dropdown as well as the sheet: numerals now render 12 / 14 / 14 / 16 / 18px across the five densities instead of 14px throughout, so `tight`, `spacious` and `airy` all shift. Nothing to edit at a call site — but a consumer who had compensated with their own `font-size` override on `.mlv-time-picker-column__item` will now be doubling up.

Border, background, and focus styling are handled by `mlv-form-control-wrapper` — no component-scoped border variables needed.

---

## Usage Examples

```html
<!-- Basic 24h -->
<mlv-time-picker label="Start time" [formControl]="timeCtrl" />

<!-- 12h AM/PM mode -->
<mlv-time-picker label="Meeting time" mode="12h" [formControl]="timeCtrl" />

<!-- With seconds -->
<mlv-time-picker label="Precise time" [showSeconds]="true" [formControl]="timeCtrl" />

<!-- Disabled -->
<mlv-time-picker label="Fixed time" disabled [formControl]="timeCtrl" />

<!-- Error state -->
<mlv-time-picker label="Time" state="error" message="Required" [formControl]="timeCtrl" />
```

---

## Dependencies

### Internal

- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase`, `MlvFormControlWrapper`, `MlvFormControlWrapperControl`, `MlvHint`, `MlvLabel`, `MLV_FORM_CONTROL`, `MlvMessage`
- `@malva-ui/core/popup` — `MlvPopup`, `MlvPopupContent`, `MlvPopupContainer`
- `@malva-ui/core/button` — `MlvButton` (AM/PM toggle buttons)
- `@malva-ui/cdk/density` — `MlvDensityDirective`, `MLV_DENSITY_ELEMENT`
- `@lucide/angular` — `LucideClock` (trigger icon)

### Angular

- `@angular/core`, `@angular/forms`, `@angular/cdk/coercion`
- `@angular/aria/listbox` — `Listbox` (`ngListbox`), `Option` (`ngOption`) backing the drum-roll column (see the aria backing section above)

### Styles

- `@malva-ui/styles` — `mixins.base()`, `density.*` mixins, `--mlv-*` tokens

---

## Field surface (2026-08)

- `ariaLabel` moved to `MlvSignalFormUiControlBase`; `MlvTimePicker` no longer declares its own. `_resolvedAriaLabel()` still falls back to the i18n `timePicker` string, so the rendered name is unchanged when the input is unset.
- Inherited `required` renders the `mlv-label` marker and sets `aria-required` on the `role="combobox"` trigger.
- Inherited `description` renders `<mlv-description>` below the control; `aria-describedby` is the base's `_describedBy()`.
- The public `messageId` computed is gone — `<mlv-message>` carries the base's `_messageId()`.
