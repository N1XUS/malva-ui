# 2026-09 — filter condition controls are named by field, row and role

**Packages:**

- `@malva-ui/core/filter`
  - `mlv-filter`'s free-form condition editor.
  - `mlv-smart-filter-bar`, which renders `mlv-filter` for its fields.
  - `MlvFilterValueEditorContext`, which gains `ariaLabel` and `rangeAriaLabels`.
- `@malva-ui/i18n`
  - `MlvFilterI18n` gains five **optional** keys: `conditionStrategy`, `conditionOperator`, `conditionValue`, `rangeFrom` and `rangeTo`. They are declared in `MLV_FILTER_I18N_CONTEXT` too.
  - The shipped `filter.removeCondition` copy now takes `{label}` and `{index}` in all 14 packs.

**Kind:** breaking, **behaviour only**.

- No exported symbol was renamed or removed, and no input, output, token or parameter type was narrowed (row 109).
- The additions are the optional i18n keys and two new members of a context object the library builds. A context built by hand no longer compiles; see shape (d).
- VERSIONING §3 row 112 (_default behaviour … ARIA_): every condition control now gets a different default accessible name at an unchanged API.
- Routing those names through `MLV_FILTER_I18N`, as the filter docs already promised, is the row-117 half.
- The new keys are row 115 (_new optional i18n key with a shipped default_).
- This is `!` on `0.x`, so `0.1.15` → `0.2.0`.
- Fixes #330.

---

## Why

The template built each condition control's name by string concatenation, with no role word:

- The operator select and the value input of one condition carried the **same** name, "Status 1".
- A `between` range read "Status 1 1" / "Status 1 2".
- The AND / OR select carried the bare filter label.
- Every row's remove button read the same fixed string, "Remove condition".

A screen-reader user could not tell the controls of a condition apart, or one condition's remove button from the next (WCAG 2.4.6, 1.3.1). No axe rule reports duplicate names, so a full sweep with the editor open passed on the old markup. It still passes.

A custom `[mlvFilterValueEditor]` template got no name from its context at all. So a consumer control could only be named by hand, and was only as distinct as what was written. Docs example 4 hard-coded unnumbered English names.

## What changed

