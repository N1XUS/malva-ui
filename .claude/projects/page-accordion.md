# Docs Page: Accordion

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/accordion`
- **Component:** `AccordionPageComponent` (`apps/docs/src/app/pages/accordion/index.ts`)
- **Sidebar:** "Accordion" (icon `LucideListCollapse`) in the Components group, above "Expand".

## Overview

Vertically stacked, expandable sections built on the `@angular/aria` accordion
pattern (`AccordionGroup`/`AccordionTrigger`/`AccordionPanel`/`AccordionContent`)
and wrapping `mlv-expand` for the open/close animation. Supports single- and
multi-expand modes, lazy content, rich headers, disabled items, programmatic
expand/collapse-all, and full keyboard navigation (Arrow Up/Down, Home, End; Tab
also reaches every header).

## Examples

| #   | Title                                  | What it demonstrates                                                                         |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Basic Usage (single-expand)            | `header` input, default-slot content, `[multiExpandable]="false"`, lazy content              |
| 2   | Multi-expand, rich headers & disabled  | `[multiExpandable]="true"`, `mlvAccordionHeader` slot with icons, `[expanded]`, `[disabled]` |
| 3   | Programmatic control & two-way binding | Template-ref `expandAll()`/`collapseAll()`, `[(expanded)]` model + status badge              |

## Libraries Used

- `@malva-ui/core/accordion` — primary component library for this page
- `@malva-ui/core/button` — Expand/Collapse-all buttons in example 3
- `@malva-ui/core/badge` — status indicator in example 3
- `@lucide/angular` — header icons in example 2
