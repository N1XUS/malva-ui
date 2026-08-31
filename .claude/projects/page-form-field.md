# Docs Page: Form Field

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/form-field`
- **Component:** `FormFieldPageComponent` (`apps/docs/src/app/pages/form-field/index.ts`)

## Overview

Wrapper component for form controls that provides labels, hints, validation messages, and display strategies.

## Examples

| #   | Title                 | What it demonstrates                                                                                                        |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Reactive Forms        | Auto-displayed validation errors when touched and invalid; default `touched` display strategy                               |
| 2   | Display Strategies    | Each field uses a different `displayStrategy` to control when validation errors appear                                      |
| 3   | Template-Driven Forms | `ngModel` integration; errors auto-display on touched invalid fields; submit button binds a definite boolean disabled state |
| 4   | Signal Forms          | Full schema-driven form using `[formField]`; automatic messages, touch state, validation, and guarded submission            |

## Libraries Used

- `@malva-ui/core/form-utils` — primary component library for this page
- `@malva-ui/core/input` — input component used in examples
- `@malva-ui/core/checkbox` — boolean field used in the binding examples
- `@malva-ui/core/select` — typed option selection used in the binding examples
- `@malva-ui/core/radio` — grouped choice control used in the binding examples
- `@malva-ui/core/button` — form submission actions
- `@angular/forms/signals` — Signal Forms model, schema validation, field binding, and submission
