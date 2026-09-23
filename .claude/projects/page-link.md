# Docs Page: Link

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/link`
- **Component:** `LinkPageComponent` (`apps/docs/src/app/pages/link/index.ts`)

## Overview

Anchor element with visual variants for navigation.

## Examples

| #   | Title         | What it demonstrates                                                                               |
| --- | ------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Variants      | Default, subtle, emphasized (`routerLink` to `/button`, `/kbd`, `/list`) and disabled (`href="#"`) |
| 2   | Side variants | `*mlvLinkBefore` / `*mlvLinkAfter` slots: chevrons (`/kbd`, `/list`), a badge (`/notification`)    |

- Enabled links carry a **real destination** (`routerLink` to a docs route), never `href="#"`: since #309 an enabled `a[mlvLink]` follows its `href` natively, and under the docs `<base href="/">` a `#` resolves to `/#` — a full reload onto the home page.
- The disabled link keeps `href="#"` — the guard cancels its activation, so the value is never followed.
- In the StackBlitz playground (`provideRouter([])`) the enabled links match no route, as in `segmented` example 2.

## Libraries Used

- `@malva-ui/core/link` — primary component library for this page
- `@angular/router` — `RouterLink` on the enabled links
