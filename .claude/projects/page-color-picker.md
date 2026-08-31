# Docs Page: Color Picker

> **Keep this file up to date.** Whenever examples are added, removed, or changed for this page, update this document.

---

## Route

- **Path:** `/color-picker`
- **Component:** `ColorPickerPageComponent` (`apps/docs/src/app/pages/color-picker/index.ts`)

## Overview

HSL/HEX/RGB color picker with a 2D saturation-lightness canvas, a hue slider, an opacity slider, and switchable input mode tabs. Available as an inline element or a popup triggered by a color swatch button.

## Examples

| #   | Title               | What it demonstrates                                                                            |
| --- | ------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Basic Inline Picker | Inline `mlv-color-picker` with `(colorChange)` event binding                                    |
| 2   | Reactive Forms      | `mlv-color-picker` with `[formControl]` binding; color value displayed and used as background   |
| 3   | Popup Mode          | `mlv-color-picker-popup` — swatch button trigger, floating panel, close on Escape/outside-click |
| 4   | Input Modes         | Three pickers showing `defaultMode="hex"`, `defaultMode="rgb"`, and `defaultMode="hsl"`         |
| 5   | Signal forms        | Inline and popup variants bound through `[formField]` with live CSS color values                |

## Libraries Used

- `@malva-ui/core/color-picker` — primary component library for this page