- Each control's name now comes from an ICU message taking `{label}` (the filter's `label` input), a 1-based `{index}` (the condition's row) and a role word.
- `mlv-filter` resolves the names per draft **count**, not per keystroke. They re-resolve on a language switch.
- The five new keys are **optional** on `MlvFilterI18n`:
  - `mlv-filter` carries an English fallback for each one, so a hand-written `MlvLanguage` still compiles.
  - All 14 shipped packs declare all five.
- `removeCondition` keeps its name and its `string` type.
  - It was read raw before. It is now resolved with `{label}` and `{index}`.
  - A string with no `{` still passes through verbatim.
- `MlvFilterValueEditorContext` gains two members:
  - `ariaLabel`: the name the built-in value input carries.
  - `rangeAriaLabels`: the `[from, to]` pair for a `between` range, supplied for every operator.

## Before / after

English pack, filter `label="Status"`, second condition:

| Control                                          | Key                 | Before                         | After                                                           |
| ------------------------------------------------ | ------------------- | ------------------------------ | --------------------------------------------------------------- |
| AND / OR select (only with 2+ conditions)        | `conditionStrategy` | "Status"                       | "Status, combine conditions"                                    |
| Operator select                                  | `conditionOperator` | "Status 2"                     | "Status, condition 2 operator"                                  |
| Value input                                      | `conditionValue`    | "Status 2"                     | "Status, condition 2 value"                                     |
| `between` lower input                            | `rangeFrom`         | "Status 2 1"                   | "Status, condition 2 from"                                      |
| `between` upper input                            | `rangeTo`           | "Status 2 2"                   | "Status, condition 2 to"                                        |
| Remove-condition button                          | `removeCondition`   | "Remove condition" (every row) | "Remove Status condition 2"                                     |
| Custom `[mlvFilterValueEditor]` template context | —                   | no name supplied               | `ariaLabel` "Status, condition 2 value", `rangeAriaLabels` pair |

The shipped packs translate each one. In German, for example:

- "Status, Bedingung 2: Operator"
- "Status, Bedingung 2: Wert"
- "Status, Bedingung 2: von" / "bis"
- "Status, Bedingungen verknüpfen"
- "Status: Bedingung 2 entfernen"

Live and explicit apply modes get the same names.

## Who is affected

**(a) Specs and e2e suites that locate or assert these names.** For example `getByRole('combobox', { name: 'Status 1' })`, `getByRole('textbox', { name: 'Status 1' })`, `getByRole('combobox', { name: 'Status', exact: true })` for the strategy, or `getByRole('button', { name: 'Remove condition' }).nth(1)`. Each now matches nothing, and that applies inside `mlv-smart-filter-bar` too.

Playwright matches a string `name` as a case-insensitive **substring** unless `exact: true` is passed. So a bare `{ name: 'Status' }` still matches, both before and after: it finds the strategy select and every operator select. That locator was ambiguous already, and this change does not fix it.

**Do:** locate by the new name (`{ name: 'Status, condition 1 operator' }`, `{ name: 'Remove Status condition 2' }`). The names are now unique, so `.nth()` is no longer needed.

**(b) Hand-written language packs.** A pack typed as `MlvLanguage` still compiles.

- The five new names fall back to **English**, so a German UI built on a hand-written pack now announces "Status, condition 1 operator". The old names carried the label but no role word.
- A plain `removeCondition` ("Remove condition") still resolves, but it names every row's button the same, which is the defect this fixes.
- `removeCondition` is now ICU-parsed whenever it contains `{`, because parameters are always passed. Before, it was used verbatim. So a literal brace, or an apostrophe directly before one, now needs ICU quoting (`'{'`, `''`).
- The i18n resolver has no error handling. An unquoted `{`, or any placeholder other than `{label}` / `{index}`, in a hand-written `removeCondition` **throws** in the resolver, and the condition editor then fails to render.

**Do:**

- Add `conditionStrategy` (`{label}`), plus `conditionOperator`, `conditionValue`, `rangeFrom` and `rangeTo` (`{label}`, `{index}`), to the pack's `filter` slice.
- Give `removeCondition` both `{label}` and `{index}`.
- Copy the wording from the nearest shipped pack.

**(c) Custom value editors with hand-written names.** A `<ng-template mlvFilterValueEditor>` whose control carries a fixed `ariaLabel` keeps it. But that name is the same on every row, and it does not follow the language pack. This is what `/filter` example 4 had.

**Do:** bind the context's names:

- `let-name="ariaLabel"` → `[ariaLabel]="name"`
- `let-range="rangeAriaLabels"` → `range[0]` / `range[1]` on a `between` pair

**(d) Code that builds an `MlvFilterValueEditorContext` by hand.** For example, a test fixture rendering an editor template through `createEmbeddedView(template, context)`, or a wrapper forwarding a context it assembles itself. It now fails to compile with TS2739 ("missing the following properties … `ariaLabel`, `rangeAriaLabels`").

**Do:** add both members: a string, and a `[from, to]` string pair. A context read from `mlv-filter` needs nothing.

## Who is not affected

- **Bounded / options editors.** The dropdown panel is still named by `label`, and its options by their labels.
- **The trigger's name and the popup dialog's name.** "Filter by Status", the valued `label: value` form and the query sentence are all unchanged. Their `": "` separator and English word order are follow-up #577.
- **The panel's action buttons.** "Add condition", "Clear", "Cancel" and "Apply" are unchanged.
- **`mlv-filter`'s own remove action on a query chip**, such as "Remove Country filter".
- **`mlv-smart-filter-bar`'s own chrome**, such as "Manage filters".
- **`mlv-data-table`'s filter dropdown.** It reads only the operator labels from `MLV_FILTER_I18N`. Its operator select's own `${operator}: ${column}` name is follow-up #578.
- **Anything else about the filter.** Values, conditions, emitted events, focus order and layout do not change; only names do.
