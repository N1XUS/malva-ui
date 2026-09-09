# 2026-09 — the checkbox and switch groups become the control a field resolves, and gain a name

Applies to `@malva-ui/core/checkbox` (`MlvCheckboxGroup`),
`@malva-ui/core/switch` (`MlvSwitchGroup`) and `@malva-ui/core/file-upload`
(`MlvFileUpload`). Fixes #217.

**Breaking, behaviour only.** No exported symbol was renamed, removed or
retyped. No barrel changes. No input, output, model, injection token or i18n
key changes; `MlvFormControl`, `MlvFormFieldAccessor` and
`MlvFormControlLabelTarget` keep the shapes #197 gave them. The three classes
each gain a `providers` entry, the two groups gain public members, and four
consumer-reachable behaviours change at an unchanged API.

`VERSIONING.md` § 3 puts that at a major: _"Changed **default behaviour** at an
unchanged API — ordering, timing, emitted events, focus, ARIA, what a value
means"_. Nothing in `libs/` or `apps/docs` renders any of the three inside an
`mlv-form-field`, so **no in-repo markup changes** — but "no in-repo consumer"
is not the test this repository applies. #216 shipped one commit earlier under
the same rule, and its own migration records zero in-repo consumers of the
attribute it changed.

---

## 1. The ticket's premise was wrong, and the corrected census is smaller

#217 was filed as "three components are missing the `MLV_FORM_CONTROL`
provider". Only one of the three is an omission:

| Component            | What it actually is                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `mlv-file-upload`    | **A true omission.** It is one of 21 `MlvSignalFormUiControlBase` subclasses; the other 20 all provided the token. It did not.          |
| `mlv-checkbox-group` | **Not a form control at all.** It extends `MlvFocusableGroupBase` — a roving-tabindex helper — and holds no value, so nothing was owed. |
| `mlv-switch-group`   | Likewise.                                                                                                                               |

The groups are still fixed, because "not a form control" is not the same as
"not the thing an `mlv-form-field` should resolve". `MlvFormField._control` is
`contentChild(MLV_FORM_CONTROL)`, which defaults to `descendants: true` — so
with nothing provided on a group the query walked **past** it and matched the
first projected `mlv-checkbox` / `mlv-switch` instead. But the fix is a
deliberate implementation of the connector contract, not a missing line.

## 2. What changed

### 2.1 A projected `<mlv-label>`'s `for` disappears

`MlvFormField.labelableControlId()` is the id the projected `<mlv-label>`
renders as `for`, and it comes from the resolved control's
`labelTarget().labelable`. With the groups invisible to the query it came from
a nested or adjacent control.

| Composition                                                | `for` before                 | `for` after |
| ---------------------------------------------------------- | ---------------------------- | ----------- |
| field › label + `mlv-checkbox-group` › a labelable control | that nested control's id     | absent      |
| field › label + `mlv-switch-group` › a labelable control   | that nested control's id     | absent      |
| field › label + `mlv-file-upload` + a labelable control    | the **sibling** control's id | absent      |
| field › label + either group (no nested labelable control) | absent                       | absent      |

`label.hasAttribute('for')` is the assertion that holds — see #197, which
established that emitting a `for` naming nothing is worse than emitting none.

### 2.2 A group's **own** `<mlv-label>` stops emitting a `for`, and stops being clickable

`MlvLabel` injects `MLV_FORM_CONTROL` optionally as `_ownerControl`; that is
what stops a control's own inner label borrowing the field's target. With the
groups providing nothing, the `<mlv-label>` a group renders from its `label`
input resolved `null` and fell through to `MlvFormField.labelableControlId()` —
the id of an entirely different control.

| Composition                                                   | Group's own label `for` before | After  |
| ------------------------------------------------------------- | ------------------------------ | ------ |
| field › `mlv-input` + `<mlv-checkbox-group label="Toppings">` | the `mlv-input`'s id           | absent |
| field › `mlv-input` + `<mlv-switch-group label="Notify me">`  | the `mlv-input`'s id           | absent |

