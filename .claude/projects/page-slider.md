# Docs Page: Slider

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/slider`
- **Component:** `SliderPageComponent` (`apps/docs/src/app/pages/slider/index.ts`)

## Overview

A range slider component supporting single-value and dual-thumb range selection, live value tooltips, tick marks, keyboard navigation, and signal, reactive, and template-driven forms.

## Examples

| #   | Title                           | What it demonstrates                                                                                    |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Basic Slider                    | Single-thumb slider with `[(ngModel)]` / `FormControl` binding; `min`, `max`, `step` inputs             |
| 2   | Range Slider                    | Dual-thumb mode with `[range]="true"`; value as `[min, max]` tuple; constrained thumbs                  |
| 3   | Step Marks                      | `[showTicks]="true"` for tick marks at every step interval; discrete slider pattern                     |
| 4   | Reactive Forms & Disabled State | `[formControl]` integration; `control.disable()`/`enable()` follows visual disabled state               |
| 5   | Vertical Sliders                | `orientation="vertical"` — mixer-style faders; track runs bottom-to-top; host must have explicit height |
| 6   | Vertical Range Slider           | Range mode in vertical orientation with environmental control example                                   |
| 7   | Value tooltips                  | `tooltip` feedback, default values, and custom `mlvSliderTooltipDef` formatting for range thumbs        |
| 8   | Signal forms                    | `[formField]` binding with value, touched state, and schema-driven constraints                          |

## Libraries Used

- `@malva-ui/core/slider` — primary component library for this page
