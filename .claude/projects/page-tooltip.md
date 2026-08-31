# Docs Page: Tooltip

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/tooltip`
- **Component:** `TooltipPageComponent` (`apps/docs/src/app/pages/tooltip/index.ts`)

## Overview

Contextual floating labels that appear on hover and focus. Supports configurable placement, tone variants, and an optional directional arrow.

## Examples

| #   | Title         | What it demonstrates                                                                        |
| --- | ------------- | ------------------------------------------------------------------------------------------- |
| 1   | Basic Usage   | `[mlvTooltip]` on buttons; default neutral tooltip on top placement                         |
| 2   | Placement     | Four buttons showing `top`, `bottom`, `left`, `right` placement                             |
| 3   | Tone Variants | All seven tone variants: `neutral`, `surface`, `primary`, `success`, `warning`, `danger`, `info` |
| 4   | Advanced      | Icon-only button (accessibility), 500 ms delay, `[tooltipArrow]="false"`, disabled tooltip  |

## Libraries Used

- `@malva-ui/core/tooltip` — primary library for this page
- `@malva-ui/core/button` — trigger buttons in all examples
- `@lucide/angular` — icons used in example 4 (LucideTrash2, LucideInfo, LucideSettings)
