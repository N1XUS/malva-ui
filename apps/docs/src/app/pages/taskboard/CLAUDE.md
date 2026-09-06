# Docs Page: Taskboard

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/taskboard`
- **Component:** `TaskboardPageComponent` (`apps/docs/src/app/pages/taskboard/index.ts`)
- **Nav group:** Data display · **Nav icon:** `kanban` (`LucideKanban`)
- **API tab:** `header="taskboard"`, paired through the `API_OVERRIDES` entry `{ family: 'taskboard', entry: '' }` — the package has no subpaths.

## Overview

The standalone `@malva-ui/taskboard` package: a typed, **controlled** Kanban board (`mlv-taskboard`) that owns no data. Every example binds `items` and `columns` as two-way models and answers each policy question with its own callback. The page covers projected card templates, column groups and swimlanes, WIP limits, transition/lock/`canDropFn` policies and the async `beforeMove` guard, multi-select, replaceable slots, density and RTL, virtual cells, and the imperative history/snapshot/export/print surface.

Every example imports the published entry point `@malva-ui/taskboard` — never `@malva-ui/core/taskboard`, which does not exist, and never a `libs/` or `/src/lib/` path. `index.spec.ts` asserts that mechanically across all eight folders.

## Examples

| #   | Title                                       | What it demonstrates                                                                                                                                                                                                                    |
| --- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Basic projected board                       | `dataKey` / `columnField`, a projected `mlvTaskboardItemDef` with its `…From` type carrier, and `(moved)` — the smallest controlled board                                                                                               |
| 2   | Phases, swimlanes, WIP limits, and collapse | `columnGroups` runs, `swimlanes` + `swimlaneField`, per-column/group/lane `wipLimit`, and the consumer-owned collapse toggle the board renders but never writes (R24)                                                                   |
| 3   | Transitions, locks, and a drop policy       | `transitions`, `lockedItemIds`, `canDropFn`, and `(moveCancelled)` reporting the recorded `MlvTaskboardDenialReason`                                                                                                                    |
| 4   | Selection and bulk actions                  | The `selection` `ReadonlySet` model, click / `Ctrl`-click / `Shift`-click semantics, and a toolbar acting on the selected keys                                                                                                          |
| 5   | Custom slots and a context menu             | `mlvTaskboardHeaderDef`, `mlvTaskboardColumnHeaderDef`, `mlvTaskboardItemDef`, `mlvTaskboardCardAddDef`, `mlvTaskboardEmptyStateDef`, `mlvTaskboardDropIndicatorDef`, and `(contextMenu)` driving a wrapper's `[mlvContextMenuTrigger]` |
| 6   | Density and RTL                             | `[mlvDensity]` on the board itself, the four density custom properties, and a second board inside a scoped `dir="rtl"` wrapper                                                                                                          |
| 7   | Virtual columns                             | `virtualItemSize` over 500 cards, a `visibleItems` filter fed by `mlv-search-field`, and the keyboard focus that scrolls an off-window card in before landing on it                                                                     |
| 8   | History, snapshots, export and print        | `undo()` / `redo()`, `snapshot()` / `restore()`, `exportJson()` / `exportCsv()`, `print()`, and a `beforeMove` guard awaiting `MlvDialogService.confirm()`                                                                              |

## Libraries Used

- `@malva-ui/taskboard` — the standalone package this page documents; imported by all eight examples
- `@malva-ui/core/button` — toolbar and header actions in examples 2, 4, 5, 8
- `@malva-ui/core/menu` — `[mlvContextMenuTrigger]` and the panel it opens in example 5
- `@malva-ui/core/list` — the menu panel's items in example 5
- `@malva-ui/core/segmented` — the density switcher in example 6
- `@malva-ui/cdk/density` — the `MlvDensity` type bound by that switcher in example 6
- `@malva-ui/core/search-field` — the `visibleItems` filter in example 7
- `@malva-ui/core/dialog` — `MlvDialogService.confirm()` behind the `beforeMove` guard in example 8
