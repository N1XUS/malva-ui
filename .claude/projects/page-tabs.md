# Docs Page: Tabs

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/tabs`
- **Component:** `TabsPageComponent` (`apps/docs/src/app/pages/tabs/index.ts`)

## Overview

Tabs organize content into separate views where only one view is visible at a time.

## Examples

| #   | Title                 | What it demonstrates                                                                                                                                                                                                     |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Basic Horizontal Tabs | Horizontal tabs with animated active indicator; includes a disabled tab                                                                                                                                                  |
| 2   | Vertical Tabs         | `orientation="vertical"` for a vertical tab stack                                                                                                                                                                        |
| 3   | Overflow              | Overflow tabs accessible via popup when tabs exceed container width                                                                                                                                                      |
| 4   | Nested Tabs           | Tab groups nested inside each other; independent active state per level                                                                                                                                                  |
| 5   | Boxed & routable tabs | `appearance="boxed"` filled active surface + tabs driven by `routerLink` (URL-derived active via `Router.isActive`, deep-linkable, middle-clickable header links). Uses `?demoTab=` query params so it stays on `/tabs`. |

## Libraries Used

- `@malva-ui/core/tabs` — primary component library for this page
- `@malva-ui/core/popup` — overflow popup in example 3
- `@angular/router` — `RouterLink` on `<mlv-tab>` in example 5 (boxed & routable)
