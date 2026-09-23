---
# Library: form-utils

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Form Utils library (`@malva-ui/core/form-utils`) provides foundational building blocks for accessible, state-aware forms. Includes form field wrappers, label/hint/message components, a `ControlValueAccessor` base class, and a `MlvSelectionService` for dropdown/select components (whose `compareWith` defaults to the shared `defaultCompareWith` from `@malva-ui/cdk/utils`).

## Public API

Exported from `libs/forms/form-utils/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvFormState` | Type | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` |
| `MlvErrorDisplayStrategy` | Type | `'touched' \| 'dirty' \| 'submit' \| 'immediate'` |

> **Tone-unification exclusion (intentional).** `MlvFormState` deliberately keeps the input name **`state`** and the **`'error'`** member. It expresses *form-validation* semantics (used by `mlv-input`, `mlv-textarea`, `mlv-select`, `mlv-checkbox`/`mlv-checkbox-group`, `mlv-switch`/`mlv-switch-group`, `mlv-radio-group`, `mlv-day-picker`, `mlv-time-picker`, `mlv-date-range-picker`, `mlv-form-field`, `mlv-message`, and the CVA base `FormControlBase` — inherited by `mlv-rating`, `mlv-radio-group`, `mlv-color-picker-popup`), **not** the display-surface visual `tone` unified via `MlvTone` in `@malva-ui/cdk/utils`. Its only change in the API-unification refactor was renaming the old long-form info member → **`'info'`** so the token vocabulary matches everything else (`--state-info` / `--info` BEM modifiers, `state() === "info"` host bindings).
| `MlvFormField` | Component | Auto-validation wrapper — `mlv-form-field` |
| `MlvLabel` | Component | Form label — `mlv-label` |
| `MlvHint` | Component | Label hint — `mlv-hint`; renders a question-mark icon + tooltip |
| `MlvDescription` | Component | Persistent help text below the control — `mlv-description` |
| `MlvMessage` | Component | Validation message — `mlv-message` |
| `FormControlBase<T>` | Abstract Directive | Base for custom form controls |
| `MlvFormControlWrapper` | Component | Control wrapper with prefix/suffix — `mlv-form-control-wrapper` |
| `MlvFormControlWrapperControl` | Directive | Control template slot — `[mlvFormControlWrapperControl]` |
| `FormControlWrapperControlAppend` | Directive | Suffix slot — `[mlvFormControlWrapperControlAppend]` |
| `FormControlWrapperControlPrepend` | Directive | Prefix slot — `[mlvFormControlWrapperControlPrepend]` |
| `MlvSelectionService<T>` | Service | Selection state management for dropdowns |
| `toAriaValues<V>` | Function | Normalises a CVA value (`T` / `T[]` / `null`) into the `V[]` array `@angular/aria` selection patterns require |
| `fromAriaValues<V>` | Function | Collapses an aria `V[]` selection array back to the CVA shape (`V \| null` single, `V[]` multi) |
| `MlvFocusableGroupBase<T>` | Abstract Directive | Roving-tabindex focus scaffold for composite groups; extended by `mlv-checkbox-group` / `mlv-switch-group` |
| `MlvClearMlvButton` | Component | Shared clear-X button (`mlv-clear-button`) used by the wrapper and inlined by select/combobox |
| `MlvFocusableGroupItem` | Interface | Per-item contract for the base: `FocusableOption` + `tabIndex: WritableSignal<number>` |
| `MLV_FORM_FIELD` | Token | `InjectionToken<MlvFormFieldAccessor>` — `mlv-form-field` provides itself; `mlv-label` and every control pull the label↔control association from it |
| `MlvFormFieldAccessor` | Interface | `labelId: Signal<string \| null>` + `labelableControlId: Signal<string \| null>` |
| `MlvFormControlLabelStrategy` | Type | `'native' \| 'aria' \| 'none'` — how a label rendered outside a control may name it |
| `MlvFormControlLabelTarget` | Interface | `{ id: string; labelable: boolean }` — what a control publishes as `labelTarget` |

---

## Focusable group base

**File:** `libs/core/form-utils/src/lib/focusable-group-base.ts`

`@Directive()` abstract base owning **only** the focus / roving-tabindex concern shared by composite groups whose single tab stop follows focus.

- `MlvFocusableGroupBase<T extends MlvFocusableGroupItem>` — subclass supplies `_items: Signal<readonly T[]>` (live children, e.g. `contentChildren`) and `_isDisabled(item): boolean` (arrow-nav skip predicate); base wires a vertical + wrapping `FocusKeyManager`, the `change`→tabindex sync (only the active child is `tabindex=0`), public `onKeydown` (ArrowUp/Down + `preventDefault`), public `onChildFocus` (`setActiveItem`), initial tab stop on the first child, and `DestroyRef` teardown (unsubscribe + destroy, including before every rebuild).
- `MlvFocusableGroupItem` — `FocusableOption` whose `tabIndex` is a `WritableSignal<number>` the group flips `0`/`-1`; satisfied by `mlv-checkbox` / `mlv-switch`.
- Adopted by `MlvCheckboxGroup` + `MlvSwitchGroup` (deduped their identical manager lifecycle; the `change`-sub was previously missing on switch — see libs-switch.md).
- **Not adopted by `mlv-radio-group`** (deliberate): radio's tab stop follows the _checked_ radio (selection-driven, not focus-driven), its arrows move selection across all four keys, and its effect couples radio-name + CVA selection — a focus-only base cannot express that without behavior change, so radio keeps its own `FocusKeyManager`.

---

## `@angular/aria` CVA value bridge

**File:** `libs/core/form-utils/src/lib/aria-value-bridge.ts`

Pure helpers that translate between the CVA single/multi value shape used by `FormControlBase<T>` and the array-only selection model (`value: ModelSignal<V[]>`) that `@angular/aria` selection patterns (`ngListbox`, `ngMenu`, `ngTree`, …) expose — single-select is a 1-element array in aria. Used by components that keep their `T`/`T[]` CVA contract while driving an aria pattern underneath.

```ts
toAriaValues<V>(value: V | readonly V[] | null | undefined): V[];
//  null | undefined        -> []          (cleared)
//  array                   -> [...array]  (multi-select, shallow copy)
//  any other value         -> [value]     (single-select)

