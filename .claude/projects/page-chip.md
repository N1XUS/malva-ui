# Docs Page: Chip

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/chip`
- **Component:** `ChipPageComponent` (`apps/docs/src/app/pages/chip/index.ts`)

## Overview

Interactive labels for tags, filters, and selected items. Extends the badge concept with prepend/append slot directives, closable mode, floating elevation, and density-aware sizing.

## Examples

| #   | Title                                 | What it demonstrates                                                                                                                              |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Reserved for a call to action         | Solid fill reserved for a primary CTA (AB-R4) — only `primary` and `danger` render solid; the other six of the eight `tone` values render `muted` |
| 2   | Muted Tone Mode                       | `muted` attribute switches to soft tint tokens                                                                                                    |
| 3   | Closable Chips                        | `closable` + `(chipClose)` for dismissible filter tags                                                                                            |
| 4   | Prepend & Append Slots                | `mlvChipPrepend` / `mlvChipAppend` with Lucide icons                                                                                              |
| 5   | Floating Variant & All Density Levels | `floating` shadow + all five `mlvDensity` levels (tight/compact/comfortable/spacious/airy) with per-chip and ancestor-inherited demos             |

## Libraries Used

- `@malva-ui/core/chip` — primary component library for this page
- `@lucide/angular` — icons in examples 4 and 5
