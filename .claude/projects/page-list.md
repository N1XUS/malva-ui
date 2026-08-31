# Docs Page: List

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/list`
- **Component:** `ListPageComponent` (`apps/docs/src/app/pages/list/index.ts`)

## Overview

A list displays a set of related items in a vertical layout.

## Examples

| #   | Title                                | What it demonstrates                                                                                                                                                                    |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Basic List                           | Static list of items                                                                                                                                                                    |
| 2   | Single Selection                     | Single selection mode with click-to-select; disabled items cannot be selected                                                                                                           |
| 3   | Rich Rows                            | Semantic list-item slots for media, title, byline, and trailing actions                                                                                                                 |
| 4   | Inbox (unread + reveal actions)      | Apple Mail-style inbox using `variant="inset"`, the `unread` row state, and `revealOnHover` trailing actions (reply / archive / delete)                                                 |
| 5   | Grouped settings with sticky headers | iOS Settings-style grouped layout with `mlv-list-item-group` rendered as sticky uppercase section labels inside the inset card                                                          |
| 6   | Semantic accent bars                 | Incident / activity feed that uses the `accent` input (`primary`, `positive`, `negative`, `warning`, `info`, `neutral`) to surface status at a glance                                   |
| 7   | Conversation rows                    | Messaging-style rows — avatar + bold title + muted preview line — with a single restrained-accent trailing unread count `mlv-badge`; plain variant, hairline-separated                  |
| 8   | Settings rows with switches          | Grouped, inset settings sections (`mlv-list-item-group`) mixing leading-icon rows with a trailing `mlv-switch` and navigational rows with a trailing value + chevron                    |
| 9   | Action rows with overflow            | Single trailing action per row — a `variant="secondary"` button on most rows, collapsing to a `variant="transparent" shape="circle"` overflow trigger opening an `mlv-menu` on the rest |
| 10  | Product rows with amount and status  | Commerce-style rows — square product image + two-line copy — with a stacked trailing column pairing a bold amount and a neutral `mlv-status-indicator` + label                          |
| 11  | Rich selectable rows                 | `mlv-list[selectable]` / `mlv-list-item[value]` driving avatar/title/byline rows as a keyboard-navigable single-select listbox                                                          |

## Libraries Used

- `@malva-ui/core/list` — primary component library for this page
- `@malva-ui/core/avatar` — circular/square artwork media used in rich row, inbox, conversation, order, and selectable-row examples
- `@malva-ui/core/badge` — trailing unread count in the conversation rows example
- `@malva-ui/core/button` — trailing action buttons used in rich row, inbox, and action row examples
- `@malva-ui/core/menu` — overflow ("…") action menu in the action rows example
- `@malva-ui/core/status-indicator` — neutral status dot in the semantic accent bars and product row examples
- `@malva-ui/core/switch` — trailing toggles in the settings rows example
- `@lucide/angular` — icon set used for the settings media slots, inbox action buttons, action row icons, and the overflow/chevron glyphs

## API Observations (owner feedback pass, 2026-08-25)

- `a[mlvListItemLink]`'s doc comment/CLAUDE.md claims it "renders projected
  link content plus a trailing `LucideChevronRight`", but
  `libs/core/list/src/lib/list-item-link/list-item-link.html` is a bare
  `<ng-content />` — no chevron is rendered. It's also only wired into
  `mlv-list-item`'s **legacy** (prefix/content/suffix) branch, not the rich
  media/title/byline layout, so it can't compose with a rich row (leading
  icon + title + description) to get an automatic "value + chevron"
  navigational row for free. Example 8's navigational rows (Quiet hours,
  Email digest) therefore hand-author a value span + decorative
  `lucideChevronRight` inside `mlvListItemActions` instead of using
  `MlvListItemLink`. Worth a follow-up: either fix the doc claim, or extend
  the component so a chevron affordance is available inside a rich row.
  Not fixed here — out of scope for a docs-only pass.
