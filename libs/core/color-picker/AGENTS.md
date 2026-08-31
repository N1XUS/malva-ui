---

# Library: color-picker

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Color Picker library (`@malva-ui/core/color-picker`) provides an HSL/HEX/RGB color picker with:

- A 2D saturation-lightness canvas (pointer-draggable) drawn via HTML Canvas 2D API
- A hue slider (0–360°)
- An opacity/alpha slider (0–100%)
- Configurable, ordered input formats (`supportedFormats`): HEX, RGB, HSL
- Signal/reactive/template-driven forms integration producing a CSS color string
- Inline mode (`mlv-color-picker`) and popup mode (`mlv-color-picker-popup`)
- Popup `field` and public `swatch` trigger presentations for form fields and
  detached toolbar composition
- Popup draft updates that commit on blur/close by default, with opt-in `live`
  publishing
- Shared popup backdrop whose overlay order keeps the picker panel above it
- No external color library dependencies — all math is implemented in `color-utils`

## Public API

Exported from `libs/core/color-picker/src/index.ts`:

| Export                | Kind      | Description                                   |
| --------------------- | --------- | --------------------------------------------- |
| `MlvColorPicker`      | Component | Inline color picker — `mlv-color-picker`      |
| `MlvColorPickerPopup` | Component | Popup color picker — `mlv-color-picker-popup` |
| `MlvColorInputMode`   | Type      | `'hex' \| 'rgb' \| 'hsl'`                     |
| `MlvHsla`             | Interface | HSLA color representation `{ h, s, l, a }`    |
| `MlvRgba`             | Interface | RGBA color representation `{ r, g, b, a }`    |

## Components

### `MlvColorPicker`

**Selector:** `mlv-color-picker` | Forms value: CSS color string

### `MlvColorPickerPopup`

**Selector:** `mlv-color-picker-popup` | Forms value: CSS color string

The popup preserves its existing input-like DOM in the default
`presentation="field"` mode. `presentation="swatch"` renders a real Malva
button with an explicit `ariaLabel`; its optional clear action is also a
localized Malva button. `opened` is a two-way model with `afterOpened` and
`afterClosed` lifecycle outputs. Public `triggerElement` and `panelElement`
signals expose only the current connected trigger and detached panel element,
returning `null` after teardown so composite widgets can register focus and
overlay ownership without querying internal selectors.

See CLAUDE.md for full API details.
