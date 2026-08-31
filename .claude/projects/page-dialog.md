# Docs Page: Dialog

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/dialog`
- **Component:** `DialogPageComponent` (`apps/docs/src/app/pages/dialog/index.ts`)

## Overview

Modal dialog windows for user interaction. Every example uses the composition
model: a `<mlv-dialog>` surface with `mlv-dialog-header` / `mlv-dialog-body` /
`mlv-dialog-footer` parts, closed with `[mlvDialogClose]`. Examples 1–5 open
declaratively through `<ng-template [(mlvDialog)]>`; 6 is route-driven, 7 is
service-driven, 8 is `confirm()`, 9 stacks a `confirm()` on top of a
service-opened form dialog.

## Examples

| #   | Title                 | What it demonstrates                                                                                                                                                                                                                                                                                                                         |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Basic Dialog (Medium) | `[(mlvDialog)]` + surface and parts at the default `m` size; `[mlvDialogClose]` with and without a result, and a typed `(mlvDialogClosed)` handler that shows the closed result                                                                                                                                                              |
| 2   | Confirm Appearance    | `mlvDialogOptions: { size: 's', appearance: 'confirm' }` — borderless chrome, no X; heading projected into `mlv-dialog-header`; footer `align="between"`                                                                                                                                                                                     |
| 3   | Size Presets          | Built-in presets through `mlvDialogOptions.size` (`s` / `l` / `fullscreen`); overridable via the `DIALOG_SIZE_PRESETS` token                                                                                                                                                                                                                 |
| 4   | Custom Size           | `MlvDialogSizeConfig` object (`{ width: 700, height: 400 }`) passed as `mlvDialogOptions.size`                                                                                                                                                                                                                                               |
| 5   | Non-closable Backdrop | `closeOnBackdrop: false` prevents backdrop-click closure while Escape and the footer button still close                                                                                                                                                                                                                                      |
| 6   | Routable Dialog       | `mlvGenerateRoutableDialogRoute()` (`dialog.routes.ts`) — the routed component renders `<mlv-dialog>` itself, injects `ActivatedRoute`, and closes with `[mlvDialogClose]`                                                                                                                                                                   |
| 7   | Programmatic Content  | `MlvDialogService.open()` with escaped string, typed `TemplateRef`, and component content; `<mlv-dialog-header />` with no title falls back to `config.title`. The outer component closes through the ref (`dialog.close(...)` / a held `MlvDialogRef`), not `[mlvDialogClose]`; the projected component content does use `[mlvDialogClose]` |
| 8   | Confirmation Dialog   | `MlvDialogService.confirm()` returning `Observable<boolean>`; default vs. `destructive` (danger button, initial focus on Cancel)                                                                                                                                                                                                             |
| 9   | Stacked Dialogs       | form dialog with `closeOnEscape`/`closeOnBackdrop: false` + `ref.keydownEvents()`/`backdropClick()` close guard opening `confirm()` on top; Escape closes only the topmost layer (confirmation, or an open select/combobox dropdown)                                                                                                         |

## Libraries Used

- `@malva-ui/core/dialog` — primary component library for this page
- `@malva-ui/core/form`, `@malva-ui/core/input`, `@malva-ui/core/select`, `@malva-ui/core/combobox` — the guarded form in example 9
