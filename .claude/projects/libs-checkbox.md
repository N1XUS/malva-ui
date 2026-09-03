---
# Library: checkbox

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The checkbox library (`@malva-ui/core/checkbox`) provides accessible, stateful checkbox components. Includes a standalone checkbox component supporting indeterminate states and a checkbox group for managing multiple checkboxes together with keyboard navigation (arrow keys).

> **Accessible naming (`aria-label` / `aria-labelledby`)** — the host element is
> role-less, so ARIA prohibits naming attributes on it (axe
> `aria-prohibited-attr`); the real accessible-name target is the inner
> `<input type="checkbox">`. Two supported forms, both landing on the inner input:
>
> 1. **`ariaLabel` / `ariaLabelledBy` inputs** — for dynamic labels
>    (`<mlv-checkbox [ariaLabel]="'Select row ' + i" />`). Never bind
>    `[attr.aria-label]` on the host — Angular writes it straight onto the host
>    element where it cannot be intercepted.
> 2. **Static host attribute** (`<mlv-checkbox aria-label="Select row" />`) —
>    captured via `HostAttributeToken` in the constructor, imperatively removed
>    from the host (`Renderer2.removeAttribute`), and forwarded to the input.
>
> The inputs win over a captured static attribute
> (`_resolvedAriaLabel`/`_resolvedAriaLabelledBy` computeds); when neither is
> supplied no attribute is emitted. `input({ alias: 'aria-label' })` was tried
> first and reverted: Angular does not consume a static `aria-label` attribute
> into an aliased input when it is also a real DOM attribute. `mlv-radio` and
> `mlv-switch` implement the identical pattern.

## Public API

