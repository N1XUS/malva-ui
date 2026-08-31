# Docs Page: File Upload

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/file-upload`
- **Component:** `FileUploadPageComponent` (`apps/docs/src/app/pages/file-upload/index.ts`)

## Overview

The File Upload page demonstrates `mlv-file-upload` — a drag-and-drop zone with validation, progress tracking, and reactive forms integration.

## Examples

| #   | Title                    | What it demonstrates                                           |
| --- | ------------------------ | -------------------------------------------------------------- |
| 1   | Basic                    | Default drop zone with multiple file support                   |
| 2   | Validation               | Accept and maxSize constraints with error display              |
| 3   | Single file              | `[multiple]="false"` mode with file replacement                |
| 4   | Compact + Reactive Forms | Compact layout wired to a `FormControl`                        |
| 5   | Signal forms             | `[formField]` file-array binding and field state               |
| 6   | Extra zone actions       | `mlvFileUploadAction` slot on both sides of the browse button  |
| 7   | Cover preview            | `previewMode="cover"` with the floating replace/remove toolbar |

Example 6 reproduces the reference layout — an icon-only `lucideSparkles`
"Generate image with AI" button projected immediately **before** `Choose image`
— and pairs it with a compact zone using `position="end"`. It also shows that a
projected action's click never opens the native file picker.

Example 7 seeds an edit-mode value (an inline SVG `data:` URL as `previewUrl`,
so the page needs no binary asset) to open straight into cover state. Hovering
or tabbing into the image reveals the `[✨][Replace][Remove]` toolbar — one
projected start action around the two built-ins. A second control with the same
configuration but an empty value demonstrates the fallback to the normal drop
zone, with the projected action back in the action row. Example 6 remains the
place `position="end"` is demonstrated (its "From library" button).

## Libraries Used

- `@malva-ui/core/file-upload` — primary component library for this page
- `@malva-ui/core/button` — `MlvButton` / `MlvButtonBefore` for the projected extra actions
