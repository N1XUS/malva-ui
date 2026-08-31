# Docs Page: Title

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/title`
- **Component:** `TitlePageComponent` (`apps/docs/src/app/pages/title/index.ts`)

## Overview

Inline heading typography with semantic level inference, editable mode, and Angular forms integration.

## Examples

| #   | Title                      | What it demonstrates                                                                |
| --- | -------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Semantic Heading Levels    | Applying `mlvTitle` to native headings and letting the component infer the level    |
| 2   | Explicit Level Override    | Using a non-heading host with a chosen visual level and generated heading semantics |
| 3   | Editable Signal Model      | Editing a title with the `value` model API and synchronized overlay rendering       |
| 4   | Template-Driven Form Field | Using `[(ngModel)]` and `mlv-form-field` together                                   |
| 5   | Reactive Form Integration  | Binding the title through `formControlName` with validators                         |
| 6   | Signal forms               | Binding an editable title through `[formField]` with live value and touched state   |

## Libraries Used

- `@malva-ui/core/title` — primary component library for this page
- `@malva-ui/core/form-utils` — form field and label primitives used in form examples
