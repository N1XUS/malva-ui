# Docs Page: Avatar

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/avatar`
- **Component:** `AvatarPageComponent` (`apps/docs/src/app/pages/avatar/index.ts`)

## Overview

Avatars represent a user or entity with an image, initials, or a custom icon.

## Examples

| #   | Title                             | What it demonstrates                                                                                               |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Sizes & Shapes                    | Six sizes (xs–xxl), circle and square shape variants, and `mlvColorFromText` pipe for name-based background colors |
| 2   | Image with Loading & Fallback     | Shimmer skeleton while loading, fade-in on load, graceful fallback to initials when image fails                    |
| 3   | Custom Icon Content               | Projecting arbitrary icon/element content when no `src` or `name` is provided                                      |
| 4   | Explicit Initials & Custom Colors | `initials` input for custom abbreviations, `color` input for arbitrary CSS color values                            |

## Libraries Used

- `@malva-ui/core/avatar` — primary component library for this page
