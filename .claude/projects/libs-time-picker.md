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

The scroll listener is registered imperatively on the `<ul>` — with
`addEventListener('scroll', …, { passive: true })` from `afterNextRender`,
inside `runOutsideAngular`, torn down from `DestroyRef.onDestroy` — not as a
`(scroll)` binding in the template, and `_onScroll` is `private`. A template
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

| Variable                | Default                 | Purpose                            |
| ----------------------- | ----------------------- | ---------------------------------- |
| `--mlv-tp-item-height`  | `2.25rem`               | Item height (density-aware)        |
| `--mlv-tp-column-width` | `3.5rem`                | Column width (density-aware)       |
| `--mlv-tp-ampm-width`   | `3rem`                  | AM/PM column width (density-aware) |
| `--mlv-tp-track-height` | `calc(item-height * 5)` | Viewport height (shows 5 items)    |

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
