---
name: page-progress
description: Documentation for the Progress docs page at apps/docs/src/app/pages/progress/
type: project
---

# Docs Page: progress

**Route:** `/progress`
**Component:** `ProgressPageComponent`
**Path:** `apps/docs/src/app/pages/progress/`
**Nav icon:** `LucideGauge`
**Nav group:** Components (componentItems)

## Examples

| #   | File          | Title                               | What it demonstrates                                                               |
| --- | ------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | `examples/1/` | Bar — basic                         | Minimal bar with `value` binding and an explicit `ariaLabel`                       |
| 2   | `examples/2/` | Bar — size variants                 | Small, medium, large bars side by side                                             |
| 3   | `examples/3/` | Bar — tone variants                 | All 5 semantic tones with fixed value                                              |
| 4   | `examples/4/` | Bar — show percentage               | `showPercentage` on bar, plus a projected label that names it (no `ariaLabel`)     |
| 5   | `examples/5/` | Circle — basic                      | Minimal SVG circle with animated dashoffset                                        |
| 6   | `examples/6/` | Circle — size variants + percentage | Small/medium/large with centered percentage; `ariaLabel` extends the visible label |
| 7   | `examples/7/` | Circle — tone variants              | All 5 semantic tones as circles                                                    |

## Wiring

- Route added to `apps/docs/src/app/app.routes.ts` after `pagination`
- Sidebar entry in `componentItems` array in `apps/docs/src/app/app.ts` after Loader
- Icon: `LucideGauge` (new import)
