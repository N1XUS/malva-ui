# 2026-09 — `mlv-form-field` associates its label with its control

Applies to `@malva-ui/core/form-utils` (`MlvFormField`, `MlvLabel`,
`MlvSignalFormUiControlBase`, `MlvFormControl`) and every control that renders
through them — `mlv-input`, `mlv-textarea`, `mlv-number-input`,
`mlv-combobox`, `mlv-tokenizer`, `mlv-color-picker-popup`, `mlv-title`,
`mlv-select`, `mlv-day-picker`, `mlv-time-picker`, `mlv-date-range-picker`,
`mlv-radio-group`. Fixes #197.

**Behaviour only, no removals.** Nothing exported was renamed, removed or
retyped; the barrel only **gains** `MLV_FORM_FIELD`, `MlvFormFieldAccessor`,
`MlvFormControlLabelStrategy` and `MlvFormControlLabelTarget`, and
`MlvFormControl` gains two optional members (`labelTarget`, `label`) that every
Malva control already inherits. Most consumers get an accessible name they did
not have and edit nothing. The four shapes that need a decision are in §3.

## 1. What changed

Until now `mlv-form-field` laid a projected `<mlv-label>` out above the control
and did nothing else with it: no `labelId`, no `aria-labelledby`, no `for`
plumbing. The documented compose-a-field pattern therefore shipped controls
with **no accessible name** — a real WCAG 4.1.2 defect, and the shape axe's
`label` / `aria-input-field-name` rules report. It shipped that way in
`apps/docs` (`pages/form-field/examples/1`, `…/3`, `pages/action-bar/examples/2`).

| Before                                                                                                 | After                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<mlv-label>` always rendered `for=""` when the consumer gave no `for`                                 | No `for` **attribute at all** unless one resolves. An explicit `[for]` still wins and is never rewritten                                          |
| A projected `<mlv-label>` named nothing                                                                | The field resolves the association, and the **control** chooses how, through `_externalLabelStrategy()`                                            |
| Nothing warned when a field's label named nothing                                                      | Two dev-mode warnings, each once per control class: "names nothing", and "two labels"                                                             |
| `mlv-title`'s editing `<textarea>` carried no `id`                                                     | It carries `` `${id()}-input` `` — **derived from** `id`, not equal to it (see §3)                                                                |
| `mlv-time-picker` / `mlv-date-range-picker` / `mlv-radio-group` announced a generic string or `ariaLabel` while showing their own `label` | Each carries a public `labelId` and announces its own visible `label` through `aria-labelledby`                                                   |

The three strategies:

| Strategy   | Association                                        | Controls                                                                                                                                                                                       |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'native'` | the field resolves the label's `for`               | `mlv-input` (unless `projectControl`), `mlv-textarea`, `mlv-number-input`, `mlv-combobox`, `mlv-tokenizer` (while enabled), `mlv-color-picker-popup` (`field`), `mlv-title` (while `editable`), `mlv-select` while its native `<select>` is live |
| `'aria'`   | the control points `aria-labelledby` at the label  | `mlv-select`'s custom trigger, `mlv-day-picker`, `mlv-time-picker`, `mlv-date-range-picker`, `mlv-radio-group`                                                                                  |
| `'none'`   | nothing is emitted, and the field warns in dev     | the base default: `mlv-checkbox`, `mlv-switch`, `mlv-slider`, `mlv-pin-input`, `mlv-file-upload`, `mlv-color-picker`, `mlv-segmented`, `mlv-rating`, `mlv-editor`                              |

`<label for>` only names an HTML **labelable** element (`button`, `input`,
`meter`, `output`, `progress`, `select`, `textarea`). It cannot name
`mlv-select`'s `div[role="combobox"]` or a `role="radiogroup"` host, and
pointing it there is worse than omitting it: the label reads as associated in
review while focusing nothing. That is why the two halves are not
interchangeable and why `'none'` emits nothing rather than a best guess.

Contract, mechanism and the member table:
`.claude/projects/libs-form-utils.md` § _`MlvFormField` → Accessible name_.

## 2. Nothing to migrate for the common case

```html
<!-- Unchanged source; the input now has the accessible name "Full Name". -->
<mlv-form-field>
  <mlv-label>Full Name <mlv-hint>Required</mlv-hint></mlv-label>
  <mlv-input [formField]="fields.name" placeholder="Enter your full name" />
</mlv-form-field>
```

An `ariaLabel` you added **because** the control had no name can go:

```html
<mlv-form-field>
  <mlv-label>Country</mlv-label>
  <!-- ariaLabel="Country" was a workaround; delete it. -->
  <mlv-select [formField]="fields.country" [options]="countries" />
</mlv-form-field>
```

## 3. Decide

- **You bind `ariaLabel` on an `'aria'` control inside a field that also
  projects an `<mlv-label>`.** The field's label now **wins** — the trigger
  binds `aria-labelledby` and suppresses `aria-label`. Where the two say the
  same thing (the usual case) delete the `ariaLabel`. Where they deliberately
  differ, move the intended wording into the `<mlv-label>`, or drop the
  projected label and keep `ariaLabel`.
- **You project an `<mlv-label>` *and* set the control's own `label` input.**
  You now get a dev-mode warning and two visible labels. On a `'native'`
  control both `<label>` elements carry the same `for`, so the accessible name
  is their concatenation ("Start Meeting time"); on an `'aria'` control the
  projected one names nothing. Keep exactly one.
- **You wrap a `'none'` control in a field and rely on the projected label.**
  Nothing is emitted and you now get a warning. Give the control its own
  `label` / `ariaLabel`, or wire `[for]` on the `<mlv-label>` and a matching
  `[id]` on the control by hand.
- **You read `mlv-title`'s `id` off the DOM, or bind `[id]` on it.** The
  editing `<textarea>` carries `` `${id()}-input` ``, not `id()`. The host
  keeps whatever `id` attribute you wrote on it — which is the point: a
  **static** `id="…"` attribute is both bound to the inherited `id` input and
  left on the heading by the compiler, so reusing it would put one id on two
  elements and make a `<section aria-labelledby="…">` reference ambiguous.
- **You assert on `label[for=""]` in your own tests.** The attribute is now
  absent, not empty. `label.hasAttribute('for')` is the assertion that holds.
- **You implement `MlvFormControl` yourself** (no Malva base class). Both new
  members are optional; a connector that omits them reports "no label target"
  and is treated as `'none'`.

## 4. Known follow-ups

- `mlv-select`, `mlv-day-picker`, `mlv-time-picker`, `mlv-date-range-picker`
  and `mlv-combobox` still render their **own** `<mlv-label [for]="id()">`
  onto a non-labelable element. `mlv-select` mitigates the focus half with a
  click handler; the other four do not. The `labelTarget.labelable` mechanism
  that would fix it now exists and is unused there — tracked separately, since
  it changes five components' own label semantics.
- `mlv-checkbox-group` and `mlv-switch-group` do not provide
  `MLV_FORM_CONTROL`, so a field containing one resolves
  `contentChild(MLV_FORM_CONTROL)` to the first nested `<mlv-checkbox>`
  (`descendants: true` is the default). Latent — tracked separately.
- `mlv-select`'s strategy keys off the viewport (`isDown('md')`), which the
  server does not have, so the `for` ↔ `aria-labelledby` choice can differ
  between the server render and hydration. Attribute-level only; tracked
  separately.
