# Docs Page: Badge

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/badge`
- **Component:** `BadgePageComponent` (`apps/docs/src/app/pages/badge/index.ts`)

## Overview

Compact labels for displaying status, counts, and categorical metadata with semantic tone variants.

## Examples

| #   | Title                          | What it demonstrates                                                                                                                                      |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Reserved for a call to action  | Solid fill reserved for a CTA/nav count badge (AB-R4) — only `primary` and `danger` render solid; the other six of the eight `tone` values render `muted` |
| 2   | Muted Variant                  | `muted` attribute switches to soft tint tokens; less visually dominant for inline labels and tags                                                         |
| 3   | Density Support                | `mlvDensity` input for compact/comfortable/spacious sizes; inheriting density from ancestor `mlvDensityRoot`                                              |
| 4   | Inline Usage with Content      | Badges as inline-flex elements alongside text, icons, and other components in real UI patterns                                                            |
| 5   | Dynamic Tone and Muted Binding | Binding `[tone]` and `[muted]` dynamically from data; toggling muted at runtime                                                                           |
| 6   | Icon slot                      | `mlvBadgeIcon` leading/trailing (`position="end"`) icons, density-tracked sizing, and the `--with-icon` gap                                               |

## Libraries Used

- `@malva-ui/core/badge` — primary component library for this page
- `@malva-ui/cdk/density` — density integration examples
- `@lucide/angular` — icons projected into the `mlvBadgeIcon` slot in example 6
