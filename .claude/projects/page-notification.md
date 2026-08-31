# Docs Page: Notification

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/notification`
- **Component:** `NotificationPageComponent` (`apps/docs/src/app/pages/notification/index.ts`)

## Overview

Card-style notifications with icons, descriptions, and optional action buttons for richer user feedback.

## Examples

| #   | Title                  | What it demonstrates                                                                                                                      |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Basic Notification     | `MlvNotificationService.show()` with title and description; auto-dismisses after 6 seconds                                                |
| 2   | Tones with Icons       | `success()`, `error()`, `warning()`, `info()` methods; automatic icon selection and status color palette; `showIcon: false` option        |
| 3   | Action Buttons         | `actions` array with clickable buttons; `variant: 'primary'` for highlighted action; auto-dismiss on action click                         |
| 4   | Positioning & Stacking | Six screen positions; multiple notifications stacking and animating                                                                       |
| 5   | Programmatic Content   | `MlvNotificationService.open()` with escaped string, typed `TemplateRef`, and component content; data/config context and ref-driven close |

## Libraries Used

- `@malva-ui/core/notification` — primary component library for this page