Clicking "Toppings" focused the text input. It now focuses nothing — the group
is not a focus target, and its members each are.

### 2.3 `inject(MLV_FORM_CONTROL)` inside any of the three resolves a different object

Anything rendered inside a group or an upload zone that injects the token —
`<mlv-label>` does, and a consumer's own directive may — used to resolve the
nearest **ancestor** provider, i.e. the enclosing field's other control, or
`null`. It now resolves the group / the upload zone. Injecting it with
`{ optional: true }` and getting `null` is no longer possible inside these
three.

### 2.4 New: the two groups take an accessible name from the field's label

This is the half that is a gain rather than a removal, and it is why the fix is
not just three provider lines.

`aria-labelledby` names a `role="group"` from outside, and `MlvRadioGroup` has
done exactly that since #197 (`_externalLabelStrategy()` → `'aria'`, host
`[attr.aria-labelledby]="label() ? labelId() : _fieldLabelId()"`). Without the
same treatment, `mlv-checkbox-group` and `mlv-switch-group` would have been the
only `role="group"` controls in the library that take **no** name from a field
label.

Measured on the ticket's own example:

| A field holding `<mlv-label>Toppings</mlv-label>`, an `mlv-input` and an `mlv-checkbox-group` | Projected label `for`  | Group accessible name | Click the label    |
| --------------------------------------------------------------------------------------------- | ---------------------- | --------------------- | ------------------ |
| Before                                                                                        | the sibling input's id | none                  | focuses that input |
| Provider only (§ 2.1–2.3)                                                                     | absent                 | **still none**        | nothing            |
| After (this change)                                                                           | absent                 | **"Toppings"**        | nothing            |

No axe sweep could have caught the middle row: `label` and
`aria-input-field-name` do not apply to a `role="group"` at all, so
`expectNoAxeViolations` passes clean in every row.

Neither group extends `MlvSignalFormUiControlBase`, so neither can override
`_externalLabelStrategy()`. Each declares the resulting `labelTarget` directly:

```ts
readonly labelTarget = signal<MlvFormControlLabelTarget | null>({
  id: this._groupId,
  labelable: false,
}).asReadonly();
```

**The id lands on a different node in each component.** `mlv-switch-group`
carries `role="group"` on its host; `mlv-checkbox-group` carries it on an inner
`<div class="mlv-checkbox-group">`, its host having no role. Two attributes
therefore move to different places:

| Component            | Element carrying `role="group"`          | Gains `id` + `aria-labelledby` there |
| -------------------- | ---------------------------------------- | ------------------------------------ |
| `mlv-switch-group`   | the component host                       | the component host                   |
| `mlv-checkbox-group` | inner `<div class="mlv-checkbox-group">` | that `<div>`                         |

Precedence matches `mlv-radio-group`: a `label` written on the group wins over
one projected beside it, because it is the nearer, explicitly-authored name.

**`aria-label` is gone from both groups.** It duplicated the visible
`<mlv-label>` the group already rendered, and `aria-labelledby` outranks it in
the accessible-name computation, so leaving it would have made the field's
label lose to it. On `mlv-checkbox-group` it was additionally bound without
`|| null`, so a group with no `label` emitted a meaningless `aria-label=""`.

`mlv-file-upload` is **not** part of this half: it keeps the base `'none'`
strategy, reports no label target, and is still unnamed inside a field. Its
inherited `label` / `ariaLabel` inputs render nothing — see
`.claude/projects/libs-file-upload.md` § _Known gap_.

## 3. Nine new public members on each group, and what they cost

`MlvFormControl` requires ten members and offers five more as optional. Of the
ten, the groups already had `state` as a real input, and they already had the
optional `label`; they now add the optional `labelTarget`. The remaining nine
required members — `focused`, `disabled`, `readonly`, `loading`, `clearable`,
`hasValue`, `prepend`, `append`, `inset` — are constant, non-input signals
(`false` and `undefined`).

