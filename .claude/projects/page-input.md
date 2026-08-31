# Docs Page: Input

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/input`
- **Component:** `InputPageComponent` (`apps/docs/src/app/pages/input/index.ts`)

## Overview

Text input field with support for prefixes, suffixes, validation states, and disabled mode.

## Examples

| #   | Title           | What it demonstrates                                                                      |
| --- | --------------- | ----------------------------------------------------------------------------------------- |
| 1   | Basic           | Simple text input with prefix and suffix content projections                              |
| 2   | States          | Validation states (error, success, warning) with corresponding messages                   |
| 3   | Disabled        | Disabled input field that prevents user interaction                                       |
| 4   | Content Density | Locally scoped density switcher showing how inputs scale without changing the docs shell  |
| 5   | Signal forms    | `[formField]` binding with schema validation, value synchronization, and live field state |

## Libraries Used

- `@malva-ui/core/input` — primary component library for this page
- `@malva-ui/core/form-utils` — form field wrapper used in examples
