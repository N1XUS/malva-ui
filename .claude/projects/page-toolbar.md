# Docs Page: Toolbar

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/toolbar`
- **Component:** `ToolbarPageComponent` (`apps/docs/src/app/pages/toolbar/index.ts`)

## Overview

A flex-based container for grouping action buttons and controls.

## Examples

| #   | Title                         | What it demonstrates                                                    |
| --- | ----------------------------- | ----------------------------------------------------------------------- |
| 1   | Basic Toolbar                 | Simple flex row with default gap (4px / 0.25rem)                        |
| 2   | Custom Gap                    | `[gap]` input in rem units                                              |
| 3   | Spacer                        | `<mlv-toolbar-spacer>` to push items apart                              |
| 4   | Equal Size                    | `[equalSize]="true"` distributes available space equally among children |
| 5   | Combined: Spacer + Equal Size | Spacer excluded from equal sizing while remaining items share space     |

## Libraries Used

- `@malva-ui/core/toolbar` — primary component library for this page
- `@malva-ui/core/button` — buttons used in examples
