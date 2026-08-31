# Docs Page: Tile

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/tile`
- **Component:** `TilePageComponent` (`apps/docs/src/app/pages/tile/index.ts`)

## Overview

A compact, density-aware surface for short status and summary content, with a public compound-tree API for typed nested list/grid sorting and immutable updates.

## Examples

| #   | Title                  | What it demonstrates                                                                                                                                                              |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Density                | `mlvDensity` across tight, compact, comfortable, spacious, and airy; title/body typography and geometry change together                                                           |
| 2   | Tones                  | `tone` values color the complete outline without a one-sided status treatment                                                                                                     |
| 3   | Closable               | `closable` adds the standard close action and emits `(closed)` for consumer-owned removal                                                                                         |
| 4   | Sortable (Drag & Drop) | Flat immutable `mlv-tiles` model, `[tile]`, built-in handle, component-owned SortableJS feedback, and one `[dragDisabled]` pinned tile                                            |
| 5   | Compound tile tree     | One root `[(tree)]`, inherited nested `mlv-tiles`, typed policies, immutable Edit/Switch/Trash actions, grid/list sorting, and public primitives without a docs-owned drag engine |

Example 5 owns only its sample `kind`/`blockType` props, acceptance callback, and recursive presentation. The Tile package owns registration, stable-ID moves, cycle prevention, internal SortableJS grouping, policy caching, sorting, drag-clone geometry, source-footprint preservation, and feedback behavior.

## Libraries Used

- `@malva-ui/core/tile` — primary component library for this page
- `@malva-ui/cdk/density` — the shared density type used by example 1
- `@lucide/angular` — semantic density and time metadata icons

Examples import no drag-and-drop engine directly. `@malva-ui/core/tile` keeps its SortableJS integration private.
