# Docs Page: Action Bar

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/action-bar`
- **Component:** `ActionBarPage` (`apps/docs/src/app/pages/action-bar/index.ts`)

## Overview

An action bar provides a flexible top- or bottom-anchored container for navigation chrome, logos, and action controls. It supports a default full-width bar and a content-width floating pill variant, plus an inverted `contrast` surface and enter/leave animations driven by Angular's built-in `animate.enter` / `animate.leave` host attributes.

## Examples

| #   | Title                      | What it demonstrates                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Basic Action Bar           | A basic full-width action bar used as a navigation container                                                                                                                                                                                                                                                                                                                                                                 |
| 2   | Floating selection toolbar | Multi-select `mlv-data-table` paired with a bottom-anchored `shape="pill"` + `contrast` + `wrap` action bar guarded by `@if`, so `animate.enter` / `animate.leave` drive a smooth slide-in / slide-out as the selection count changes; the primary `×` button clears the selection to show the leave animation. `wrap` reflows the eight controls onto a second line once the pill hits its width cap instead of overflowing |

## Libraries Used

- `@malva-ui/core/action-bar` — primary component library for this page
- `@malva-ui/core/data-table` — multi-select table that drives the floating toolbar in example 2
- `@malva-ui/core/button` — action buttons inside the contrast pill bar
- `@lucide/angular` — icon set (`LucideDownload`, `LucideArchive`, `LucideTrash2`, `LucideX`) used in example 2
