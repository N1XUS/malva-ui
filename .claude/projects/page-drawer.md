# Docs Page: Drawer

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/drawer`
- **Component:** `DrawerPageComponent` (`apps/docs/src/app/pages/drawer/index.ts`)

## Overview

Slide-out panel for supplementary content and forms.

## Examples

| #   | Title                        | What it demonstrates                                                                                                                                     |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Right Drawer                 | Header, sections, `form[mlvForm]` fields, and close button; slides in from the right with configurable animation                                         |
| 2   | Bottom Sheet                 | Bottom drawer with `resizable` and `snapPoints`; drag handle snaps to 40%/80%/100%; swipe-to-dismiss and keyboard resize                                 |
| 3   | Routable / Imperative Drawer | `mlvGenerateRoutableDrawerRoute()` route helper and `MlvDrawerService.open()` with injector forwarding; component injects `MlvDrawerRef` to close itself |

## Libraries Used

- `@malva-ui/core/drawer` — primary component library for this page
