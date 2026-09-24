# 2026-09 — a consumer `id` on `mlv-checkbox` / `mlv-switch` names the native input

Applies to `@malva-ui/core/checkbox` (`MlvCheckbox`) and
`@malva-ui/core/switch` (`MlvSwitch`). Fixes #323 (audit C029, finding FC-07).

**Breaking, behaviour only.** No exported symbol, selector, input, output,
model, injection token, BEM class or i18n key was renamed, removed or
retyped. `id` keeps its name, its `string` type and its generated
`mlvNextId('mlv-control')` default. The public `inputId` member keeps its name
and its `string` type; it is now a getter instead of a `readonly` field.

Two halves, classified separately (`VERSIONING.md` § 3):

- **The native input now carries the consumer's `id`** — row 117, _Bug fix
  that restores documented behaviour_. The input has always been documented as
  "HTML id applied to the control's focus target", and `mlv-form-field`'s own
  dev warning tells an author to wire "`[for]` on the `<mlv-label>` and a
  matching `[id]` on the control". Neither was true: nothing could depend on
  the generated `mlv-control-N` the input carried instead.
- **A static `id` attribute no longer stays on the `<mlv-checkbox>` /
  `<mlv-switch>` host** — row 112, _Changed default behaviour at an unchanged
  API — … what a value means_. `id="terms"` used to name the host element; it
  now names the native input. That is observable (`getElementById`, `#terms`
  selectors, test locators), so the change ships as `!`. On the `0.x` line a
  `!` commit is demoted to a minor: `0.1.15` → `0.2.0` (§ 7).

A checkbox or switch that sets no `id` keeps its generated input id, its
accessible name and its click target. Its one markup difference is that its
own wrapping `<label>` no longer carries a `for` attribute (§ 1) — an
attribute on DOM below the BEM element, not a public surface.

## 1. What changed

Both components declared `readonly inputId = this.id();` — a class field
initializer, which runs **before** Angular sets inputs, so it always read the
generated default. The template bound that frozen string to the native
input's `id` and to the own `<label for>`. A consumer id therefore never
reached the input:

- a **static** `id="terms"` is both fed to the `id` input and written to the
  host element by Angular, so it stayed on the role-less, non-focusable host;
- a **bound** `[id]="rowId"` feeds only the input and landed on no element at
  all — every checkbox in an `@for` kept its generated id.

The template now binds `[id]="id()"` on the native input reactively, `inputId`
is a getter over `id()`, and the constructor removes a static `id` attribute
from the host (read through `HostAttributeToken('id')`, the same pattern that
already moves a host `aria-label` onto the input). The strip is load-bearing,
not tidiness: with the id on both elements, `<label for>` and
`getElementById` resolve the **first** match in tree order — the host — so an
external label would still name nothing (measured by ablation).

The own wrapping `<label>` **drops** its `for` and names the input by
containment: without `for`, a label names its first labelable descendant,
and the input is its first child. A `for` carrying the consumer's id would
hand the association to whichever element that id resolves to first in tree
order. Measured with `[for]="id()"` in place: two checkboxes sharing
`id="remember"` left the second input with no label at all
(`input.labels.length` 0) while its visible text toggled the **first**
control; an earlier element with the same id, or `id=""` (a `for` that is
present but matches nothing disables containment), left the input nameless.
The old `for` carried the unique generated id, so this never arose before.
The duplicate-id and clashing-id specs pin containment; putting `[for]` back
turns exactly those red.

Measured in jsdom, `mlv-checkbox` (the switch is identical):

| Markup                                                                                             | Before                                                                                     | After                                                                     |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `<mlv-checkbox id="terms">`                                                                        | host `id="terms"`, input `id="mlv-control-0"`, own `label for="mlv-control-0"`             | host no `id`, input `id="terms"`, own `label` wraps it, no `for`          |
| `<mlv-checkbox [id]="dynId">` (`'dyn-a'`, then `'dyn-b'`)                                          | host no `id`, input `id="mlv-control-1"` both times                                        | input `id="dyn-a"`, then `id="dyn-b"`                                     |
| `<mlv-checkbox>` (no id)                                                                           | input `id="mlv-control-N"`, own `label for="mlv-control-N"`                                | input unchanged; own `label` wraps it, no `for`                           |
| `@for` rows all binding `[id]="'same'"`                                                            | every input keeps a unique `mlv-control-N`                                                 | every input carries `id="same"`; each own label still names its own input |
| `description` / `message` ids with `id="terms"`                                                    | `terms-description` / `terms-message` (already derived from `id()`), input `mlv-control-0` | unchanged ids, now on the same stem as the input they describe            |
| `document.getElementById('terms')`                                                                 | the `mlv-checkbox` host                                                                    | the native `<input type="checkbox">`                                      |
| `<mlv-form-field><mlv-label for="terms">…</mlv-label><mlv-checkbox id="terms" /></mlv-form-field>` | `label.control === null`; axe `label` (critical): the input has **no accessible name**     | `label.control` is the input; the field's label names it                  |

