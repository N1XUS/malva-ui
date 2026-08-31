# Docs Page: Popup

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/popup`
- **Component:** `PopupPageComponent` (`apps/docs/src/app/pages/popup/index.ts`)

## Overview

Floating content panels triggered by user interaction.

## Examples

| #   | Title                             | What it demonstrates                                                                                                                                                                                                                          |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Click Trigger with Named Position | `position` input with a named position like `bottom-start`; closes on outside click or Escape                                                                                                                                                 |
| 2   | All 12 Named Positions            | Interactive grid of all 12 `{side}-{alignment}` position names; reactive `[position]` binding                                                                                                                                                 |
| 3   | Focus Trigger with Position       | `triggerOn="focus"` opens on keyboard/pointer focus; `[hasArrow]="true"` for contextual hints                                                                                                                                                 |
| 4   | Position Fallback Array           | Array `[position]` input for ordered fallbacks; CDK picks the first fitting position                                                                                                                                                          |
| 5   | Container Component               | `mlv-popup-container` grouping trigger and popup; `open()`, `close()`, `toggle()` API                                                                                                                                                         |
| 6   | Scroll strategy                   | `scrollStrategy` input: `reposition` (follows trigger), `close` (closes on scroll), `noop` (stays fixed)                                                                                                                                      |
| 7   | No backdrop                       | `[hasBackdrop]="false"` removes visual backdrop while preserving click-outside and Escape detection; menu body is `mlv-dropdown-panel` with `scrollMode="parent"`, host-provided `MlvSelectionService`, and host-owned open/close focus moves |
| 8   | Mobile Fullscreen Mode            | `mobileMode="fullscreen"` (demo) / `"auto"` renders a full-screen mobile sheet with header, `mobileTitle`, close button, scroll-lock, and slide-up animation                                                                                  |

## Libraries Used

- `@malva-ui/core/popup` — primary component library for this page
- `@malva-ui/core/button` — trigger buttons in examples
- `@malva-ui/core/list` — list menu in example 5
- `@malva-ui/core/dropdown` + `@malva-ui/core/form-utils` — listbox panel and its `MlvSelectionService` in example 7
- `@malva-ui/core/checkbox` — filter toggles in example 8
