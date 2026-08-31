# Docs Page: Expand

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/expand`
- **Component:** `ExpandPageComponent` (`apps/docs/src/app/pages/expand/index.ts`)

## Overview

Expandable panel with smooth `grid-template-rows` CSS animation. Supports eager (`ng-content`) and lazy (`[mlvExpandContent]` structural directive) content initialization.

## Examples

| #   | Title                          | What it demonstrates                                                                            |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1   | Basic Usage                    | A consumer-owned `<button>` driving `panel.toggle()` through a template ref; eager `ng-content` |
| 2   | Two-Way Binding                | `[(opened)]` model binding with external open/close buttons                                     |
| 3   | Accordion                      | Multiple panels stacked with connected border styling                                           |
| 4   | Lazy Content Initialization    | `[mlvExpandContent]` — nothing inside is constructed until the panel first opens                |
| 5   | Rich Triggers & Disabled State | Icon/badge-rich consumer triggers and the `disabled` input                                      |

> `mlv-expand` is headless: it has **no** `label` input and **no**
> `[mlvExpandLabel]` slot. Every trigger in these examples is markup the example
> owns, bound to `toggle()` / `opened()` through a template reference variable.

## Libraries Used

- `@malva-ui/core/expand` — primary component library for this page
- `@malva-ui/core/button` — trigger buttons in examples 2
- `@malva-ui/core/badge` — status indicators in examples 2, 4, 5
