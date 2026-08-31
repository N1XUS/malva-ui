# Docs Page: Dropdown

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/dropdown`
- **Component:** `DropdownPageComponent` (`apps/docs/src/app/pages/dropdown/index.ts`)

## Overview

A generic listbox panel and shared option utilities for select, combobox, and
autocomplete experiences. The page projects a short reference block (focus
models, shared option utilities) above six live examples.

## Examples

| #   | Title                       | What it demonstrates                                                                                                                                                         |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Standalone Panel            | The panel outside any control: host-supplied `MlvSelectionService`, the opt-in `mlv-dropdown-panel--surface` class, array-shaped `selectedValues`/`valueChange`, `maxHeight` |
| 2   | Multiple Selection          | `[multiple]="true"` toggles, whole-selection emissions, and external mutation through `mlv-chip` writing the same signal the panel reads                                     |
| 3   | Grouped Options             | `group` on an option → sticky, non-selectable headers over consecutive runs; headerless trailing cluster; headers excluded from options and indices                          |
| 4   | Custom Option Rows          | `resolveOptions()` mapping records to options (record kept as `value`) plus `[itemTemplate]` with `mlv-avatar` / `mlv-badge`; the row owns its own check mark                |
| 5   | Loading and Lazy Paging     | `loading` vs `loadingMore`, `loadingText`, `hasMore` arming the scroll sentinel, `(loadMore)` appending pages; hand-rolled pager with timer cleanup                          |
| 6   | Inside a Popup, No Backdrop | The select/combobox composition by hand: `mlv-popup` + `[hasBackdrop]="false"`, `scrollMode="parent"`, no `--surface`, host-owned dismissal and focus moves                  |

## Notes

- Every standalone panel example provides `MlvSelectionService` itself — the
  panel injects it non-optionally and normally inherits it from `mlv-select` /
  `mlv-combobox`.
- Example 6 owns focus explicitly, because a non-modal `mlv-popup` moves none:
  `(afterOpened)` defers `MlvSelectionService.requestFocusFirst()` through
  `afterNextRender` (the panel is stamped one render after the overlay attaches,
  and it is unreachable from a view query), and `(afterClosed)` returns focus to
  the trigger. Without both, a keyboard user can open the list but never reach
  it.
- Example 5's fake pager clears its pending timer on destroy and before a
  reload; it never contacts a backend. Real sources bind `loading`,
  `loadingMore`, `hasMore` and `loadMore()` straight from `MlvOptionsAdapter`.

## Libraries Used

- `@malva-ui/core/dropdown` — primary component library for this page
- `@malva-ui/core/form-utils` — `MlvSelectionService`, required by a standalone panel
- `@malva-ui/core/popup` — overlay host in example 6
- `@malva-ui/core/button` — trigger and reload buttons in examples 5 and 6
- `@malva-ui/core/chip` — selected-scope row in example 2
- `@malva-ui/core/avatar`, `@malva-ui/core/badge` — custom option rows in example 4