Exported from `libs/core/checkbox/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvCheckbox` | Component | Standalone checkbox — `mlv-checkbox` |
| `MlvCheckboxState` | Type | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` (alias of `MlvFormState`) |
| `MlvCheckboxGroup` | Component | Group container — `mlv-checkbox-group` |
| `MlvCheckboxGroupState` | Type | Same values as `MlvCheckboxState` (alias of `MlvFormState`) |

---

## Components

### `MlvCheckbox`

**File:** `libs/core/checkbox/src/lib/checkbox/checkbox.ts`
**Template:** `libs/core/checkbox/src/lib/checkbox/checkbox.html`
**Styles:** `libs/core/checkbox/src/lib/checkbox/checkbox.scss`

- **Selector:** `mlv-checkbox`
- **Change Detection:** `OnPush`
- **Extends:** `MlvSignalCheckboxControlBase` from `@malva-ui/core/form-utils` (signal forms — no `ControlValueAccessor`)
- **Focus management:** `MlvCheckboxGroup` adapts checkbox instances to `FocusKeyManager` and uses `computedDisabled()` as the skip predicate, preserving `[disabled]` as a signal input.

#### Inputs

| Name             | Type                  | Default     | Description                                                                                                                                                                                                                                                                                                                              |
| ---------------- | --------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `indeterminate`  | `boolean` (coerced)   | `false`     | Mixed state: minus icon, `mlv-checkbox--indeterminate` host class, `aria-checked="mixed"`. The native `input.indeterminate` DOM property is written from an `afterRenderEffect`, **not** a template binding — see the SSR note below.                                                                                                    |
| `disabled`       | `boolean`             | `false`     | Disables the checkbox                                                                                                                                                                                                                                                                                                                    |
| `tabbable`       | `boolean` (coerced)   | `true`      | When `false`, forces the native input to `tabindex="-1"` regardless of group roving state. Composite parents (`mlv-tree` multi-select rows, `mlv-data-table` rows) set `[tabbable]="false"` to keep a single tab stop while the checkbox stays operable via the row (Space) and the mouse.                                               |
| `label`          | `string`              | `''`        | **Visible** label text, rendered inside the `<label>` when nothing is projected into `<mlv-checkbox>`. Projected content always wins: the fallback stays in the DOM but is `display: none`-d by `.mlv-checkbox__content:not(:empty) + .mlv-checkbox__label-text`, so it never joins the accessible name. Inherited from the signal base. |
| `required`       | `boolean` (coerced)   | `false`     | Sets `aria-required` on the native input. Also a signal-forms field binding. Inherited from the signal base.                                                                                                                                                                                                                             |
| `ariaLabel`      | `string \| null`      | `null`      | Accessible name applied to the inner native input. Use for dynamic labels; wins over a captured static host `aria-label` (see the naming note above). Inherited from the signal base since 2026-08 (was a checkbox-local input).                                                                                                         |
| `ariaLabelledBy` | `string \| undefined` | `undefined` | Id reference(s) naming the inner native input. Same rationale/precedence as `ariaLabel`.                                                                                                                                                                                                                                                 |
| `state`          | `MlvCheckboxState`    | `'default'` | Visual state                                                                                                                                                                                                                                                                                                                             |

#### Inputs (inherited from `MlvSignalFormUiControlBase`)

| Name          | Type                                               | Default                    | Description                                                                      |
| ------------- | -------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| `readonly`    | `boolean`                                          | `false`                    | Read-only control; also a signal-forms field binding.                            |
| `loading`     | `boolean`                                          | `false`                    | Shows the loading affordance.                                                    |
| `clearable`   | `boolean`                                          | `false`                    | Renders the clear (X) affordance while the control has a value.                  |
| `pill`        | `boolean`                                          | `false`                    | Fully rounded (stadium) control container.                                       |
| `errors`      | `readonly ValidationError.WithOptionalFieldTree[]` | `[]`                       | Signal-forms field binding: current validation errors.                           |
| `touched`     | `boolean`                                          | `false`                    | Signal-forms field binding: whether the bound field is touched.                  |
| `dirty`       | `boolean`                                          | `false`                    | Signal-forms field binding: whether the bound field is dirty.                    |
| `id`          | `string`                                           | `mlvNextId('mlv-control')` | HTML id applied to the control's focus target.                                   |
| `hint`        | `string`                                           | `''`                       | Hint text rendered inside the label.                                             |
| `description` | `string`                                           | `''`                       | Persistent help text rendered below the control (`<mlv-description>` slot wins). |
| `message`     | `string`                                           | `''`                       | Validation/status message rendered below the control.                            |

#### Model (two-way binding)

| Name      | Type      | Default |
| --------- | --------- | ------- |
| `checked` | `boolean` | `false` |

#### Outputs

| Name            | Type      | Description                                                                                 |
| --------------- | --------- | ------------------------------------------------------------------------------------------- |
| `checkedChange` | `boolean` | The `checked` model's change output.                                                        |
| `touch`         | `void`    | Inherited. Emitted on blur — the signal-forms replacement for the CVA `onTouched` callback. |

#### Host Bindings

```ts
host: {
  'class': 'mlv-checkbox',
  '[class.mlv-checkbox--disabled]': 'computedDisabled()',
  '[class.mlv-checkbox--checked]': 'checked()',
  '[class.mlv-checkbox--indeterminate]': 'indeterminate()',
}
```

The host is **not** focusable. The single focus target is the visually-hidden
native `<input type="checkbox">` (clip-path pattern, kept in the a11y tree). Its
`tabindex` is `_resolvedTabIndex()` — the roving tabindex (`tabIndex` signal,
managed by `MlvCheckboxGroup` and updated as focus moves) gated by the
`tabbable` input.

#### Key Methods

- `focus()` — Focuses the native input (not the host); adapts to CDK `FocusKeyManager`.
- `toggle(event)` — Toggle checked state (bound to the input's Enter keydown)
- `onInputChange(event)` — Reflects native `change` (Space / click)
- `setFocused(focused)` — Inherited from the signal base; updates the focus signal driving the wrapper state.

There is no `writeValue`/`setDisabledState` pair any more: the control is a
signal-forms field, not a `ControlValueAccessor` (see the 2026-07 cutover note).

#### Keyboard & Focus

- **Single tab stop:** the native input carries the roving tabindex; the host is not tabbable (no more double tab stop).
- **Space** toggles natively (fires `change`); **Enter** toggles via the input's `(keydown.enter)`.
- **`:focus-visible`** ring is promoted from the hidden input onto `.mlv-checkbox__visual` using `--mlv-border-focus`.

#### Template Summary

Label wrapping the visually-hidden native checkbox (`#nativeInput`, `[attr.tabindex]="_resolvedTabIndex()"`) + visual element with dynamic icon (check or minus for indeterminate) + `.mlv-checkbox__text`, which holds `.mlv-checkbox__content` (`ng-content`) followed by the `.mlv-checkbox__label-text` fallback rendered from the `label` input. ARIA attributes on the native input: `aria-checked`, `aria-required`, plus `aria-label` / `aria-labelledby` forwarded from the host (see the forwarding note above).

A dev-mode `console.warn` fires once per instance when a checkbox has no projected text, no `label`, and no `ariaLabel`/`ariaLabelledBy` — i.e. no accessible name at all.

#### `indeterminate` and SSR (issue #124)

`indeterminate` is a DOM property with **no HTML attribute** behind it, so it is
the one part of the native input a template property binding cannot carry.

