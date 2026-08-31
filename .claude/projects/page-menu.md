---
# Docs Page: Menu

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/menu`
- **Component:** `MenuPageComponent` (`apps/docs/src/app/pages/menu/index.ts`)

## Overview

Dropdown action menus with keyboard navigation, grouped items, separators, and nested submenus with triangle pointer tracking to prevent accidental closure on diagonal mouse movement.

## Examples

| #   | Title          | What it demonstrates                                                                                                                                                                                                                                                    |
| --- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Basic Menu     | `[mlvMenuTrigger]` on a button; `mlv-menu-item` with `(itemClick)`; `mlv-menu-separator`                                                                                                                                                                                |
| 2   | Grouped Items  | `mlv-menu-group` with `[mlvMenuGroupLabel]`; disabled items skipped in keyboard navigation                                                                                                                                                                              |
| 3   | Icons in Items | Lucide icons projected into `mlv-menu-item` content slot                                                                                                                                                                                                                |
| 4   | Nested Submenu | `[isSubmenuTrigger]="true"` on a menu item; triangle pointer tracking for safe diagonal cursor movement; submenu item selection closes the full menu stack                                                                                                              |
| 5   | Menu Bar       | `mlv-menubar` File / Edit / View row: `role="menubar"`, roving tabindex + ArrowLeft/Right/Home/End across top-level items, open-follow (arrow/hover to a sibling while open switches menus), in-menu ArrowRight/Left crossing, a submenu under View, and Escape restore |

## Libraries Used

- `@malva-ui/core/menu` — primary library for this page (includes `mlv-menubar` in example 5)
- `@malva-ui/core/button` — trigger buttons in all examples
- `@malva-ui/core/divider` — separators in examples 1 and 5
- `@lucide/angular` — icons in examples 3, 4, and 5 (LucideChevronRight, LucideSettings, etc.)
