---
name: page-tree
description: Documentation for the Tree docs page at apps/docs/src/app/pages/tree/
type: project
---

# Docs Page: tree

**Route:** `/tree`
**Component:** `TreePageComponent`
**Path:** `apps/docs/src/app/pages/tree/`
**Nav icon:** `LucideListTree`
**Nav group:** Components

## Examples

| #   | File          | Title                   | What it demonstrates                                                                                                                                         |
| --- | ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `examples/1/` | Basic tree              | Expand/collapse with a file-explorer hierarchy                                                                                                               |
| 2   | `examples/2/` | Single-select           | Click to select categories, `selectionChange` output                                                                                                         |
| 3   | `examples/3/` | Multi-select checkboxes | Permission tree with checkbox multi-select                                                                                                                   |
| 4   | `examples/4/` | Lazy loading            | Simulated async `loadChildren` with 1.2s delay and spinner; Antarctica fails once, reported from `loadError` in a `role="status"` line, expand again retries |
| 5   | `examples/5/` | Custom node template    | `[mlvTreeNodeDef]` with file icons and size info                                                                                                             |

## Wiring

- Route added to `apps/docs/src/app/app.routes.ts`
- Sidebar entry in `componentItems` array in `apps/docs/src/app/app.ts`
- Icon: `LucideListTree`