fromAriaValues<V>(values: readonly V[] | null | undefined, multiple: boolean): V | V[] | null;
//  multiple === true       -> [...values] (empty stays [])
//  multiple === false      -> values[0] ?? null
```

Round-trips: `fromAriaValues(toAriaValues(v, multi), multi)` yields the canonical form of `v` (including `null`/clear and falsy primitives). An incoming array is treated as an already-expanded multi value. Covered by `aria-value-bridge.spec.ts` (round trip incl. null/clear).

---

## Components

### `MlvFormField`

**File:** `libs/forms/form-utils/src/lib/form-field/form-field.ts`
**Selector:** `mlv-form-field` | **Change Detection:** `OnPush`

#### Inputs

| Name              | Type                                          | Default     | Description                     |
| ----------------- | --------------------------------------------- | ----------- | ------------------------------- |
| `state`           | `MlvFormState`                                | `'default'` | Visual state                    |
| `errorMessages`   | `Record<string, string \| ((err) => string)>` | `{}`        | Custom validator error messages |
| `displayStrategy` | `MlvErrorDisplayStrategy`                     | `'touched'` | When to show errors             |

**Built-in error messages:** `required`, `email`, `min`, `max`, `minlength`, `maxlength`, `pattern`

**`MlvErrorDisplayStrategy`:**

- `'touched'` — show after blur
- `'dirty'` — show after first change
- `'submit'` — show after form submission
- `'immediate'` — always show

When the selected strategy makes an error visible, `resolvedState()` becomes `error` and the field applies the error border token to the projected control wrapper as well as rendering the error message. The direct-child CSS scope prevents an outer field from recoloring controls owned by a nested field.

#### Accessible name — the field associates label and control (2026-09, #197)

`mlv-form-field` is the only component that sees both an `<mlv-label>` and a
control, so it is where the association is made. Until #197 it made none: the
template was two bare `<ng-content>`s, `<mlv-label>` emitted `for=""` and the
control kept its auto-generated `mlv-control-NN` — so the documented
compose-a-field pattern shipped inputs with no accessible name and labels that
focused nothing.

**The rule, and why it is two rules.** `<label for>` only names an HTML
_labelable_ element (`button`, `input`, `meter`, `output`, `progress`,
`select`, `textarea`). It cannot name `mlv-select`'s `div[role="combobox"]`, a
`role="radiogroup"` host, or any custom-element host — pointing it there is
_worse_ than omitting it, because the label reads as associated in review while
focusing nothing. `aria-labelledby` names both, but is ARIA layered over native
semantics. So:

| Control's focus target                                              | Association                              | Emitted by                           |
| ------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------ |
| labelable (`<input>`, `<textarea>`, `<select>`, `<button>`)         | native `<label for>`                     | `MlvLabel`, resolved from the field  |
| non-labelable (`div[role="combobox"]`, `role="radiogroup"` host, …) | `aria-labelledby`                        | the control, resolved from the field |
| neither (composite / self-naming)                                   | nothing at all — plus a dev-mode warning | —                                    |

**Mechanism — both children pull, the field never pushes.** Content projection
means the field cannot bind inputs on either child, and only the control knows
which element inside its own view carries the name. So `MlvFormField` provides
itself under `MLV_FORM_FIELD` and both sides inject it optionally, following
`.claude/rules/angular-directive.md` § _Injection Tokens for Parent–Child
Communication_ (a node injector follows the _declaration_ tree, so a projected
child resolves the field it is written inside). The field reads back through
two content queries — `contentChild(MlvLabel)` and
`contentChild(MLV_FORM_CONTROL)`; the latter matches by provider token, the
same mechanism as the existing `contentChild(NgControl)`, so a raw `<input>` or
a third-party control resolves `null` instead of erroring. A control that
renders its _own_ `<mlv-label>` from its `label` input does so in its **view**,
which no content query of the field reaches, so the two never collide.

| Member                     | On                           | Meaning                                                                                         |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `labelId`                  | `MlvFormField`               | id of the projected `<mlv-label>`'s `<label>`, or `null`                                        |
| `labelableControlId`       | `MlvFormField`               | id for the label's `for`, or `null` when the control is not labelable                           |
| `labelId`                  | `MlvLabel`                   | generated id, always emitted on the inner `<label>`                                             |
| `labelTarget`              | `MlvSignalFormUiControlBase` | `{ id, labelable }` or `null` — what the field reads                                            |
| `label`                    | `MlvFormControl`             | the control's own label text; read **only** by the double-label warning below                   |
| `_externalLabelStrategy()` | `MlvSignalFormUiControlBase` | `'none'` by default; each control overrides                                                     |
| `_labelTargetId()`         | `MlvSignalFormUiControlBase` | which id `labelTarget` publishes; `id()` unless the focus target cannot carry it                |
| `_fieldLabelId()`          | `MlvSignalFormUiControlBase` | the field's `labelId` — only for `'aria'` controls                                              |
| `_externallyLabelled()`    | `MlvSignalFormUiControlBase` | whether the field's label names this control, under **either** strategy                         |
| `_ownLabelFor()`           | `MlvSignalFormUiControlBase` | `for` for the control's **own** `<mlv-label>` — `labelTarget().id` while labelable, else `null` |

An explicit `[for]` on the `<mlv-label>` always wins, and the field never
rewrites the control's `id`.

**`_labelTargetId()` is not always `id()`.** A control normally puts `id()` on
its own focus target, so the default is right. `[mlvTitle]` is the exception:
its host is the consumer's own heading and a **static** `id="…"` attribute is
both bound to the inherited `id` input and left on that heading by the
compiler, so pointing the `for` at `id()` would mean one id on two elements.
Its `<textarea>` takes `` `${id()}-input` `` and reports that instead.

**A non-nullable `aria-label` fallback must consult `_externallyLabelled()`.**
`aria-label` **outranks** `<label for>` in the accessible-name computation, so
a `'native'` control that always emits one keeps its own name and reduces the
field's label to click-to-focus. `_fieldLabelId()` cannot be the test — it is
populated only on the `'aria'` path — hence the separate signal. Two controls
need it (`mlv-tokenizer`'s `_i18n().addToken`, `mlv-color-picker-popup`'s
`_i18n().colorPicker`); every other control's fallback is a bare `ariaLabel()`,
which is `null` unless the consumer asked for it and therefore needs nothing.

**The control's own `label` beats the field's**, everywhere. `'aria'` controls
bind `[attr.aria-labelledby]="label() ? labelId() : _fieldLabelId()"` — never
`_fieldLabelId()` alone, which silently made the field's label win — and
suppress `aria-label` when either resolves. All five now carry a public
`labelId` (`` `${id()}-label` ``) on their own `<mlv-label>` for the first
branch.

#### A control's own label uses the same test (2026-09, #216)

`_ownLabelFor()` is the `for` a control renders on the `<mlv-label>` it draws
**itself** from its `label` input: `labelTarget()`'s id while that target is
labelable, `null` otherwise — and `null` emits no attribute at all.

`MlvLabel._resolvedFor()` returns an explicit `[for]` first, so a control that
hard-coded `[for]="id()"` short-circuited the whole #197 mechanism and kept
emitting a `for` even where the id sits on a `div`. Seven did: `mlv-select`
behind its custom trigger, `mlv-day-picker`, `mlv-time-picker`,
`mlv-date-range-picker`, `mlv-input` with `projectControl`, `mlv-tokenizer`
while disabled, and `mlv-editor` (whose id is on no element at all). The name
was already correct — every one of them carries `aria-labelledby` — so what the
attribute bought was a false association in review and a label that focused
nothing on click.

**Eight** templates bind `_ownLabelFor()`, not seven: `mlv-combobox` was
already emitting a correct `for` (its `id` reaches the inner `mlv-input`'s
native `<input>`) and converts anyway, so the answer has one source rather than
two that happen to agree. Its rendered attribute is unchanged;
`combobox-own-label.spec.ts` pins the strategy that makes that true.

#### The field resolves the outermost control, not a nested one (2026-09, #217)

`contentChild` defaults to `descendants: true`, so
`MlvFormField._control` matches the **first** node in the projected content
that can supply `MLV_FORM_CONTROL` — at any depth. Three components did not
supply it, and the query walked straight past each of them:

| Component            | What the field resolved instead                                    |
| -------------------- | ------------------------------------------------------------------ |
| `mlv-checkbox-group` | the first projected `mlv-checkbox` (a **descendant** of the group) |
| `mlv-switch-group`   | the first projected `mlv-switch` (likewise)                        |
| `mlv-file-upload`    | whichever other control the field held (it has nothing nested)     |

Two things went wrong, and only the second is a wrong `for` on the _projected_
label:

1. `labelableControlId()`, `_hasDoubleLabel()` and the dev warnings all
   described a node the author never pointed at — a projected `<mlv-label>`
   naming a control nested inside a group, or one sitting beside an upload zone.
2. `MlvLabel._ownerControl` is what stops a control's **own** inner
   `<mlv-label>` borrowing the field's target. The two groups render one from
   their `label` input, and with nothing provided it resolved `null` — so in a
   field that also held a labelable control, the group's own label emitted that
   control's id as its `for`. Clicking "Toppings" focused the text input.

All three now provide `MLV_FORM_CONTROL`, `useExisting` themselves.
`mlv-file-upload` already extended `MlvSignalFormControlBase` and needed only
the provider line — it was the workspace's single `MlvSignalFormUiControlBase`
subclass without one, against twenty that had it.

**The two groups are not `MlvSignalFormUiControlBase` subclasses.** They extend
`MlvFocusableGroupBase`, which owns only the roving-tabindex concern, so they
each implement `MlvFormControl` directly: `state` and `label` are their real
inputs, and the nine wrapper-facing halves they do not own (`focused`,
`disabled`, `readonly`, `loading`, `clearable`, `hasValue`, `prepend`,
`append`, `inset`) are constant, non-input signals. Explicit members rather
than a bare provider, because `ExistingProvider.useExisting` is typed `any`:
without the `implements` clause nothing would have caught a missing member, and
`mlv-form-control-wrapper` calls `focused()` / `disabled()` / `readonly()` /
`loading()` / `state()` unguarded. Every wrapper in the library today sits
inside a control that provides the token itself, so that path was unreachable
in-repo — but `mlv-form-control-wrapper` is exported, so a consumer could reach
it.

Both groups also report a `labelTarget` of `{ id, labelable: false }` — the
`'aria'` row of the strategy table, and the shape `mlv-radio-group` has shipped
since #197. A `role="group"` is nameable from outside; `aria-labelledby` is how.
Without it the two groups would have been the only `role="group"` controls in
the library that take no name from a field label — a live WCAG 4.1.2 gap that no
axe sweep can see, because `label` / `aria-input-field-name` do not apply to a
`role="group"` at all. The id must land on the element that actually carries the
role, and that is a **different node in each**: `mlv-switch-group`'s host, but
`mlv-checkbox-group`'s inner `<div>`.

They cannot override `_externalLabelStrategy()` to say so, because that hook
lives on `MlvSignalFormUiControlBase` and neither group extends it; each
declares the resulting `labelTarget` directly instead. It is a constant rather
than a `computed`: a control whose strategy tracks its own state (`mlv-select`
swaps between its native `<select>` and a `div[role="combobox"]`) needs one, but
a group is a group in every state.

The nine constant members are public on exported classes, which costs one thing
worth stating: `group.disabled()` on a `viewChild(MlvCheckboxGroup)` used to be
a compile error and now compiles and always answers `false`. `[disabled]="…"` on
the element still fails AOT with NG8002 (none of the nine is an `input()`), so
only the TypeScript read changed — from loud to silent. Making
`MlvFormControl`'s own members optional would remove the cost here and create a
worse one: every consumer calling `inject(MLV_FORM_CONTROL).focused()` would
stop compiling under `strictNullChecks`.

**It was latent, not live.** No shipped field in `libs/` or `apps/docs` holds
a group or an upload zone, so nothing rendered wrongly before this change. The
shape that breaks is a field holding one of the three **and** a second control;
that is what `checkbox-group-field-label.spec.ts`,
`switch-group-field-label.spec.ts` and `file-upload-field-label.spec.ts` pin,
alongside the naming contract itself.

`mlv-file-upload` keeps the base `'none'` strategy and is therefore still
unnamed inside a field — see `.claude/projects/libs-file-upload.md`.

The question a control's own label asks is the one `labelTarget` already
answers, so both read one source of truth rather than each deciding again.
Bind `[for]="_ownLabelFor()"`; a control whose `for` names something **other**
than its name target keeps its own binding (`mlv-pin-input` points at its first
cell, which no external label may use).

`mlv-select` is why this must be a signal and not a constant: it flips between
`'native'` and `'aria'` as the native `<select>` takes over, and the `for` has
to follow. `mlv-day-picker`, `mlv-time-picker`, `mlv-date-range-picker` and `mlv-editor`
bind `(click)` on their own `<mlv-label>` to focus their real focus target,
replacing the native click-to-focus a non-labelable element can never provide;
`mlv-select`'s handler predates this and **opens** the dropdown instead.

Covered inside this library by `form-control-base/own-label-for.spec.ts` (the
three strategies plus a live flip, against a test double) and by the nullish
`for` cases in `label/label.spec.ts`. Both were added in #216 review: every
assertion protecting `_ownLabelFor` had lived in the downstream projects, so a
refactor here passed this library's own suite. Note that the widened
`MlvLabel.for` **write** type is a compile-time contract only — `_resolvedFor()`
treats `null`, `undefined` and `''` alike at runtime, so a unit test cannot see
the transform disappear. Reverting it fails `nx run core:build` with TS2322 at
`input.html`, which is the gate that actually holds it.

**A control's own inner label never borrows the field's target.**
`mlv-radio-group`, `mlv-segmented` and `mlv-checkbox-group` render an
`<mlv-label>` with no `for` inside their own view. `MlvLabel` injects
`MLV_FORM_CONTROL` optionally: a label in a control's view is that control's
descendant and resolves it, and skips field resolution; a label projected into
`mlv-form-field` beside a control is its sibling and resolves `null`, so it
does resolve. Without that guard a field holding more than one control would
point an inner label at the first one — a wrong association rather than the old
inert `for=""`.

**Per-control strategy.** `'native'`: `mlv-input` (unless `projectControl`),
`mlv-textarea`, `mlv-number-input`, `mlv-combobox`, `mlv-tokenizer` (while
enabled), `mlv-color-picker-popup` (field presentation), `mlv-title` (while
`editable`), `mlv-select` while its native `<select>` is live. `'aria'`:
`mlv-select`'s custom trigger, `mlv-day-picker`, `mlv-time-picker`,
`mlv-date-range-picker`, `mlv-radio-group`. `'none'` (the base default — these
name themselves through `label` / `ariaLabel` / projected text, and several
already warn when unnamed): `mlv-checkbox`, `mlv-switch`, `mlv-slider`,
`mlv-pin-input`, `mlv-file-upload`, `mlv-color-picker`, `mlv-segmented`,
`mlv-rating`, `mlv-editor`.

Three of those reach `'none'` by a different route: `mlv-file-upload`,
`mlv-checkbox-group` and `mlv-switch-group` extend the base but never
**provide** `MLV_FORM_CONTROL`, so `contentChild(MLV_FORM_CONTROL)` does not
resolve them at all. The outcome for a consumer is the same — no association,
and the warning fires — except that the group cases resolve the field's query
to the first nested `<mlv-checkbox>` / `<mlv-switch>` instead (`contentChild`
defaults to `descendants: true`), so the warning names the child. Latent while
no field holds a group beside a second control; tracked separately.

**Two dev-mode warnings**, each de-duplicated per control class through its own
module-scoped set (same shape as `WARNED_UNMAPPED_KEYS`; separate sets, so
whichever fires first cannot silence the other). Both name the control by
`constructor.name` rather than by its host tag — the field registers no content
query just to feed a message `isDevMode()` gates off in production, and neither
a consumer's dev build nor ng-packagr's output is minified.

| Shape                                                                          | Warning                                                                                               |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| projected `<mlv-label>` with no `for`, and neither association resolves        | "names nothing" — reach for the control's own `label` / `ariaLabel`, or wire `[for]` + `[id]` by hand |
| projected `<mlv-label>` **and** the control's own `label` input both non-empty | "two labels" — keep one                                                                               |

**The double-label hazard.** Nothing stops a consumer writing
`<mlv-form-field><mlv-label>Start</mlv-label><mlv-time-picker label="Meeting time" /></mlv-form-field>`.
Both labels render, and on a `'native'` control both `<label>` elements carry
the same `for`, so the accessible name is their **concatenation** ("Start
Meeting time") rather than either one; on an `'aria'` control the projected
label names nothing at all while staying visible, which is a WCAG 2.5.3 hazard
of its own. The field cannot pick for the author — either label may be the
intended one — so it warns and renders both. The two warnings are mutually
exclusive by construction: the "names nothing" effect bails on this shape,
because telling an author to reach for `[label]` when they already have one is
worse than silence.

`MlvFormControlWrapper` is unchanged and still contributes no name: it is a
visual shell inside a control, not a composition point, and the control it
lives in already publishes `labelTarget` on its behalf.

---

### `MlvLabel`

**File:** `libs/forms/form-utils/src/lib/label/label.ts`
**Selector:** `mlv-label`

#### Inputs

| Name       | Type                                             | Default |
| ---------- | ------------------------------------------------ | ------- |
| `for`      | `string` (accepts `string \| null \| undefined`) | `''`    |
| `required` | `boolean` (`coerce`)                             | `false` |

Renders `<label [attr.id]="labelId" [attr.for]="_resolvedFor()">`. Supports nested
`<mlv-hint>`, projected into `.mlv-label__hint` — which renders as an icon + tooltip,
not inline text (see `MlvHint`).

`for` still defaults to `''` and an explicit value still wins, but `''` no longer
_renders_ `for=""`. It means "resolve from the enclosing `mlv-form-field`", and when
nothing resolves **no `for` attribute is emitted at all** — a dangling `for` reads as
associated in review while focusing nothing. See _`MlvFormField` → Accessible name_
above.

`null` / `undefined` are accepted on the write side and normalized to `''` by a
transform, so they mean the same thing: emit no `for`. That is what a control
binding its own label's `[for]="_ownLabelFor()"` passes while its name target is
not labelable (#216). The read type stays `string`, so nothing that consumed
this input has to widen.

`labelId` (public, non-input) is a generated `mlv-label-NN` always rendered on the
inner `<label>`, so a control whose focus target `<label for>` cannot name can point
`aria-labelledby` at it. It is on the inner `<label>` and not the `mlv-label` host
because consumers — and `mlv-select` / `mlv-day-picker` themselves — bind `[id]` on
the host.

`required` renders `<span class="mlv-label__required" aria-hidden="true">*</span>` plus a
`.cdk-visually-hidden` node carrying the translated `formUtils.required` word (falls back to
`'required'` when `provideMlvI18n()` was never called). Controls extending
`MlvSignalFormUiControlBase` forward their own `required` input here; standalone `mlv-label`
usage can set it directly.

---

### `MlvHint`

**File:** `libs/core/form-utils/src/lib/hint/hint.ts`
**Selector:** `mlv-hint` | **Change Detection:** `OnPush`

Secondary hint for the control named by the enclosing `mlv-label`. Authored as **projected
content** (`<mlv-hint>Sent to your phone</mlv-hint>`) — that is the whole public API, there are
no inputs — but it **renders as a small `circle-question-mark` icon button** (`LucideCircleQuestionMark`,
`[size]="14"`) that reveals the text in an `[mlvTooltip]` on hover **and** on keyboard focus.
Use `mlv-description` for sentence-length help text that should stay permanently visible below
the control.

**Why an icon and not inline text.** The hint used to render as text directly inside the
label's `display: inline-flex` row, so a long hint became a flex sibling of the label text and
forced the label to wrap mid-phrase. An icon is a fixed-size sibling, so the label row stays on
one line at any hint length.

#### DOM

```html
<mlv-hint class="mlv-hint">
  <!-- rendered only while the projected text is non-empty -->
  <button type="button" class="mlv-hint__trigger" aria-label="<hint text>" [mlvTooltip]="<hint text>">
    <svg lucideCircleQuestionMark aria-hidden="true" />
  </button>
  <span class="mlv-hint__source" aria-hidden="true"><!-- projected content --></span>
