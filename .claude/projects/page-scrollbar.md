# Docs Page: Scrollbar

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/scrollbar`
- **Component:** `ScrollbarPageComponent` (`apps/docs/src/app/pages/scrollbar/index.ts`)

## Overview

A minimalistic custom scrollbar that hides the native browser scrollbar and renders a themed overlay track and thumb. Native scroll behaviour is preserved — only the visual presentation changes.

## Examples

| #   | Title             | What it demonstrates                                                                           |
| --- | ----------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Vertical Scroll   | Default `<mlv-scrollbar>` on a fixed-height text container. Shows rest vs hover thumb opacity. |
| 2   | Horizontal Scroll | `orientation="horizontal"` on a row of badges overflowing a fixed-width container.             |
| 3   | Both Axes         | `orientation="both"` on a fixed-size data grid with more rows and columns than visible.        |
| 4   | Inside a Card     | `mlv-scrollbar` composing inside `mlv-card` for a scrollable activity log list.                |

## Libraries Used

- `@malva-ui/core/scrollbar` — primary component library for this page
- `@malva-ui/core/badge` — tag chips in example 2, level badges in example 4
- `@malva-ui/core/card` — outer card shell in example 4
