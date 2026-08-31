# Docs Page: Sidebar

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/sidebar`
- **Component:** `SidebarPageComponent` (`apps/docs/src/app/pages/sidebar/index.ts`)

## Overview

A sidebar provides navigation and can be collapsed to save space.

The public `appearance` input accepts `MlvSidebarAppearance` (`'raised' | 'flat'`)
and defaults to `'raised'`. Opt in to `'flat'` when the sidebar should retain its
border and background but remove its outer radius and shadow.

## Examples

| #   | Title                        | What it demonstrates                                                                                                                                                                                                                    |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Basic Sidebar                | Three top-level items + three collapsible groups (Projects, Reports, Team) + bottom-pushed Settings/Help via `<mlv-spacer />`                                                                                                           |
| 2   | Header & Footer              | Styled `mlv-sidebar-workspace` switcher with structural logo/text templates and a three-workspace menu, 5 items + 2 groups, Settings/Get Help/Search after spacer, user identity footer                                                 |
| 3   | Badges & Dividers            | Mail-style inbox with items across 3 `mlv-divider` sections; count badges via the `badge`/`badgeTone` inputs (info/warning/danger/success/default) — collapse the rail to see each badge become a `mlv-status-indicator` dot            |
| 4   | Skeleton Loading             | Loading state with skeleton header, 7 skeleton content rows, and skeleton footer; loaded state with workspace + items + user                                                                                                            |
| 5   | Resize Rail                  | `mlv-sidebar-rail` with drag-to-resize plus a full app-shell layout (header, body, 4-stat cards) on the right                                                                                                                           |
| 6   | Offcanvas / Drawer           | `mode="offcanvas"` with workspace header, 3 items + 2 groups, Settings/Help, user footer; main content with menu trigger and 3 stats                                                                                                    |
| 7   | Floating Variant             | `mode="floating"` hovering over an offset main content area with title and 3 app cards                                                                                                                                                  |
| 8   | Nested Submenus with Actions | Admin Console: 4 grouped sections (Users & Access, Content, Commerce, System) with `badge`/`badgeTone` action badges on items and the Users & Access group (its collapsed flyout title carries the badge), divider, Settings/Help, user |
| 9   | Responsive (collapseBelow)   | `collapseBelow="md"` flips the sidebar to an offcanvas drawer below 768px with no host wiring; `mlv-sidebar-trigger` sits outside `<mlv-sidebar>` via `[sidebar]="nav"` and becomes a hamburger button; also shows `ariaLabel`          |
| 10  | Surface appearance           | Default `appearance="raised"` alongside opt-in `appearance="flat"`; flat removes only the outer radius and shadow while preserving the sidebar border and background, and Page Shell remains responsible for its chrome seam            |

## Responsive usage

Set `collapseBelow` (`'sm' | 'md' | 'lg'`, default `null`) and the sidebar handles the breakpoint itself: below that width `effectiveMode()` reports `'offcanvas'`, the sidebar closes itself, and `mlv-sidebar-trigger` becomes a hamburger menu button. Above it the authored `mode` and the previous collapsed state come back. Thresholds come from `MLV_BREAKPOINT_CONFIG` (`provideMlvBreakpoints()`), matching the SCSS `breakpoint-*` mixins. See Example 9.

An offcanvas drawer renders no projected content while closed, so put the trigger **outside** `<mlv-sidebar>` and bind `[sidebar]="nav"` to the sidebar's template reference — a nested trigger disappears with the drawer. Driving `mode` from your own `BreakpointObserver` signal still works when you need a non-offcanvas responsive behaviour.

## Libraries Used

- `@malva-ui/core/sidebar` — primary component library for this page
- `@malva-ui/core/avatar` — user avatar in header/footer examples
- `@malva-ui/core/badge` — notification counts on sidebar items/groups when expanded (rendered internally via the `badge` input)
- `@malva-ui/core/status-indicator` — collapsed-rail status dot that replaces the badge (rendered internally via the `badge` input)
- `@malva-ui/core/button` — toggle buttons in offcanvas/floating examples
- `@malva-ui/core/divider` — section separators
- `@malva-ui/core/skeleton` — loading placeholder rows
- `@malva-ui/cdk/utils` — `MlvSpacer` for flex spacing