</mlv-hint>
```

#### How the tooltip string is obtained

`mlvTooltip` needs a `string`, but the public API is content projection. The projected content
is rendered into `.mlv-hint__source`, which is `display: none` (`textContent` still resolves on
a non-displayed element) and read into a private `_text` signal:

- The first read happens in `afterNextRender`, so it never runs during SSR.
- A `MutationObserver` (`childList` + `characterData` + `subtree`) keeps `_text` in sync, which
  is what makes the interpolated form every control uses — `<mlv-hint>{{ hint() }}</mlv-hint>` —
  update at runtime. An `effect()` would **not** work here: `textContent` is not a reactive read,
  and the mutated text node belongs to the _parent_ view. The observer is disconnected via
  `DestroyRef.onDestroy`. Re-setting the signal to an identical string is a no-op, so there is no
  render loop.

#### Accessibility

- `.mlv-hint__source` is `aria-hidden`. Previously the hint text sat inside the `<label>` and
  leaked into the labelled control's accessible name (`"Full name Shown on every comment"`).
  Hiding it yields a clean control name; the same string is placed on the trigger's `aria-label`,
  so the hint stays reachable to assistive tech via the icon.
- The trigger is a real `<button type="button">`, so it is in the tab order, activates on
  Enter/Space, and gets a `:focus-visible` ring (`--mlv-border-focus`). `MlvTooltip` opens on
  `focusin` as well as `mouseenter`, so keyboard users get the hint, and closes on `Escape`.
- **No trigger is rendered while the projected text is empty.** An empty `<mlv-hint>` would
  otherwise leave a nameless icon button behind — an AXE `button-name` violation. (This is why
  the component uses an `@if` rather than `MlvTooltip`'s `tooltipDisabled`.)
- The click handler calls **both** `preventDefault()` and `stopPropagation()`. The trigger is a
  `<button>` nested inside a `<label>`: `preventDefault()` stops the label's native
  "focus the labelled control" behaviour, and `stopPropagation()` stops click handlers bound on
  `mlv-label` itself — `mlv-select` binds one there to open its dropdown — from firing when the
  user only wanted to read the hint.

#### Styling

`hint.css` is a plain global stylesheet (`ViewEncapsulation.None`), so it selects the BEM block
class `.mlv-hint` bound from `host`, not `:host` (which never matches outside a shadow tree).
`mlv-label` styles `.mlv-label__hint` as `display: inline-flex; align-self: center` so the icon
sits on the row's centre line instead of the text baseline the label row is built on.

---

### `MlvDescription`

**File:** `libs/core/form-utils/src/lib/description/description.ts`
**Selector:** `mlv-description`

Persistent help text rendered **below** the control, in front of `mlv-message`, through the
wrapper's `mlv-description` projection slot. Stays visible while a validation message shows.
Controls extending the signal base render it from their `description` input and point
`aria-describedby` at it via `_describedBy()`.

---

### `MlvMessage`

**File:** `libs/forms/form-utils/src/lib/message/message.ts`
**Selector:** `mlv-message`

#### Inputs

| Name    | Type           | Default     |
| ------- | -------------- | ----------- |
| `state` | `MlvFormState` | `'default'` |

Animated enter/leave (fade + slide). Sets `aria-live` / `role` based on state.

---

### `MlvFormControlWrapper`

**File:** `libs/core/form-utils/src/lib/form-control-wrapper/form-control-wrapper.ts`
**Selector:** `mlv-form-control-wrapper`

Visual shell for form controls. Projects label, control, prefix/suffix, and message via directive slots.

**It contributes no accessible name.** The wrapper is chrome: it projects the
slots and paints state, and wires no `aria-labelledby` / `for` between the label
slot and the control slot. The projected control must carry its own name — see
_`MlvFormField` → Accessible name_ above.

#### Inputs

**None.** The wrapper takes no inputs — every state modifier is read from the
optional `MLV_FORM_CONTROL` connector injected from the host control
(`focused()`, `disabled()`, `readonly()`, `loading()`, `pill?.()`, and
`resolvedState?.() ?? state()`). A wrapper used outside a control renders in the
default state.

#### Outputs

| Name    | Type           | Description                                                                                                                                                                                                                          |
| ------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `clear` | `output<void>` | Emitted when the user activates the wrapper's clear button. The button renders only while the control is writable (see _Clearable value-gating_), but a bound handler still writes through the control's `_write` — the enforcement. |

#### Host Bindings

```ts
host: {
  'class': 'mlv-form-control-wrapper',
  '[class]': '_stateClass()',
  '[class.mlv-form-control-wrapper--focused]': 'formControl?.focused()',
  '[class.mlv-form-control-wrapper--disabled]': 'formControl?.disabled()',
  '[class.mlv-form-control-wrapper--readonly]': 'formControl?.readonly()',
  '[class.mlv-form-control-wrapper--loading]': 'formControl?.loading()',
  '[class.mlv-form-control-wrapper--pill]': 'formControl?.pill?.() ?? false',
}
```

> **One validation ring (SF-R6).** Only `state="error"` colours the container
> border (`--container-border-color: var(--mlv-border-error)`). `success`,
> `info` and `warning` deliberately paint no ring — their meaning lives
> entirely in the adjacent `mlv-message` text, so a form with mixed states
> reads as one alarm rather than four coloured perimeters. `disabled` and
> `readonly` stay fully achromatic, differentiated by fill and text colour
> only. The default-state hover border also moved off the raw palette stop
> (`neutral-300`) onto `--mlv-border-strong`, which is the same pixel in
> light but fixes a dark-mode bug where a hovered field drew a near-white
> border. The focused-state ring width is `var(--mlv-stroke-width)` (not a
> literal `1px`).

#### Control-text type & padding ramp (2026-08-26)

`.mlv-form-control-wrapper` declares the **one** density-scaled type/padding
ramp every text-style control obeys — `--form-ctrl-font-size` (block) /
`--form-ctrl-h-padding` (inline, combined into `--mlv-control-padding` with
the constant `--mlv-spacing-1` block half):

| density     | `--form-ctrl-font-size`   | `--form-ctrl-h-padding` |
| ----------- | ------------------------- | ----------------------- |
| tight       | `--mlv-font-size-s` (12)  | `--mlv-spacing-2`       |
| compact     | `--mlv-font-size-m` (14)  | `--mlv-spacing-2-5`     |
| comfortable | `--mlv-font-size-m` (14)  | `--mlv-spacing-3`       |
| spacious    | `--mlv-font-size-l` (16)  | `--mlv-spacing-4`       |
| airy        | `--mlv-font-size-xl` (18) | `--mlv-spacing-5`       |

This is the workspace's **control-text ramp**: the type ramp is locked to the
height ramp, so one density step moves both together.
Both custom properties are declared once here and **inherited** by every
descendant of the wrapper — `mlv-input`, `mlv-textarea`, `mlv-number-input`,
the `mlv-select` / `mlv-combobox` / `mlv-day-picker` / `mlv-time-picker`
trigger text, and (via projection) `mlv-label`, `mlv-description` and
`mlv-message` all render inside the wrapper's DOM. A control's own SCSS must
read `var(--form-ctrl-font-size, var(--mlv-font-size-m))` /
`var(--mlv-control-padding)` rather than a literal or a different token —
see `mlv-input__native` and `mlv-number-input__native` for the reference
pattern.

`mlv-label` is the one exception: it is a **sibling** of the wrapper (both
are projected children of the owning control), not a descendant, so it
cannot inherit `--form-ctrl-font-size` through the DOM. `label.scss` instead
carries its own copy of the same five values via the `density.*` mixins, so
a label still reads at the size of the field it names at every density.

**2026-08-26 fix.** Before this pass, `mlv-input__native` declared a flat,
non-ramped `padding: var(--mlv-spacing-1)` on top of the wrapper's own
(already ramped) container padding — a doubled, non-scaling inline padding
found on no other control. It now follows the same pattern as
`mlv-select`/`mlv-combobox`/`mlv-time-picker`/`mlv-number-input`: the
wrapper's `__control-container` padding is zeroed and `mlv-input__native`
owns the full `var(--mlv-control-padding)` itself. Several controls also
carried a hardcoded `--mlv-font-size-l` instead of the ramp (`mlv-input`,
`mlv-number-input`, `mlv-tokenizer`'s overflow badge, `mlv-combobox`'s empty
row) or diverged from the ramp's exact steps (`mlv-switch`'s `compact` /
`airy` label size). `mlv-checkbox` and `mlv-radio` had no label type ramp at
all. All are now on the shared ramp — the type ramp is locked to the height ramp,
so one density step moves both together, and no control may read a step the
ramp does not define. `mlv-pin-input`'s cell text and `mlv-rating` (no
visible text) are documented exceptions and stay off the ramp.

**Superseded (2026-08-26, round 2 of the same day).** The "zero the
container, `mlv-input__native` owns the full padding" fix above turned out to
be correct only for controls whose entire row lives inside one element they
own outright (`mlv-select`/`mlv-combobox`/`mlv-time-picker`/`mlv-number-input`).
`mlv-input`'s prefix/suffix (`*mlvFormControlPrepend`/`*mlvFormControlAppend`)
are separate siblings rendered by the wrapper's own generic slots — zeroing
the container stripped their only inset while the native input's now-full
padding pushed text in from the other side, breaking every prefix/suffix
consumer (`mlv-search-field`, currency-style `mlv-input` prefix/suffix
examples). `mlv-input__native` now declares **no** padding of its own in
either mode; the row's one shared inset comes from whichever ancestor already
supplies it — the wrapper's own un-zeroed default for `mlv-input`'s default
mode, or the embedding composite's own trigger row in `bare` mode. See the
report's Round 3 §1 for the full before/after.

**Affordance-glyph size ramp (2026-08-26, round 3).** A second shared token,
`--form-ctrl-icon-size: calc(var(--form-ctrl-height) * var(--mlv-icon-in-container-ratio))`,
declared alongside the type/padding ramp above — reuses CH-R4's
`--mlv-icon-in-container-ratio` (0.45) anchored to the field's own height.
Every form-control affordance glyph (leading/trailing icons, chevrons, the
generic clear button) now reads this instead of a fixed `1.25rem`, a
row-text-relative `em`, or a button-local ratio pinned to a fixed density.
Resolves to 12.6 / 16.2 / 19.8 / 23.4 / 27px across tight → airy. See the
report's Round 3 §3–4 for the full consumer table, the two "direct
declaration beats inherited value" gotchas it surfaced, and the matching
`--mlv-text-tertiary` → `--mlv-text-primary` colour ramp (mirroring
`.mlv-select__arrow`).

---

## Directives

| Directive                          | Selector                                | Purpose                            |
| ---------------------------------- | --------------------------------------- | ---------------------------------- |
| `MlvFormControlWrapperControl`     | `[mlvFormControlWrapperControl]`        | Marks template as the main control |
| `FormControlWrapperControlPrepend` | `[mlvFormControlWrapperControlPrepend]` | Left-side prefix content           |
| `FormControlWrapperControlAppend`  | `[mlvFormControlWrapperControlAppend]`  | Right-side suffix content          |

---

## Abstract Base Class: `FormControlBase<T>`

**File:** `libs/forms/form-utils/src/lib/form-control-base/form-control-base.ts`

Implements `ControlValueAccessor`. Extend to create custom form controls.

#### Inputs

`state`, `readonly`, `disabled` (coerced), `id` (auto-generated), `label`, `hint`, `message`

#### Protected Members

- `onChange: (v: unknown) => void`
- `onTouched: () => void`
- `internalDisabled: signal(boolean)`
- `focused: signal(boolean)`

#### CVA Methods

`writeValue`, `registerOnChange`, `registerOnTouched`, `setDisabledState`

---

## Services

### `MlvSelectionService<T>`

**File:** `libs/core/form-utils/src/lib/selection.service.ts` | **Provided:** component-level (inject per component)

#### Signals

| Signal           | Type                              | Description                                                                                                           |
| ---------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `multiple`       | `signal(boolean)`                 | Single vs multi-select                                                                                                |
| `selectedValues` | `signal<T[]>([])`                 | Current selections                                                                                                    |
| `compareWith`    | `signal<(a: T, b: T) => boolean>` | Equality predicate for every membership check; defaults to the shared `defaultCompareWith` from `@malva-ui/cdk/utils` |
| `displayValue`   | `computed<string>`                | Human-readable label                                                                                                  |

#### Methods

| Method                          | Description                                |
| ------------------------------- | ------------------------------------------ |
| `select(value: T)`              | Add to selection (replaces in single mode) |
| `deselect(value: T)`            | Remove from selection                      |
| `isSelected(value: T): boolean` | Check if selected                          |
| `clear()`                       | Clear all                                  |
| `setValues(values: T[])`        | Replace all                                |
| `toggle(value: T)`              | Add or remove                              |
| `requestFocusFirst()`           | Emit to focus first list item              |

#### `compareWith` is the shared reference, not an inline arrow (2026-09, issue #67)

`compareWith` defaults to `defaultCompareWith` imported from `@malva-ui/cdk/utils` — **the same binding** `mlv-select` and `mlv-combobox` default their own `compareWith` input to, and the same one `@malva-ui/core/dropdown`'s `hazardOf` recognises. It used to be declared inline at the `signal()` call, which gave every service instance a private `(a, b) => a === b` that no callee could identify, so a comparator taken off the service could never reach `valueIndex`'s or the reconciliation guards' keyed fast path.

The comparison performed is unchanged — it is the same `===`, with the same two quirks (`NaN` is not equal to itself; `+0` equals `-0`). Only the reference changed. `selection.service.spec.ts` pins both halves: the reference identity, and a 50-seed differential fuzz of `isSelected` / `select` / `deselect` / `toggle` against verbatim copies of the pre-change methods over a pool loaded with `NaN`, `±0` and structurally-equal-but-distinct objects.

The constant lives in `@malva-ui/cdk/utils` rather than in `@malva-ui/core/dropdown` because the dropdown **depends on this library** (`mlv-dropdown-panel` injects `MlvSelectionService`), so importing it from there would invert that dependency.

**No `Set` fast path was added to the membership scans.** The crossover sits in the low tens of membership queries per selection change — 16–24 on `scripts/benchmarks/selection-membership.mjs`, 16–32 on an independently written harness during review. Every remaining call site (`combobox.ts:818`, `:948`, `:1032`) makes exactly **one** query per user gesture, and a query that hits short-circuits the scan.

At Q=1 an index is **6–23× slower** when the query misses, at selections up to 512 (~46× at 10,000, a size no selection reaches); when the query hits it is 7× slower at the tail and up to ~6700× at the head, because the scan stops on the first element while the index still builds over all of R. The gap is near-flat in R because it is structural, not a size effect: `Map.set` costs roughly 10–30× a `===`, so at Q=1 the index performs R sets to save R comparisons and loses by that ratio.

Run it with `node scripts/benchmarks/selection-membership.mjs` (no build needed). The numbers above are a microbenchmark and move by a few units between runs; the ordering does not.

---

## Usage Examples

```html
<!-- Form field with auto error display -->
<mlv-form-field displayStrategy="touched">
  <mlv-label for="email">
    Email
    <!-- renders as a question-mark icon; the text shows in a tooltip -->
    <mlv-hint>We'll contact you here</mlv-hint>
  </mlv-label>
  <input id="email" type="email" [formControl]="emailCtrl" />
