# Docs Page: PIN Input

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/pin-input`
- **Component:** `PinInputPageComponent` (`apps/docs/src/app/pages/pin-input/index.ts`)

## Overview

A row of single-character input cells that behave as one logical form control — for OTP codes, numeric PINs, and short verification sequences.

## Examples

| #   | Title                      | What it demonstrates                                                                                     |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | Basic OTP Entry            | Default 6-cell layout with `ngModel` binding; auto-advance on entry, Backspace navigation, paste support |
| 2   | Configurable Length        | 4, 6, and 8-cell variants for ATM PIN, OTP, and backup codes                                             |
| 3   | Masked Mode                | `type="password"` to hide characters; PIN confirmation match check                                       |
| 4   | Reactive Forms Integration | `FormControl` + `ReactiveFormsModule`; `Validators.minLength`, invalid state, submit/reset flow          |
| 5   | States and Customisation   | Disabled (empty and pre-filled), custom `placeholder`, `type="number"` for numeric mobile keyboard       |
| 6   | Separators                 | `separator="each"`, `separator="3"` grouping, and a custom `*mlvPinInputSeparator` template              |
| 7   | Signal forms               | `[formField]` binding with value synchronization, touch state, and schema validation                     |

## Libraries Used

- `@malva-ui/core/pin-input` — primary component library for this page
- `@malva-ui/core/button` — used in reactive forms example
- `@angular/forms` — signal, reactive, and template-driven forms integration
