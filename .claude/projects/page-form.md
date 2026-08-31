# Docs Page: Form

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/form`
- **Component:** `FormPageComponent` (`apps/docs/src/app/pages/form/index.ts`)
- **Group:** layout · **Icon:** `list-checks` · **API:** `@malva-ui/core/form` (default resolution)

## Overview

Layout shell for native forms: density-scaled stack, fieldset grids, header and action rows, and one density source for every control inside.

## Examples

| #   | Title                    | What it demonstrates                                                                                                                                 |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Stacked form             | `form[mlvForm]` + `maxWidth`, `[mlvFormHeader]` with `mlvTitle`, `mlv-form-field`s, `[mlvFormActions align="end"]`                                   |
| 2   | Fieldsets                | auto grid, `[columns]="2"` + `mlvFieldsetSpan="full"`, `legend` + `description`, projected `<legend>`, nested fieldsets with `gap`, `minColumnWidth` |
| 3   | Density and gap          | live `[mlvDensity]` on the form resizes inputs/selects/checkboxes/buttons; `gap` override                                                            |
| 4   | In a dialog and a drawer | form inside `mlv-dialog` and `mlv-drawer` bodies (unclipped focus rings, vertical stacking)                                                          |
| 5   | Bare fieldsets           | plain `<fieldset>` fallback vs `mlvFieldset`                                                                                                         |

## Libraries Used

- `@malva-ui/core/form` — primary
- `@malva-ui/core/form-utils`, `@malva-ui/core/input`, `@malva-ui/core/select`, `@malva-ui/core/checkbox`, `@malva-ui/core/button`, `@malva-ui/core/title`, `@malva-ui/core/toolbar`, `@malva-ui/core/dialog`, `@malva-ui/core/drawer`, `@malva-ui/cdk/utils`, `@malva-ui/cdk/density`
