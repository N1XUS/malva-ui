# Docs Page: Toast

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/toast`
- **Component:** `ToastPageComponent` (`apps/docs/src/app/pages/toast/index.ts`)

## Overview

Lightweight notifications with a title and optional description, auto-dismissing after a configurable duration.

## Examples

| #   | Title                             | What it demonstrates                                                                                                                                                                                                                                                                           |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Basic Toast                       | `MlvToastService.show()` with title and description; top-right default position; auto-dismiss in 4 s; manual X close                                                                                                                                                                           |
| 2   | Tones                             | `success()`, `error()`, `warning()`, `info()` convenience methods with colored accent bar and status tokens                                                                                                                                                                                    |
| 3   | Positioning                       | Six screen positions; toasts stack in the direction away from the anchor edge                                                                                                                                                                                                                  |
| 4   | Timer, Hover Pause & Non-Closable | `displayTime`, `pauseOnHover`, `closable: false`; `MlvToastRef` for programmatic dismissal                                                                                                                                                                                                     |
| 5   | Programmatic Content              | Content-rich `open()`: string + tone icon, `mlv-avatar` + action template, `mlv-badge` + multi-line template, and a component driving its own `mlv-loader` spinner. Inner elements use `mlvDensity="compact"` / small sizes and a `[strokeWidth]="2"` spinner to stay proportionate to the bar |
| 6   | Shape and Tone Icon               | `shape: 'pill'` vs the default rectangle; `icon: true` tone-derived Lucide glyph; `tone: 'default'` renders no icon                                                                                                                                                                            |

## Libraries Used

- `@malva-ui/core/toast` — primary component library for this page
