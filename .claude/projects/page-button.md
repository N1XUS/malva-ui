# Docs Page: Button

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/button`
- **Component:** `ButtonPageComponent` (`apps/docs/src/app/pages/button/index.ts`)

## Overview

Buttons trigger actions or navigation.

## Examples

| #   | Title           | What it demonstrates                                                                                                                               |
| --- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Variants        | Everyday variants in one row (at most two saturated fills, AB-R8); `error`/`warning`/`info` shown separately as reserved for a single blocking CTA |
| 2   | Sizes           | Density-driven tight, compact, comfortable, spacious, and airy sizing                                                                              |
| 3   | Shapes          | Default, circle, and square shapes across all variants                                                                                             |
| 4   | Disabled        | Disabled state preventing interaction                                                                                                              |
| 5   | Long text       | `mlvFade` directive for scrollable text with fade effect when content overflows                                                                    |
| 6   | Status variants | Error, warning, and info semantic variants for destructive/cautionary/informational actions                                                        |
| 7   | Slots           | `mlvButtonBefore` / `mlvButtonAfter` template slots around the label                                                                               |
| 8   | Loading state   | Switch-controlled `loading` input with a spinner, stable width, and accessible busy state                                                          |
| 9   | Close button    | `mlv-button-close` across densities and its two variants                                                                                           |
| 10  | Icon-only       | Inferred icon-only sizing without `mlvButtonIcon` and the neutral `secondary` shape default                                                        |

## Libraries Used

- `@malva-ui/core/button` — primary component library for this page
- `@malva-ui/cdk` — `MlvFade` used in example 5
- `@malva-ui/core/switch` — interactive loading-state control used in example 8