The dev-mode "rendered without an accessible name" warning also accepts an
external `<label>` with text now, so the last row no longer warns falsely.
It is still a one-shot check at first render (`afterNextRender`): an external
label that renders later — inside an `@if` that turns true afterwards — is
not seen, and the warning still logs once. Development builds only.

## 2. Who is affected, and what to do

Nobody who sets no `id` has anything to change: the own label losing its `for`
reaches only code that reads that attribute (`label.htmlFor`, a `label[for]`
selector on `.mlv-checkbox__label`), which is DOM below the BEM element. No
`mlv-checkbox` or `mlv-switch` in `libs/` or `apps/docs` sets an `id`.

A **bound** `[id]` reached no element before, so nothing can have depended on
it as a host id — but it is not a no-op now. It lands on the native input, so:

- an external `<label for>` or `aria-controls` naming it, which used to point
  at nothing, now resolves — the label toggles the control and its text joins
  the accessible name (shape (d));
- `document.getElementById(id)` and `#id`, which returned nothing, now return
  the native input (shapes (b), (c));
- a **duplicate** bound id — the same `[id]` in every row of an `@for` — was
  harmless while every input kept its unique generated id; now every input
  carries it, and a `<label for>`, `getElementById` or `aria-*` reference
  resolves only the first row's input.
  **Do:** derive the id from the row (`[id]="'terms-' + row.id"`). The
  component's own label is not affected: it names its input by containment,
  so each row keeps its own name and click target.

**(a) A stylesheet selecting the host by id** — `#terms { … }`,
`mlv-checkbox#terms`. The id is on the visually-hidden native input now, so a
layout rule (margin, grid placement) lands on it and a tag-qualified selector
matches nothing.
**Do:** select the host by a class you add (`<mlv-checkbox class="terms">`) or
by the BEM block (`.mlv-checkbox`).

**(b) A test or e2e locator that takes the id as the host** —
`page.locator('#terms').click()`, `querySelector('#terms').classList`,
`By.css('#terms')`. It now resolves to the native input, which is visually
hidden by the clip-path pattern — a pointer action aimed at it is no longer
aimed at the host's visible box — and which carries none of the
`mlv-checkbox--*` host classes.
**Do:** locate by role and name (`getByRole('checkbox', { name: 'I accept' })`)
or assert on the input's own state (`input.checked`). For host classes, go up:
`input.closest('mlv-checkbox')`.

**(c) Code reading `document.getElementById(id)` as the component element** —
to `scrollIntoView()` it, read its classes, or hand it to a positioning
library. It now returns the native input.
**Do:** `getElementById(id)?.closest('mlv-checkbox')` (or `'mlv-switch'`).

**(d) An external `<label for="terms">` or `aria-controls="terms"` that
used to point at the host — or, for a bound `[id]`, at nothing.** It now
reaches the input — a label click toggles the control and the label joins its
accessible name, alongside any projected text or `label` input.
**Do:** nothing if that is what you wanted (the documented behaviour). If the
control already names itself, drop the external label, or its text will be
concatenated into the name.

**(e) A subclass overriding `inputId` as a property.** It is an accessor now
(TS2610). Neither class is a documented subclassing contract.
**Do:** override it as a getter, or read `id()`.

**(f) `createComponent(MlvCheckbox, { hostElement })` on a host that already
carries `id="x"`, then `setInput('id', 'x')`.** Both the host and the input
now carry `x`: `HostAttributeToken` is always `null` for a root host created
that way, so the constructor has no static attribute to strip. Measured:
`getElementById('x')` returns the host (first in tree order), so a
`<label for="x">` names nothing. Before, `setInput('id')` never reached the
input, which kept its generated id — no duplicate.
**Do:** pass the id through `setInput` only, or remove the host attribute
before creating the component.

## 3. Not changed

- `labelTarget()` still reports `null` for both controls (strategy `'none'`):
  a `<mlv-label>` projected into `mlv-form-field` **without** `for` still
  names nothing and still warns. Only the explicit `for` + `id` route changed.
- `mlv-checkbox-group` / `mlv-switch-group` ids are untouched.
- `[attr.id]="…"` on the host — or a co-hosted directive's `host: { id }` /
  `'[attr.id]'` — bypasses the `id` input: it still names only the host
  element, and the input keeps its generated id, with no duplicate (measured).
  Use `id` or `[id]` to name the input.
- `mlv-input`, `mlv-textarea` and `mlv-number-input` already bound `[id]="id()"`
  and are not part of this change. (They still leave a static `id` on their host
  as well as on the native control — a duplicate id tracked as a follow-up.)
