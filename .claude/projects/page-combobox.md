# Docs Page: Combobox

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/combobox`
- **Component:** `ComboboxPageComponent` (`apps/docs/src/app/pages/combobox/index.ts`)

## Overview

A searchable dropdown component with support for single and multiple selection, custom creation, and complex objects.

## Examples

| #   | Title                         | What it demonstrates                                                                                                                                             |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Basic                         | Single-select searchable dropdown with string options                                                                                                            |
| 2   | Multiple Selection            | Multi-select mode with tag display                                                                                                                               |
| 3   | Allow Creating New Values     | `allowCreate` flag for typing and submitting new entries not in the options list                                                                                 |
| 4   | Complex Objects with toOption | Mapping rich objects to `MlvSelectOption` via the `toOption` input; custom option template (swatch) styled with classes (no inline `style`)                      |
| 5   | Content Density               | Locally scoped density switcher (tight → airy) showing how the combobox scales without changing the docs shell                                                   |
| 6   | Disabled & Read-only          | Toggle buttons demonstrating that `disabled`/`readonly` inert every open path and gate the `clearable` affordance                                                |
| 7   | Grouped Options               | `toOption` returning a `group` label clusters options under sticky, non-selectable headers; filtering is group-aware (a header shows only while a child matches) |
| 8   | Mobile full-screen sheet      | Forced mobile sheet mode with in-sheet filtering and keyboard interaction                                                                                        |
| 9   | Remote `searchFn`             | `searchFn` supersedes `[options]`; lazy + debounced, stale results kept while a query is in flight, consumer-owned `[loading]`                                   |
| 10  | Paged data source (multi)     | `MlvDataSource` as `[options]` — `setSearch` server-side filtering, page-on-scroll accumulation, tags surviving option-set changes via `compareWith` + the guard |
| 11  | Signal forms                  | `[formField]` selection binding with live value and touched state                                                                                                |

Example 10 imports the shared docs demo source from the select page
(`apps/docs/src/app/pages/select/examples/8/remote-users.data-source.ts`).

## Libraries Used

- `@malva-ui/core/combobox` — primary component library for this page
- `@malva-ui/cdk/data-source` — `MlvDataSource` behind the example 10 demo source