They exist because `ExistingProvider.useExisting` is typed `any`: without the
`implements` clause nothing would catch a missing member, and
`mlv-form-control-wrapper` — which is exported — calls `focused()` /
`disabled()` / `readonly()` / `loading()` / `state()` unguarded.

**They are public members on exported classes, and one hazard comes with that.**

```ts
const group = viewChild.required(MlvCheckboxGroup);
if (group().disabled()) { … }
//        ^ before: TS2339, "Property 'disabled' does not exist"
//          after:  compiles, and is always false
```

A compile error became a silent wrong answer. The template side is unchanged —
none of the nine is an `input()`, so `<mlv-checkbox-group [disabled]="x">` still
fails AOT with NG8002. Read `computedDisabled()` on the individual
`mlv-checkbox` / `mlv-switch` children instead; disabling was always per-item
and never group-wide.

Making the members non-public is not available (`implements` requires public
members). Widening `MlvFormControl`'s own members to optional would remove the
hazard here and create a worse one: every consumer calling
`inject(MLV_FORM_CONTROL).focused()` would stop compiling under
`strictNullChecks`, which is itself breaking.

## 4. Dev-mode warnings

| Composition                                         | Warning before                               | Warning after                               |
| --------------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| field › projected label + group with **no** `label` | "names nothing"                              | **none** — the group is now genuinely named |
| field › projected label + group **with** `label`    | "two labels"                                 | "two labels" (unchanged)                    |
| field › projected label + `mlv-file-upload`         | "names nothing", naming an unrelated control | "names nothing", naming `MlvFileUpload`     |

One inaccuracy is now reachable from two more components and is left alone
deliberately: the "two labels" text says the accessible name is _"their
concatenation"_, which is true for a `'native'` control (both `<label for>`s
point at one element) but not for an `'aria'` one, where `aria-labelledby` picks
exactly one. Both labels are still visibly rendered, which is the defect the
warning is really about. `mlv-radio-group`, `mlv-select` and the three date/time
pickers have had this wording since #197; changing it is a form-utils change
affecting every `'aria'` control and does not belong here.

## 5. Who is affected

**Affected — three narrow shapes, all requiring an `mlv-form-field`:**

1. A `label[for]` CSS selector, DOM query, or test asserting the old id against
   a field that wraps one of the three. `label.hasAttribute('for')` is the
   assertion that holds.
2. A click handler relying on the group's own label focusing a neighbouring
   control. That association was never intended; it was the bug.
3. TypeScript reading one of the nine members off a group reference — see § 3.

**Not affected:**

- Any of the three used **outside** an `mlv-form-field`, which is every usage in
  `libs/` and `apps/docs`. The only rendered deltas there are the new `id` and
  `aria-labelledby` attributes on the groups, and the removed `aria-label`,
  which resolve to the same accessible name as before whenever the group has its
  own `label`.
- `mlv-radio-group`, which already worked this way.
- Every other `MlvSignalFormUiControlBase` subclass — all twenty already
  provided the token.
- Styling: no BEM class name, custom property or DOM structure below the named
  BEM elements changed.

## 6. The mechanical edit

For almost every consumer: **nothing**.

If a projected label in a field wrapping one of the three needs to keep naming a
specific element, say so explicitly — that has always worked and still wins over
everything the field resolves:

```html
<mlv-form-field>
  <mlv-label for="my-input">Toppings</mlv-label>
  <mlv-checkbox-group>
    <mlv-input id="my-input" />
  </mlv-checkbox-group>
</mlv-form-field>
```

If a field wraps a group and you want the group named, do nothing — that now
happens. If you want the group to name itself instead, give it a `label` and
drop the projected `<mlv-label>` (keeping both renders two and warns).

If a field wraps an `mlv-file-upload`, name it from your own markup:
`aria-labelledby` pointing at a heading you already render. Its `label` /
`ariaLabel` inputs do not work.
