# Docs Page: Status Indicator

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/status-indicator`
- **Component:** `StatusIndicatorPageComponent` (`apps/docs/src/app/pages/status-indicator/index.ts`)
- **Sidebar:** "Status Indicator" (icon `LucideRadar`) in the Components group, after "Stepper".

## Overview

Small circular status dot (`mlv-status-indicator`) for presence, health, or
state. Shares the badge/chip semantic tone vocabulary, supports an optional
infinite ripple `pulse` (respecting `prefers-reduced-motion`), and is decorative
by default with an opt-in accessible name via `ariaLabel`.

## Examples

| #   | Title    | What it demonstrates                                                                                       |
| --- | -------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Tones    | All eight `tone` values as coloured dots, each with an `ariaLabel` (colour is the only meaning carrier).   |
| 2   | Pulse    | `pulse` ripple on/off across success/danger tones, with adjacent text labels.                              |
| 3   | Composed | Inline next to a text label (decorative) and overlaid on a `mlv-avatar` as a presence badge (`ariaLabel`). |

## Libraries Used

- `@malva-ui/core/status-indicator` — primary component library for this page
- `@malva-ui/core/avatar` — the avatar the presence dot overlays in example 3
