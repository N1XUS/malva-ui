# Docs Page: Bottom Nav

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/bottom-nav`
- **Component:** `BottomNavPageComponent` (`apps/docs/src/app/pages/bottom-nav/index.ts`)

## Overview

Fixed bottom navigation bar for mobile contexts with vertical/horizontal stacking, active-only label reveal, and automatic overflow menu.

## Examples

| #   | Title                       | What it demonstrates                                                                                                   |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Basic Usage                 | Four navigation items with icons and labels in default vertical stacking                                               |
| 2   | Overflow Behavior           | Six items triggering the automatic overflow — first 4 shown, "More" button opens a menu with hidden items              |
| 3   | Custom Aria Label           | Using the `ariaLabel` input to provide a custom accessible label for the navigation landmark                           |
| 4   | Stacking & Label Visibility | Interactive toggle between vertical/horizontal stacking and always/active-only label visibility                        |
| 5   | Horizontal Active-Only      | Horizontal stacking with `labelVisibility="active-only"` — icons only, active item reveals label with smooth animation |
| 6   | Programmatic Active State   | Managed mode without router — `activeIndex` input + `(itemClick)` output; clicking items sets the active state         |
| 7   | Disabled Item               | Items with `disabled: true` are visually muted and non-interactive                                                     |

## Libraries Used

- `@malva-ui/core/bottom-nav` — primary component library for this page
- `@malva-ui/cdk/utils` — `MlvNavItem` interface
- `@lucide/angular` — icon registration via `provideLucideIcons`
