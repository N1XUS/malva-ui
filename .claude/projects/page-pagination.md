# Docs Page: Pagination

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/pagination`
- **Component:** `PaginationPageComponent` (`apps/docs/src/app/pages/pagination/index.ts`)

## Overview

Pagination divides content into discrete pages. It shows the current slice of data, lets users jump between pages, and configure how many items appear per page.

## Examples

| #   | Title                            | What it demonstrates                                                                                   |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Basic usage                      | The required `totalItems` input plus `[(currentPage)]`; pages derived from `itemsPerPage` (default 10) |
| 2   | Items per page with "All" option | `Infinity` in `perPageOptions` for "All (Z)", with the animated active-label expansion                 |
| 3   | Collapsed page runs              | Page-count-driven ellipsis collapsing (500 pages) and the `...` jump fields                            |
| 4   | Driving a table                  | `currentPage` and `itemsPerPage` as `model()` signals slicing a fixed employee list                    |

> The component takes **no** `shownItems` or `activeItemsPerPage` input — those
> names were documented for years and never existed. `perPageOptions` is the
> option array; `itemsPerPage` is the two-way selected value. See
> `.claude/projects/libs-pagination.md` for the full API.

## Libraries Used

- `@malva-ui/core/pagination` — primary component library for this page
