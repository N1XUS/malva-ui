# Docs Page: Page

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

## Route

- **Path:** `/page`
- **Component:** `PagePageComponent` (`apps/docs/src/app/pages/page/index.ts`)

## Overview

Shows how the Page primitives form a rounded application canvas beneath global navigation without turning the entire workspace into a detached card.

## Examples

| #   | Title               | What it demonstrates                                                                                                                                                                                                                                                                                                         |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Structured Page     | Anchored page surface, breadcrumb/title/actions header slots, main content, and a sticky end aside.                                                                                                                                                                                                                          |
| 2   | Application Shell   | Dark action bar and collapsible icon rail framing one attached, rounded Page canvas with a responsive end inspector. Also responsive to its own width — see below.                                                                                                                                                           |
| 3   | Record editor       | Publishing workflow page: compact sticky header (`size="s"`, status badges, Draft/Live `mlv-button-toggle` group, More menu, centered tabs), `mlv-page-summary` with pin + snap-on-scroll collapse, host-owned diff view / suggestions / version history / delayed publish, and `mlv-page-dock` workflow actions. See below. |
| 4   | Responsive end pane | One `mlvPageEndPaneContent` template rendered as a labelled inline aside above `lg` and a modal Drawer below it, controlled by the public native-button trigger with one logical open and focus lifecycle.                                                                                                                   |

## Example 2 responsiveness

The shell preview is a box inside the documentation page, so a media query would
answer the wrong question: the preview can be narrow on a wide screen. It
measures its own host with `MlvResizeObserverService` — the same mechanism
`mlv-page-content` uses for `stackBelow` — and derives two thresholds from that
one width:

| Below   | What changes                                                                                                                                                                       |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `760px` | The topbar search switches to `presentation="icon"`, a circular trigger that opens the field's full-screen overlay.                                                                |
| `560px` | The sidebar switches to `mode="offcanvas"` and opens as a drawer, and the topbar grows a menu button — the sidebar's own trigger is inside the closed drawer and cannot reopen it. |

The host needs `display: block`; an inline host has no content box and
`ResizeObserver` would report a width of `0` forever.

## Example 3 — Record editor

Demonstrates the composition principle: the page library provides structure
and slots; the example component owns every piece of domain state.

- **Draft/Live** — `mlv-button-toggle` pair driven by one `view` signal; the
  Live view renders a read-only `dl` grid instead of the editable cards.
- **Diff view** — `changes` computed compares the draft field signals against
  the `live` baseline; per-field `CHANGED` badges come from the same source.
- **Suggestions** — a host-owned `FieldSuggestion[]`; each chip applies on
  click/Enter and dismisses via `(chipClose)`.
- **Version history** — a `versions` signal rendered with `mlv-timeline`;
  Save draft/Publish prepend entries.
- **Delayed publish** — Schedule button in `[mlvPageDockEnd]` opens an
  `mlv-popup` with `mlv-day-picker`; the chosen date shows as a dock badge.
- **Scroll-scrubbed snap** — the preview constrains the page to a fixed
  height; `[snapRange]="160"` maps 160px of scroll onto the snap timeline
  (roughly the collapsible chrome height, so content and chrome move ~1:1).
  Breadcrumb, tabs row, and summary strip collapse over staggered windows;
  the title scrubs h4 → h6. Chevron/pin controls come from
  `mlv-page-header[snapControls]`; pinning freezes the state mid-scroll.
- **Bottom toolbar** — the entire workflow row lives inside one white pill
  action bar (`nav[mlvActionBar] shape="pill" wrap`, no contrast): status
  text, the editing-mode `mlv-button-toggle` cluster, a vertical divider, and
  pill-shaped Discard/Schedule/Save/Publish buttons. It sits centered in a
  `mlv-page-dock appearance="floating"`, which paints the
  `mlvFloatingContainer` gradient-masked backdrop so content fades out under
  the actions. Wrapping on a narrow canvas comes from the bar's own `wrap`
  input; the example CSS only supplies the rounded-rectangle finish. The
  sticky dock also publishes `--mlv-page-dock-height`, which lifts
  bottom-anchored toasts clear of Save/Discard.
- Binding note: `mlv-tokenizer` must be bound through `[(tokens)]` — its
  init-time `tokens`→`value` mirror effect resets a `[(value)]` binding.

## Libraries Used

- `@malva-ui/core/page` — application shell geometry, page surface, structured header, responsive content grid, and aside slot
- Example 4 uses `MlvPageEndPane`, `MlvPageEndPaneContent`, and `MlvPageEndPaneTrigger` for responsive trailing account details without custom breakpoint or Drawer code.
- `@malva-ui/core/action-bar` — global top navigation, brand slot, and responsive action group in the shell example
- `@malva-ui/cdk/utils` — `MlvResizeObserverService` measures the shell preview so the topbar and sidebar respond to their own container
- `@malva-ui/core/search-field` — topbar search that collapses to an overlay-opening icon on a narrow shell
- `@malva-ui/core/avatar`, `@malva-ui/core/badge`, and `@malva-ui/core/toolbar` — composed action-bar identity, status, and action groups
- `@malva-ui/core/sidebar` — primary collapsible navigation in the shell example
- `@malva-ui/core/breadcrumb`, `@malva-ui/core/tabs`, and `@malva-ui/core/card` — composed navigation and content primitives
- `@malva-ui/core/button` and `@malva-ui/core/title` — supporting example content
- Record-editor example additionally composes `@malva-ui/core/chip`, `menu`,
  `list`, `divider`, `popup`, `day-picker`, `timeline`, `input`, `textarea`,
  `switch`, `select`, `tokenizer`, `tooltip`, and `form-utils`
  (`MlvFormControlAppend`)
