# Docs Page: Drawer

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/drawer`
- **Component:** `DrawerPageComponent` (`apps/docs/src/app/pages/drawer/index.ts`)

## Overview

Slide-out panel for supplementary content and forms.

## Examples

| #   | Title                        | What it demonstrates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Right Drawer                 | Product editor: `<mlv-drawer-header title level="4">` with `mlv-drawer-sections`, an `mlv-spacer` and Create/Cancel on the 36px control row beside the built-in close; a `form[mlvForm]` of five `mlvDrawerSection`s (Meta / Pricing / Inventory / Shipping / Visibility), each a `fieldset[mlvFieldset]` grid (`[columns]` 1–3, `mlvFieldsetSpan`, a nested legend fieldset) mixing `mlv-input` (with a prepend slot), `mlv-textarea`, `mlv-tokenizer`, `mlv-number-input`, `mlv-select`, `mlv-switch`, `mlv-radio-group`, `mlv-day-picker` and `mlv-checkbox-group` |
| 2   | Bottom Sheet                 | Bottom drawer with `resizable` and `snapPoints`; the drag handle merges into the header band; snaps to 40%/80%/100%; swipe-to-dismiss and keyboard resize                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3   | Routable / Imperative Drawer | `mlvGenerateRoutableDrawerRoute()` route helper and `MlvDrawerService.open()` with injector forwarding; component injects `MlvDrawerRef` to close itself; the header title names the service-opened pane                                                                                                                                                                                                                                                                                                                                                              |
| 4   | Resizable Filter Panel       | Left drawer, `resizable` with **no** snap points (free drag), `minSize` / `maxSize` clamps, `defaultSnap` opening width, `[hasBackdrop]="false"`; header badge tracks the live filter count; checkbox group + range slider + switch form with Reset / Apply footer                                                                                                                                                                                                                                                                                                    |
| 5   | Top Tray                     | `position="top"` with `resizable` and two `snapPoints` (35 / 70); a "Mark all read" header action on the close button's row; `mlv-list` rows with `unread`, media / title / byline / meta slots and per-row actions                                                                                                                                                                                                                                                                                                                                                   |
| 6   | Playground                   | One drawer driven by outside controls: `mlv-segmented` position (all four edges), `mlv-select` size or snap preset, `mlv-switch` `resizable` / `hasBackdrop`; `mlv-drawer-sections` header navigator over Configuration / Markup / Keyboard sections, the Markup section printing the tag                                                                                                                                                                                                                                                                             |

## Libraries Used

- `@malva-ui/core/drawer` — primary component library for this page
