# Library: taskboard

## Overview

`@malva-ui/taskboard` is a standalone, publishable Angular Kanban board package. It is never a `@malva-ui/core` secondary entry point.

## Package contract

- Public import: `@malva-ui/taskboard`.
- Runtime drag support uses package-private `sortablejs`; consumers do not import it.
- Peer dependencies: Angular CDK/common/core, `@malva-ui/cdk`, and `@malva-ui/i18n`.
- Run its suite with `yarn nx test taskboard`.

## Interaction contract

- Pointer/touch drags never reorder the DOM: both SortableJS adapters answer `onMove` with `false` and commit an immutable replacement collection instead.
- Card drops run the pure move engine, then the optional `beforeMove` guard (sync or async). Every non-committing outcome leaves `items` referentially unchanged and emits `moveCancelled` with a concrete reason.
- Column headers reorder by pointer: locked columns keep their absolute index, `canReorderColumnFn` may veto an order, and a moved column adopts its new neighbours' `groupId`.
- Group headers render as contiguous runs of consecutive columns sharing a `groupId`; an ungrouped run renders as an unlabeled spacer.
- Selection is pointer-driven: a plain click replaces it, `Ctrl`/`Cmd` toggles the clicked card, `Shift` selects the inclusive run from the anchor in rendered board order (swimlane row-major, then column order, then card index). The board never prunes a key `visibleItems` hides, and writes `selection` only when the set really changed.
- Exactly one card is tabbable — the last focused one, else the first card in reading order. `Space` grabs, arrows move the target slot, `Space` commits through the same guarded flow a pointer drop enters, `Escape` and blur cancel, `Enter` activates. Horizontal arrows go through `MlvRtlService.normalizeArrowKey`, so `ArrowLeft` means "next column" inside an RTL subtree. No `aria-grabbed` / `aria-dropeffect`; a visually-hidden instruction element is referenced by `aria-describedby` from every card, and every outcome is announced in the polite live region.
- A drag session records why each refused slot refused, next to the slots it authorised: `MlvTaskboardDenialReason` is `locked` → `transition` → `wip` → `policy`, first failing gate wins, read back through `session.denialFor(...)` or the `denials` map. Announcements state that recorded reason instead of re-deriving one, so what the board says can never contradict what it refused. The slot the card already occupies is neither allowed nor refused: `Space` there ends the grab in place — no `moved`, no `moveCancelled`, `items` untouched.
- `virtualItemSize` (a positive finite number) opts every cell into a `cdk-virtual-scroll-viewport`. The sortable container is then the viewport's content wrapper, and every DOM-derived slot is offset by the cell's rendered start through `taskboard-virtual.ts`. Cells take their height from `--mlv-taskboard-cell-block-size`; the board republishes the card size as `--mlv-taskboard-virtual-item-size`.

## Public methods

| Method                        | Behaviour                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `undo()` / `redo()`           | Replays the board-originated move ledger into `items` and `columns`; returns whether anything moved. An application rewrite of either collection drops the ledger. |
| `snapshot()`                  | Column order, collapsed columns and lanes, selection, focused card, and each cell's scroll offset. Carries no card data.                                           |
| `restore(snapshot)`           | Applies that state, silently dropping identifiers the current board no longer knows; scroll offsets land after the next render.                                    |
| `exportJson()`                | The whole board plus its snapshot as plain data, via `serializeMlvTaskboard`.                                                                                      |
| `exportCsv(columnId, fields)` | One column's cards as CSV, via `exportMlvTaskboardCsv`.                                                                                                            |
| `print()`                     | Expands every virtual cell for one render, then calls the injected document view's `print()`. A no-op during a server render.                                      |

## Documentation obligations

Keep the public API, controlled-state behavior, projection contexts, accessibility, SSR, virtual-rendering constraints, and every user-facing i18n string documented and tested as the package evolves. Update this file, the root indexes, and package metadata with any package-level change.
