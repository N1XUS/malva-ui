# Docs Page: Select

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/select`
- **Component:** `SelectPageComponent` (`apps/docs/src/app/pages/select/index.ts`)

## Overview

A dropdown select component supporting single and multiple selection, custom templates, and validation states.

## Examples

| #   | Title                                     | What it demonstrates                                                                                                                                           |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Single Selection                          | Basic single-select dropdown with typed options                                                                                                                |
| 2   | Multiple Selection                        | Multi-select mode                                                                                                                                              |
| 3   | Complex Objects with toOption             | Mapping rich objects to `MlvSelectOption` via the `toOption` callback                                                                                          |
| 4   | With States                               | Validation states (error, success, warning, disabled)                                                                                                          |
| 5   | Content Density                           | Locally scoped density switcher showing how the select scales without changing the docs shell                                                                  |
| 6   | Grouped Options                           | `toOption` returning a `group` label clusters options under sticky, non-selectable section headers                                                             |
| 7   | Searchable dropdown                       | `searchable` stamps the in-dropdown search row; local label filtering, match emphasis, activedescendant keyboard model                                         |
| 8   | Remote data source with lazy paging       | `MlvDataSource` as `[options]` — server-side search via `setSearch`, `compareWith` resolving a preset id, the loading variant, and page-on-scroll accumulation |
| 9   | Remote `searchFn` with an owned `loading` | `searchFn` supersedes `[options]`, is lazy + debounced, keeps stale results while a query is in flight; the consumer owns `[loading]` (no paging in this mode) |
| 10  | Signal forms                              | `[formField]` selection binding with live value and touched state                                                                                              |
| 11  | Native select                             | `native="auto"` uses a transparent native picker below `md`, with grouped choices from `[options]` and custom templates ignored                         |

Example 8 owns the shared docs demo source
`apps/docs/src/app/pages/select/examples/8/remote-users.data-source.ts`
(`RemoteUsersDataSource` / `DemoUser` — 57 rows, 600 ms latency, natural-field
search, 10 per page). The combobox and autocomplete pages import it relatively.

## Libraries Used

- `@malva-ui/core/select` — primary component library for this page
- `@malva-ui/cdk/data-source` — `MlvDataSource` behind the example 8 demo source