- A `[indeterminate]` binding logged **NG0303 on every server render, per
  instance** — one line per row of a checkbox column. The check Angular runs is
  `'indeterminate' in element`, true in a browser and false on domino's
  `HTMLInputElement`, which is why no browser test ever saw it.
- NG0303 goes to **`console.error`, not the `ErrorHandler`**
  (`reportUnknownPropertyError` only throws under `TestBed`'s
  `errorOnUnknownProperties`). `libs/core/src/ssr-smoke.spec.ts` now captures
  both channels; its `binds no property the server DOM does not have` case is
  the regression guard.
- The property is written from an **`afterRenderEffect`** in the constructor:
  it never runs on the server, so the error class is gone by construction
  rather than suppressed, and it re-runs when `indeterminate()` changes — which
  a one-shot `afterNextRender` would not.
- The **visible** tri-state was never affected and is asserted in the SSR
  suite: `aria-checked="mixed"`, the `mlv-checkbox--indeterminate` host class
  and the minus glyph are all attribute/class/template driven. No stylesheet
  selects `:indeterminate`, and the native input is visually hidden, so the DOM
  property is only read by assistive tech and by code inspecting
  `input.indeterminate`.

---

### `MlvCheckboxGroup`

**File:** `libs/core/checkbox/src/lib/checkbox-group/checkbox-group.ts`

- **Selector:** `mlv-checkbox-group`
- **Change Detection:** `OnPush`
- **Extends:** `MlvFocusableGroupBase<MlvCheckbox>` from `@malva-ui/core/form-utils` — the shared roving-tabindex `FocusKeyManager` lifecycle (arrow nav, `change`→tabindex sync, teardown) lives in the base; the group only supplies `_items` (projected checkboxes) + `_isDisabled` (`computedDisabled()`).
- **Template:** Inline — `div[role="group"]` with optional label + `<ng-content>`

#### Inputs

| Name    | Type                    | Default     |
| ------- | ----------------------- | ----------- |
| `label` | `string`                | `''`        |
| `state` | `MlvCheckboxGroupState` | `'default'` |

#### Methods (inherited from `MlvFocusableGroupBase`)

| Method                            | Description                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `onChildFocus(child)`             | Marks the focused child active in the `FocusKeyManager` (roving tabindex).         |
| `onKeydown(event: KeyboardEvent)` | Forwards arrow/Home/End keys to the `FocusKeyManager`, skipping disabled children. |

#### Keyboard Navigation

`FocusKeyManager` (from `MlvFocusableGroupBase`) — arrow up/down navigates between child checkboxes, skips disabled via `computedDisabled()`, and the base's `change`-sub keeps the roving `tabindex=0` on the focused checkbox.

#### Internal Token

`CHECKBOX_GROUP: InjectionToken<MlvCheckboxGroupAccessor>` — injected by children to notify parent of focus events.

---

## Usage Examples

```html
<!-- Standalone -->
<mlv-checkbox [(checked)]="isChecked">Accept terms</mlv-checkbox>

<!-- Indeterminate -->
<mlv-checkbox [indeterminate]="true">Select all</mlv-checkbox>

<!-- Grouped -->
<mlv-checkbox-group label="Preferences">
  <mlv-checkbox [(checked)]="opt1">Option 1</mlv-checkbox>
  <mlv-checkbox [(checked)]="opt2">Option 2</mlv-checkbox>
</mlv-checkbox-group>

<!-- Reactive forms -->
<mlv-checkbox [formControl]="ctrl">Subscribe</mlv-checkbox>
```

---

## Testing

- Unit tests run through `libs/core/checkbox/vite.config.mts` with the shared Analog/Vitest Angular test setup in `src/test-setup.ts`.

---

## Dependencies

- `@angular/core`, `@angular/forms` — CVA, form integration
- `@angular/cdk/a11y` — `FocusableOption`, `FocusKeyManager`
- `@lucide/angular` — `LucideCheck`, `LucideMinus` icons
- `@malva-ui/core/form-utils` — `MlvLabel`

## Label type scale (2026-08-26)

`.mlv-checkbox` now carries the shared control-text ramp (CH-R3) via
`density.density-*` mixins — `--mlv-font-size-s` (tight) / `-m` (compact,
comfortable) / `-l` (spacious) / `-xl` (airy) — so the label reads at the
same size as an input's text or a select's trigger text at every density.
Previously it had none: the label's font-size fell back to whatever ambient
context it sat in, which is what made it visibly mismatch other controls in
the same form. See `.claude/projects/libs-form-utils.md` → _Control-text
type & padding ramp_. The swatch geometry (`__visual`) is unaffected — it is
sized in fixed `rem`, not `em`, and does not respond to density.
