# Docs Page: Getting Started

> **Keep this file up to date.** Whenever the Getting Started guide changes, update this document.

---

## Route

- **Path:** `/getting-started`
- **Component:** `GettingStartedPageComponent` (`apps/docs/src/app/pages/getting-started/index.ts`)

## Overview

End-to-end consumer installation guide for Malva UI. This is a custom guide page and does not use `DocPageComponent` or expose an API tab.

The page documents:

- Prerequisites and the recommended `ng add @malva-ui/core` flow.
- Interactive theme, density, global-style, and provider questions.
- The dependency, workspace-style, and root-provider changes made by the schematic.
- Multi-application and fully non-interactive commands.
- Every public installer option and its default.
- A manual package, stylesheet, and provider fallback.
- A first standalone component using `MlvLayout` and `MlvButton`.
- Verification, troubleshooting, and links to the next relevant docs pages.

## Architecture

- Uses `ChangeDetectionStrategy.OnPush` and `ViewEncapsulation.Emulated`, matching docs-app conventions.
- Uses semantic `article`, `section`, ordered-list, description-list, table, and `nav` elements.
- Uses `MlvAccordion` and `MlvAccordionItem` for troubleshooting, including the library's keyboard navigation and ARIA behavior.
- Uses `MlvCopyToClipboard` for keyboard-accessible copy actions.
- Applies `DocsTocSourceDirective` to publish all `h2`–`h4` headings to the app-shell table of contents.
- Stores code samples as component fields so the displayed and copied values cannot drift apart.
- Styles are responsive, BEM-based, and use Malva UI design tokens.

## Navigation

The route appears directly below Home in the root sidebar navigation. The home-page primary calls to action also point to this guide.