</mlv-form-field>

<!-- Control wrapper with prefix/suffix -->
<mlv-form-control-wrapper [focused]="isFocused()" state="default">
  <ng-template mlvFormControlWrapperControlPrepend>$</ng-template>
  <ng-template mlvFormControlWrapperControl>
    <input type="number" />
  </ng-template>
  <ng-template mlvFormControlWrapperControlAppend>USD</ng-template>
</mlv-form-control-wrapper>
```

---

## Dependencies

- `@angular/core`, `@angular/forms` — CVA, reactive forms
- `@angular/cdk/coercion` — boolean coercion
- `@lucide/angular` — `LucideCircleQuestionMark` for the `mlv-hint` trigger
- `@malva-ui/core/tooltip` — `MlvTooltip`, which reveals the `mlv-hint` text
- `@malva-ui/core/button` — `MlvClearMlvButton` chrome
- `@malva-ui/cdk/utils` — `defaultCompareWith`, the shared `===` default for `MlvSelectionService.compareWith`

## Clearable value-gating (2026-07)

- `MlvFormControl` connector: new required `hasValue: Signal<boolean>` + optional `ownsClearButton?: Signal<boolean>`.
- `FormControlBase` declares `hasValue` **abstract** — every control derives it from its own store (text length, selection count, nullable value, token/file count; always-valued controls like the slider and the inline color picker return `true`). `mlv-time-picker` no longer does (#301): it answers from its model, because its drum shows the current time on an empty value and `true` rendered an X on an empty picker.
- Wrapper clear condition (`_showClear`, #301): `clearable() && hasValue() && !ownsClearButton?.() && !readonly() && !disabled()` — no dangling X on empty controls, and none on a control the user may not write. The last two terms restate `_canWrite` over the connector (the wrapper cannot see the protected member; for every signal-base control the connector's `disabled()` is `computedDisabled()`); a term added to `_canWrite` must be added there too. **Hidden, not rendered `disabled`** — matches the empty case and the own X of select / combobox / search-field; the wrapper's `--disabled` modifier is only `pointer-events: none`, so a rendered X stayed keyboard-reachable. Controls flagging `ownsClearButton` (select, combobox) render `mlv-clear-button` inline before their chevron instead, and owe the same write gate on it.
- Every wrapper consumer that is `clearable` binds `(clear)` to a gated handler (#301): `mlv-input` / `mlv-textarea` / `mlv-number-input` / `mlv-day-picker` / `mlv-time-picker` / `mlv-date-range-picker` → protected `_onClear()` writing through `_write` (touch only when the write landed); `mlv-tokenizer` → `_onClear()` gated on `_canWrite()` up front (it writes `tokens` and `value`); `mlv-color-picker-popup` → `_clearValue()` (already gated); `mlv-editor` → `clearValue()` (already gated). The four pickers/tokenizer had **no** binding before — their X did nothing. Public `clearValue()` on input / textarea / number-input stays an **ungated application API** (like `value.set`); `mlv-tokenizer` relies on that when it empties its inner `mlv-input` after committing a token.
- `MlvClearMlvButton` (`mlv-clear-button`): compact transparent circular X, i18n `clear` aria-label, `(clear)` output.

## Pill controls (2026-08)

- `MlvSignalFormUiControlBase` gained the shared `pill` input (`BooleanInput`) —
  the **single place** that makes every wrapped control (input, select,
  textarea, day-picker, tokenizer, search-field, …) fully rounded.
- `MlvFormControl` connector: optional `pill?: Signal<boolean>`; the wrapper
  binds `mlv-form-control-wrapper--pill`, which sets the container
  `border-radius: var(--mlv-radius-full)` directly (wins at every density) and
  widens inline padding (`* 1.35`) so content clears the round caps.
- Mirrors `shape="pill"` on `mlvButton` and `shape="pill"` on `[mlvActionBar]`.

## Testing entry: `@malva-ui/core/form-utils/testing`

- `MlvFormsBindingAdapter<T>` / `MlvFormsBindingMatrixOptions<T>` / `verifyFormsBinding()` — shared assertion driver for the forms bindings matrix (reactive `[formControl]`, template-driven `ngModel`, signal forms `[formField]`): form-side write round-trip, user-interaction propagation, blur→touched, disabled propagation. Every control migrated per docs/plans/signal-forms-migration.md runs it once per mode (reference: `input-binding-matrix.spec.ts` in core-input — all 3 modes green on 22.0.7, incl. `[formField]` binding the CVA directly).
- **Runner-agnostic, and must stay that way** (#243, `docs/migrations/2026-09-form-utils-testing-runner-agnostic.md`). This is a **published** entry point — its own `ng-package.json`, so ng-packagr builds it and `dist/libs/core/package.json` exports `./form-utils/testing` — so every bare specifier its sources import ships in the FESM bundle and must be something `@malva-ui/core` declares. It used to open `import { expect } from 'vitest'`, declared nowhere, which was `Cannot find module 'vitest'` for a consumer on Jest / Karma / Web Test Runner. Its only bare import now is `fast-equals` (already a core `dependency`, and an `allowedNonPeerDependencies` entry). **Never import a test runner here** — the assertion primitives live in `testing/src/lib/binding-assertions.ts`, deliberately outside the barrel.
- Failure shape: `fast-equals` for values, `===` for booleans, and a throw of an `AssertionError`-shaped error carrying `name` / `actual` / `expected` / `operator` / `showDiff` — the shape Vitest's reporter special-cases, so a failed expectation still prints the same expected/received diff, while a runner with no diff support reads both rendered values off the message. `name` / `message` / `actual` / `expected` / `operator` are the documented shape; the error class is not exported, so catch and read the fields rather than `instanceof`.
- Comparison is **not** `toEqual`, and the divergences do not all run one way — the measured table lives in `binding-assertions.ts`'s module comment and in the migration. Stricter: key sets (an own `undefined`-valued property is not absent), prototypes (a class instance ≠ a same-shaped plain object), realms (jsdom's `structuredClone` returns jsdom-realm objects, so a spec cannot use it to fake a control that clones on write). Looser: `-0` equals `+0`, because `fast-equals` compares numbers with SameValueZero. Two cases needed code: `fast-equals` maps no comparator to `[object File]` / `[object Blob]` and falls through to `false` — so the helper supplies one comparing `name` / `size` / `type` / `lastModified` and deliberately **not** contents (`File.text()` is async), without which `mlv-file-upload`'s matrix is permanently red the moment its control stops returning the identical object; and the plain `deepEqual` overflows the stack on a cyclic value, so the **circular** comparator is used (2.44x per comparison, 0.015 ms across all ~500 matrix assertions — measured, and the reason the ratio lost).
- Guarded twice: `scripts/check-package-dependencies.mjs` fails workspace-wide on an undeclared bare import (its `DECLARATION_EXCEPTIONS` list is empty, and it fails on an unused entry, so it cannot grow one back quietly), and `src/lib/forms-binding-matrix.spec.ts` drives each of the four expectations to its failing side — an assertion helper that quietly stopped throwing would turn every `*-binding-matrix.spec.ts` in the workspace green having verified nothing — and sweeps every source under `testing/src` **recursively** (the barrel included) for an `import`, an `export … from` or a `require()` of a runner.
- `UiFormControl` / `UI_FORM_CONTROL` deleted (dead — nothing consumed them; form-field uses `contentChild(NgControl)`).

## Signal forms Phase 1 (2026-07)

- `MlvSignalFormUiControlBase` / `MlvSignalFormControlBase<T>` / `MlvSignalCheckboxControlBase` — the `FormValueControl` / `FormCheckboxControl` era counterparts of `FormControlBase`. Base owns the Malva field surface + connector, signal-forms field bindings (`errors`/`disabled`/`readonly`/`touched`/`dirty` inputs bound automatically by `[formField]`; field-bound booleans use `WriteT = unknown` transforms to satisfy the contract) and the `touch` output (replaces `onTouched`). Subclass supplies `value = model<T>(...)` (or `checked`) + `hasValue`. No CVA members — dual implementation is prohibited by the contract, controls swap bases atomically.
- Signal controls expose `resolvedState()`: the explicit `[state]` input wins when non-default; otherwise a non-empty bound `errors` collection becomes `error` after `touched` is true. `MlvFormControlWrapper` prefers this optional connector signal (falling back to legacy `state()`), and migrated hosts/messages/`aria-invalid` consume it so signal-form validation needs no consumer-authored state plumbing.
- **RISK GATE PASSED** (`signal-form-control-base.spec.ts`): a pure `FormValueControl` on the new base binds green under `[formControl]`, `ngModel`, AND `[formField]` on 22.0.7 — Phase 2 cutover unblocked.

## Field surface additions (2026-08)

- `MlvSignalFormUiControlBase` gained three shared inputs, so every control extending it inherits them:
  - `required` (`InputSignalWithTransform<boolean, unknown>`, `coerceBooleanProperty`) — also a
    signal-forms field binding, so a `required()` schema rule drives it automatically. Controls forward
    it to `<mlv-label [required]>` and set `aria-required` on their focus target.
  - `description` (`string`, `''`) — persistent help text rendered below the control as
    `<mlv-description>`, in front of the validation `message`. Both stay visible together.
  - `ariaLabel` (`string | null`, `null`) — accessible name for the focus target when no visible label
    exists. Previously duplicated per control (`mlv-input`, `mlv-select`, `mlv-checkbox`, …); those
    duplicates were removed so `[ariaLabel]` now works on every base-extending control.
- Protected helpers on the base: `_descriptionId()` / `_messageId()` (`<id>-description` / `<id>-message`)
  and `_describedBy()` — the space-separated `aria-describedby` value, `null` when neither element is
  rendered so no dangling IDREF is emitted. Controls render `<mlv-description [id]="_descriptionId()">`
  and `<mlv-message [id]="_messageId()">` to match.
- `MlvFormControlWrapper` gained two below-control projection slots next to `mlv-message`:
  `mlv-description` and `[mlvFormControlWrapperAside]` (control-owned auxiliary readout, e.g. the
  `mlv-textarea` character counter, which previously matched no slot and never reached the DOM).
- `MlvFormField.autoErrorMessage` no longer falls back to the literal `Validation error: <key>`; unknown
  validator keys resolve to the translated `formUtils.invalidValue` and a dev-mode `console.warn` names
  the key once per application run.

- `MlvFormField` dual source: `contentChild(FormField)` (signal path — reads `FieldState.errors()/touched()/dirty()` reactively, prefers rule-supplied `message`, maps `kind.toLowerCase()` onto the legacy error keys) with the `NgControl`+events path kept for reactive/template-driven. The legacy effect early-returns for `[formField]` children (the signals interop exposes a shim NgControl without `.events`). `submit` strategy proxies to touched under the signal path.

## Write permission — `_canWrite` / `_write` (2026-09, #298)

- **Neither forms layer blocks a write from a custom control.** Signal forms' `listenToCustomControlModel` forwards every `value` / `checked` model change unconditionally, and the reactive `FormValueControl` interop has no readonly concept at all. `readonly` / `disabled` are read-only _inputs_ to the control; honouring them is the control's job, and five controls (`mlv-number-input`, `mlv-checkbox`, `mlv-switch`, `mlv-slider`, `mlv-pin-input`) plus `mlv-radio-group`'s DOM did not.
- `MlvSignalFormUiControlBase._canWrite` — `protected` `computed`: `!readonly() && !computedDisabled()`. Gates **user** writes only. `computedDisabled()` already folds in the signal-forms `disabled()` rule and a reactive `FormControl.disable()`, and `readonly()` is the field-bound input a signal-forms `readonly()` rule drives.
- `_write(value): boolean` — `protected`, on `MlvSignalFormControlBase<T>` (writes `value`) and `MlvSignalCheckboxControlBase` (writes `checked`). Refuses and returns `false` while `!_canWrite()`, else writes and returns `true`. The return value is how a caller rolls back what the browser already did (a checked native checkbox or radio, a stale draft string, a typed pin cell).
- **Adopted by the six #298 controls only** — `mlv-number-input`, `mlv-checkbox`, `mlv-switch`, `mlv-slider`, `mlv-pin-input`, `mlv-radio-group`: in those, every user-driven write goes through it (key, pointer, wheel, paste, typed-draft commit, Enter handler).
- **Not yet adopted — still ignore `readonly` on at least one user path:** `mlv-day-picker`, `mlv-date-range-picker`, `mlv-time-picker`, `mlv-tokenizer`, `mlv-file-upload`, `mlv-color-picker`. Deferred to #402, with the cross-control contract matrix + guard the #298 ticket proposed. Do not read "the base has `_write`" as "every control honours readonly".
- **Principle: readonly locks out the user, not the application.** Gate user paths (Enter/Space/click/drag/wheel/paste/typing). A documented **application** API stays gated on disabled alone when that is what its JSDoc promises — `MlvSwitch.toggle()` (owner ruling, #298). A method that is really a user-event handler (`MlvCheckbox.toggle(event)`, bound to `(keydown.enter)`) is gated, and its JSDoc says it is the Enter handler.
- **Never gated:** the form→control direction (`[value]`, `[(value)]`, `[formField]`, `FormControl.setValue`), app code writing the model directly, and a control's own normalisation of a form-supplied value (`mlv-number-input`'s min/max clamp effect). Those keep writing `value.set` directly, on purpose.
- **Refused ≠ unhandled.** A key a readonly control recognises but refuses keeps its `preventDefault()` when the default would do something wrong (a slider thumb has no caret, so an arrow would scroll the page), and loses it when the default is useful (a number field's caret keys, page scroll on wheel). Navigation is never restricted by readonly (ARIA 1.2) — readonly radio arrows still move focus.
- Both members are `_`-prefixed `protected`, so not public API (VERSIONING.md). A subclass that adds a new user write path must route it through `_write`, and an element that only exists to write (a stepper, a clear button) binds its `disabled` to `!_canWrite()` — or is not rendered at all while `!_canWrite()`, which is what the wrapper clear button does (#301, see _Clearable value-gating_). Its handlers write through `_write`, so a click landing on a button rendered before the state flipped is still refused.
- Contract spec: `signal-form-control-base-write.spec.ts` — the truth table, refusal for both bases, the form direction ungated, and all three permission sources (input, signal-forms rule, reactive `disable()`).
