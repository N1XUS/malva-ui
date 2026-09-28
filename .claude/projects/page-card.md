# Docs Page: Card

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/card`
- **Component:** `CardPageComponent` (`apps/docs/src/app/pages/card/index.ts`)

## Overview

Cards are surface containers that group related content and actions.

## Examples

| #   | Title                      | What it demonstrates                                                                        |
| --- | -------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Sizes                      | Three sizes (s, m, l) adjusting padding, border-radius, gap, and typography                 |
| 2   | Elevation                  | `[elevated]="true"` for drop shadow; hover lifts card with deepened shadow and `translateY` |
| 3   | Header with Action Buttons | `mlvCardHeader` and `mlvCardActions` for heading and icon buttons on the same row           |
| 4   | Background Image           | `[backgroundImage]` URL for full-cover background with overlay for readable text            |
| 5   | Footer Variations          | Footer with links, a `withBorder` button pair, or a single `fullWidth` action               |
| 6   | Minimal Card               | Body content only — no header, subheading, or footer                                        |
| 7   | Card with form             | A card wrapping a form built from `mlv-form-field` / `mlv-input` / `mlv-toolbar`            |
| 8   | Body layout                | `bodyLayout="stack"` and the size-scaled `--mlv-card-body-gap`                              |

## Libraries Used

- `@malva-ui/core/card` — primary component library for this page
- `@malva-ui/core/form-utils`, `@malva-ui/core/input`, `@malva-ui/core/toolbar` — form example 7
- `@malva-ui/core/badge`, `@malva-ui/core/button` — body-layout example 8
