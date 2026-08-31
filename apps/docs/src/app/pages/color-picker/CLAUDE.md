# Docs Page: Color Picker

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/color-picker`
- **Component:** `ColorPickerPageComponent` (`apps/docs/src/app/pages/color-picker/index.ts`)

## Overview

HSL/HEX/RGB color picker with a 2D saturation-lightness canvas, a hue slider, an opacity slider, and switchable input mode tabs. Available as an inline element or an input-like CSS color field with a connected popover.

## Examples

| #   | Title               | What it demonstrates                                                                                |
| --- | ------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Basic Inline Picker | Inline `mlv-color-picker` with `(colorChange)` event binding                                        |
| 2   | Reactive Forms      | `mlv-color-picker` with `[formControl]` binding; color value displayed and used as background       |
| 3   | Popup Mode          | Input/swatch triggers, backdrop dismissal, clearable field, CSS variables, and deferred commits     |
| 4   | Formats and Output  | Default formats, a single-format picker without tabs, custom format order, and format-shaped output |
| 5   | Signal forms        | Inline and popup variants bound through Angular signal form fields                                  |

## Libraries Used

- `@malva-ui/core/color-picker` — primary component library for this page
