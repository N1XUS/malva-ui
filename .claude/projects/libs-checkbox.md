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
| `state`          | `MlvCheckboxState`    | `'default'` | Validation state. Only `error` paints (error border on the swatch) and sets `aria-invalid`; an explicit non-default value wins over the bound field's — see _Validation state (#320)_                                                                                                                                                    |

#### Inputs (inherited from `MlvSignalFormUiControlBase`)

| Name          | Type                                               | Default                    | Description                                                                                                                                                                                                                                                                                           |
| ------------- | -------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `readonly`    | `boolean`                                          | `false`                    | Read-only control; also a signal-forms field binding.                                                                                                                                                                                                                                                 |
| `loading`     | `boolean`                                          | `false`                    | Shows the loading affordance.                                                                                                                                                                                                                                                                         |
| `clearable`   | `boolean`                                          | `false`                    | Renders the clear (X) affordance while the control has a value.                                                                                                                                                                                                                                       |
| `pill`        | `boolean`                                          | `false`                    | Fully rounded (stadium) control container.                                                                                                                                                                                                                                                            |
| `errors`      | `readonly ValidationError.WithOptionalFieldTree[]` | `[]`                       | Signal-forms field binding: current validation errors.                                                                                                                                                                                                                                                |
| `touched`     | `boolean`                                          | `false`                    | Signal-forms field binding: whether the bound field is touched.                                                                                                                                                                                                                                       |
| `dirty`       | `boolean`                                          | `false`                    | Signal-forms field binding: whether the bound field is dirty.                                                                                                                                                                                                                                         |
| `id`          | `string`                                           | `mlvNextId('mlv-control')` | HTML id of the native input (the focus target); `<id>-description` and `<id>-message` follow it. The own wrapping `<label>` names the input by containment and carries no `for`. Static or bound, tracked on change; a static host `id` attribute is moved off the host — see _Consumer `id` (#323)_. |
| `hint`        | `string`                                           | `''`                       | Inherited but **not rendered** by the checkbox (follow-up to #320).                                                                                                                                                                                                                                   |
| `description` | `string`                                           | `''`                       | Help text rendered under the label text as `.mlv-checkbox__description`, outside the `<label>`, and referenced from the native input’s `aria-describedby` (#320; before, not rendered).                                                                                                               |
| `message`     | `string`                                           | `''`                       | Validation / status message rendered after the description as `.mlv-checkbox__message` (state follows `resolvedState()`), outside the `<label>`, and referenced from `aria-describedby` (#320; before, not rendered).                                                                                 |

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
native `<input type="checkbox">` (clip-path pattern, kept in the a11y tree).
The host is `position: relative` so that absolutely positioned input is
contained by the checkbox — otherwise, in a drawer or dialog body, it lands
in the scrollbar host outside the scroll viewport and a click on the label
scrolls the `overflow: hidden` body to it. Its
`tabindex` is `_resolvedTabIndex()` — the roving tabindex (`tabIndex` signal,
managed by `MlvCheckboxGroup` and updated as focus moves) gated by the
`tabbable` input.

#### Key Methods

- `focus()` — Focuses the native input (not the host); adapts to CDK `FocusKeyManager`.
- `toggle(event)` — The input's `(keydown.enter)` handler, not an application API: a user write through `_write()`, refused while readonly or disabled; always `preventDefault()`s. Set the state from code by writing `checked` (readonly does not lock out the application). Contrast `MlvSwitch.toggle()`, which is the app API and stays disabled-only (#298 owner ruling).
- `onInputChange(event)` — Reflects native `change` (Space / click); a refused write puts `input.checked` back to `checked()`
- `setFocused(focused)` — Inherited from the signal base; updates the focus signal driving the wrapper state.

There is no `writeValue`/`setDisabledState` pair any more: the control is a
signal-forms field, not a `ControlValueAccessor` (see the 2026-07 cutover note).

#### Keyboard & Focus

- **Single tab stop:** the native input carries the roving tabindex; the host is not tabbable (no more double tab stop).
- **Space** toggles natively (fires `change`); **Enter** toggles via the input's `(keydown.enter)`.
- **Readonly** (#298): a native checkbox ignores the `readonly` attribute, so the component enforces it. The native input's `(click)` is `preventDefault()`ed while `!_canWrite()` — the browser then restores `checked` and fires no `change`, which covers a click on the box, a click on the label and Space (Space activates through a synthetic click). `toggle()` / `onInputChange()` write through `_write()`; a `change` that arrives anyway is rolled back in the DOM. The input stays focusable (no `disabled`, tabindex unchanged) and `indeterminate` is kept. `aria-readonly="true"` on the native input while readonly (the checkbox role supports it); no attribute otherwise.
- **`:focus-visible`** ring is promoted from the hidden input onto `.mlv-checkbox__visual` using `--mlv-border-focus`.

#### Template Summary

Label wrapping the visually-hidden native checkbox (`#nativeInput`, `[attr.tabindex]="_resolvedTabIndex()"`) + visual element with dynamic icon (check or minus for indeterminate) + `.mlv-checkbox__text`, which holds `.mlv-checkbox__content` (`ng-content`) followed by the `.mlv-checkbox__label-text` fallback rendered from the `label` input. ARIA attributes on the native input: `aria-checked`, `aria-required`, `aria-readonly` (while readonly), `aria-invalid` (while `resolvedState()` is `error`) and `aria-describedby` (`_describedBy()`: own description, own message, enclosing field's error), plus `aria-label` / `aria-labelledby` forwarded from the host (see the forwarding note above). After the `<label>`: `<mlv-description>` and `<mlv-message>` when their inputs are set.

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

| Method                            | Description                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `onChildFocus(child)`             | Marks the focused child active in the `FocusKeyManager` (roving tabindex).       |
| `onKeydown(event: KeyboardEvent)` | Forwards ArrowUp/ArrowDown to the `FocusKeyManager`, skipping disabled children. |

#### Keyboard Navigation

`FocusKeyManager` (from `MlvFocusableGroupBase`) — arrow up/down navigates between child checkboxes, skips disabled via `computedDisabled()`, and the base keeps the roving `tabindex=0` on the focused checkbox.

- **Tab stop (#307):** the focused checkbox, else the first **enabled** one — never a disabled checkbox, which cannot take focus (a disabled first checkbox used to leave the group with no tab stop at all). The focused checkbox turning disabled hands the stop to the next enabled one after it (wrapping), not the first; adding/removing a checkbox keeps the user's stop and arrow position. Contract: `libs-form-utils.md` § _Focusable group base_.
- Covered by `checkbox-group.spec.ts` — a `@for` "Notification channels" host with a disabled first option: initial stop, the focused checkbox's stop handed on when it is disabled, the next enabled checkbox after the focused one (not the first, wrapping at the end) taking it, all-disabled → none → re-enabled, stop + arrow position kept across an added checkbox, axe sweep of the disabled-first state.

#### Internal Token

`CHECKBOX_GROUP: InjectionToken<MlvCheckboxGroupAccessor>` — injected by children to notify parent of focus events.

#### It is the control an `mlv-form-field` resolves (2026-09, #217)

The group also provides `MLV_FORM_CONTROL`, `useExisting` itself, and
`implements MlvFormControl`. Without it the field's
`contentChild(MLV_FORM_CONTROL)` — `descendants: true` by default — walked
past the group and resolved the **first projected `mlv-checkbox`** instead, so
a projected `<mlv-label>` could point its `for` at a nested control and the
group's own `<mlv-label>` (rendered from `label`) could borrow the field's
target from an unrelated sibling control. See
`.claude/projects/libs-form-utils.md` § _The field resolves the outermost
control_.

The group is a labelled region, not an editable control, so the **nine**
wrapper-facing halves of `MlvFormControl` it does not own — `focused`,
`disabled`, `readonly`, `loading`, `clearable`, `hasValue`, `prepend`,
`append`, `inset` — are constant, non-input signals. They exist so the
`implements` clause type-checks the contract: an `ExistingProvider`'s
`useExisting` is typed `any`, and `mlv-form-control-wrapper` calls several
of them unguarded. `state` and `label` are the group's real inputs and answer
for themselves.

They are public members on an exported class, and that has one consumer-visible
cost: `group.disabled()` on a `viewChild(MlvCheckboxGroup)` **used to be a
compile error** and now compiles and always answers `false`. None of the nine is
an `input()`, so `[disabled]="…"` on the element still fails AOT with NG8002 —
only the TypeScript read changed, and it changed from loud to silent. Read
`computedDisabled()` on the individual `mlv-checkbox` children instead. Hiding
them is not available: `implements` requires public members, and widening
`MlvFormControl`'s own members to optional would break every consumer calling
`inject(MLV_FORM_CONTROL).focused()` under `strictNullChecks`.

#### The group takes its accessible name from the field's label

`labelTarget` reports `{ id, labelable: false }`, `id` being the **inner
`<div role="group">`** — the host carries no role, so an id on it would name a
roleless element. `labelable: false` is what makes `mlv-form-field` emit no
`for`: a `<label for>` names only `button`/`input`/`meter`/`output`/`progress`/
`select`/`textarea`. The group consumes the label through `aria-labelledby`
instead, which is the association WAI-ARIA prescribes for a group and the same
shape `mlv-radio-group` ships:

```html
[attr.aria-labelledby]="label() ? _labelId : _fieldLabelId()"
```

A label written on the group wins over one projected beside it, because it is
the nearer, explicitly-authored name. `aria-label` is gone: it duplicated the
rendered `<mlv-label>`, `aria-labelledby` outranks it anyway, and it was bound
without `|| null`, so an empty `label` emitted a meaningless `aria-label=""`.

Pinned by `checkbox-group-field-label.spec.ts`, whose
`reports the element that carries role="group" as its label target` case fails
when the id is emitted on the host instead of the `<div>`.

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
- `checkbox-id.spec.ts` (#323) — static and bound `id` land on the native input (description / message ids and `aria-describedby` follow a change; the own label names it by containment, no `for`), `@for` ids, generated default kept, host carries no id, two checkboxes sharing an id and an id clashing with an earlier element each keep their own label (click toggles its own control), `getElementById` returns the input, an external `<mlv-label for>` in a field names it (`label.control`), no unnamed-warning then; full axe sweep plus `runAxe` incomplete check for `duplicate-id-aria` (a `reviewOnFail` rule — `expectNoAxeViolations` cannot see a duplicate id). `libs/core/src/ssr-smoke.spec.ts` pins the server payload.
- `checkbox-validation.spec.ts` (#320) — error visual + `aria-invalid` after a touched `required()` field, cleared once checked; explicit `state` (`error` only claims invalidity); description / message outside the label and in `aria-describedby`; the enclosing field's error id; axe sweep of the error state; compiled SCSS pins the error token and no success / warning / info tint.
- `checkbox-readonly.spec.ts` (#298) — click, label click, Enter and a stray `change` refused while readonly and while disabled; cancelled click, `indeterminate` kept, `aria-readonly`, focusability, a signal-forms `readonly()` rule; axe sweeps of readonly unchecked / checked.

---

## Dependencies

- `@angular/core`, `@angular/forms` — CVA, form integration
- `@angular/cdk/a11y` — `FocusableOption`, `FocusKeyManager`
- `@lucide/angular` — `LucideCheck`, `LucideMinus` icons
- `@malva-ui/core/form-utils` — `MlvSignalCheckboxControlBase`, `MlvDescription`, `MlvMessage`

## Consumer `id` (2026-09, #323)

- **`id` lands on the native input.** Template binds `[id]="id()"` reactively. Before, `readonly inputId = this.id()` was a field initializer — it ran before Angular set inputs, froze the generated `mlv-control-N`, and a consumer id never reached the input (static stayed on the host; bound landed nowhere, `@for` rows included).
- **`inputId`** is now a getter returning `id()` — same public name and `string` type, tracks changes.
- **The own `<label>` carries no `for`** — it names the input it wraps by containment. Main bound `[for]` to the unique generated id; a `for` carrying the consumer's id would hand the association to whichever element that id resolves to first. With two instances sharing `id="remember"`, the second one's text click would toggle the **first** control and its input would have no label (`labels.length` 1 → 0); an earlier element with the same id, or `id=""`, would leave the input nameless (review round 1, pinned by `checkbox-id.spec.ts`). A template comment keeps it out.
- **Static host `id` is stripped** in the constructor (`HostAttributeToken('id')` + `Renderer2.removeAttribute`, same shape as the `aria-label` move). Angular feeds a static attribute to the input **and** leaves it on the element; kept, it would duplicate the input's id — and `<label for>` / `getElementById` resolve the **first** match in tree order, the host, so an external label would still name nothing (measured by ablation). A bound `[id]` never lands on the host. `null` for a `createComponent(…, { hostElement })` root host → its own id left alone.
- **Effect:** `getElementById('terms')`, an external `<label for="terms">` / `<mlv-label for="terms">`, `aria-controls` and `aria-errormessage` reach the focusable input. That is the manual route `mlv-form-field`'s "names nothing" warning recommends for a `'none'` control — broken for checkbox / switch until now. `labelTarget()` stays `null` (strategy unchanged, `'none'`).
- **Dev warning:** `_warnWhenUnlabelled` also accepts an external `<label>` with text (`input.labels` minus the own wrapper) — otherwise a checkbox named only by a field's `<mlv-label for>` warned falsely. Still one-shot at first render (`afterNextRender`): an external label that renders later (an `@if` turning true) still gets the warning.
- Breaking, behaviour only (the host no longer carries a static id): `docs/migrations/2026-09-checkbox-switch-consumer-id.md`.

## Validation state (2026-09, #320)

- **The swatch follows `resolvedState()`**, not `state()` — `.mlv-checkbox__visual--<state>`. Before, it read the raw input, so a touched invalid `[formField]` never showed anything; an explicit non-default `state` still wins, as everywhere.
- **Only `error` paints**: `.mlv-checkbox__visual--error` sets `--check-border-color: var(--mlv-border-error)`. Declared on the swatch, so it outranks the host's hover and checked values of the same property — the box stays red under the pointer and after it is ticked. `success` / `warning` / `info` emit a class and no rule (SF-R6); their meaning lives in `mlv-message`.
- **`aria-invalid="true"`** on the native input while `resolvedState()` is `error`; no attribute otherwise (never `"false"`).
- **`description` and `message` render** — the inherited-table rows always said they did, and the template never had them. They sit after the `<label>`, so neither joins the accessible name, indented past the 1.5rem swatch + label gap (`padding-inline-start`, logical, mirrors in RTL).
- **`aria-describedby`** = `_describedBy()`: own description, own message, then the enclosing `mlv-form-field`'s error message id — see `libs-form-utils.md` § _Field error association and `aria-invalid`_.
- `MlvCheckboxGroup` is unchanged: its `state` input still paints nothing (follow-up).

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

**Which level (#364).** `mlv-checkbox` hosts `MlvDensityDirective` with its
`mlvDensity` input (`MLV_DENSITY_ELEMENT` `'checkbox'`) and stamps
`mlv-checkbox--<density>` from its own `mlvDensity`, else the nearest density
scope, else `MlvDensityService`. Before it was CSS-only, so a nested scope
resolved by stylesheet order (a checkbox in `spacious > compact` read 16px).
New public input: `mlvDensity: MlvDensity | undefined`. `mlv-checkbox-group`
is unchanged. Pinned by `checkbox-density.spec.ts`.

## Disabled surface (2026-09, #366)

- `.mlv-checkbox--disabled` was a host `opacity: var(--mlv-disabled-opacity)`; now a declared surface (SF-R4): `--check-background: var(--mlv-background-disabled)`, `--check-border-color: var(--mlv-border-normal)` (resets a checked accent border), check glyph `--mlv-text-disabled`, and the label remaps `--mlv-text-primary` → `--mlv-text-disabled` (inner BEM text reads the token through the global `[class*='mlv']` rule, not the host `color`).
- Emitted after `--checked`, so a checked disabled box takes the disabled fill. The error border (`__visual--error`) is kept.
- Glyph on box, before → after: light 1.71 → 3.76, dark 2.34 → 3.44, HC 2.59 → 3.72. Label on page: light 2.53 → 4.54, dark 3.82 → 3.78.
- Spec: `checkbox-disabled-styles.spec.ts`.
- Guard: `styles:check-disabled-surface` (`scripts/check-disabled-surface.mjs`, a `styles:lint` dependency) fails any other disabled `opacity` and any `--state-success/warning/info` rule.
