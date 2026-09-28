---
# Library: color-picker

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Color Picker library (`@malva-ui/core/color-picker`) provides an HSL/HEX/RGB color picker with:

- A 2D saturation-lightness canvas (pointer-draggable) drawn via HTML Canvas 2D API
- A hue slider (0–360°)
- An opacity/alpha slider (0–100%)
- Switchable input mode tabs: HEX, RGB, HSL
- Signal, reactive, and template-driven forms integration producing a CSS color string in the active format
- Inline mode (`mlv-color-picker`) and popup mode (`mlv-color-picker-popup`)
- Popup field, swatch, and projected-icon presentations for form-field and toolbar composition
- No external color library dependencies — all math is implemented in `color-utils`

## Public API

Exported from `libs/core/color-picker/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvColorPicker` | Component | Inline color picker — `mlv-color-picker` |
| `MlvColorPickerPopup` | Component | Popup color picker — `mlv-color-picker-popup` |
| `MlvColorInputMode` | Type | `'hex' \| 'rgb' \| 'hsl'` |
| `MlvHsla` | Interface | HSLA color representation `{ h, s, l, a }` |
| `MlvRgba` | Interface | RGBA color representation `{ r, g, b, a }` |
| `clamp` | Function | Clamps a number to [min, max] |
| `round` | Function | Rounds to N decimal places |
| `hslToRgb` | Function | Converts HSL to RGB |
| `rgbToHsl` | Function | Converts RGB to HSL |
| `hexToRgba` | Function | Parses hex string to RGBA |
| `rgbaToHex` | Function | Converts RGBA to hex string |
| `tryParseCssColor` | Function | Strictly parses a supported concrete CSS color string to HSLA or returns `null` |
| `isCssColorValue` | Function | Validates supported concrete colors and syntactically valid `var(...)` color references |
| `parseCssColor` | Function | Parses a supported concrete CSS color string to HSLA with an opaque-black fallback |
| `hslaToHex` | Function | Converts HSLA to hex string |
| `hslaToModeString` | Function | Converts HSLA to a CSS string in the given mode |
| `hslaToRgba` | Function | Converts HSLA to RGBA |
| `hslaToString` | Function | Converts HSLA to hsl()/hsla() CSS string |

---

## Components

### `MlvColorPicker`

**File:** `libs/core/color-picker/src/lib/color-picker/color-picker.ts`
**Selector:** `mlv-color-picker` | **Change Detection:** `OnPush` | **Encapsulation:** `None`

Extends `MlvSignalFormControlBase<string>` — value is a CSS color string in the
currently selected supported format.

#### Inputs

| Name               | Type                           | Default                 | Description                         |
| ------------------ | ------------------------------ | ----------------------- | ----------------------------------- |
| `disabled`         | `BooleanInput`                 | `false`                 | Disables all interaction            |
| `showOpacity`      | `BooleanInput`                 | `true`                  | Shows or hides the opacity slider   |
| `defaultMode`      | `MlvColorInputMode`            | `'hex'`                 | Initial input mode tab              |
| `supportedFormats` | `readonly MlvColorInputMode[]` | `['hex', 'rgb', 'hsl']` | Available formats and display order |

#### Outputs

| Name          | Type     | Description                                |
| ------------- | -------- | ------------------------------------------ |
| `colorChange` | `string` | Emits the CSS color string on every change |

#### Host Bindings

```ts
host: {
  class: 'mlv-color-picker',
  '[class.mlv-color-picker--disabled]': 'disabled()',
}
```

#### Forms value

- External writes to the `value` model accept any CSS color string and are parsed via `tryParseCssColor()`, falling back to `parseCssColor()` for a string it cannot read.
- Internal HSLA is the source of truth; the emitted string is derived from it (#315).
  - Own emission returning through `value` (two-way binding, reactive forms, `[formField]`) is recognized and **not** re-parsed — no CSS parse, no repaint per pointermove.
  - Same color, other spelling (upper-case hex, `rgb()` for a hex emission): the write is parsed and compared field-for-field with the parse of the picker's own spelling of its state in the write's format. Equal → state kept exactly, nothing re-derived from 8-bit channels. Compared at the write's own precision, so a finer write is applied (rgba alpha `0.125` vs emitted `0.13`, hsl hue `225.04` vs emitted `225`).
  - Achromatic hex/rgb write (black, grey, white — `s = 0`, no hue of its own) keeps the current hue; so do achromatic values typed into the HEX or RGB fields. Saturation is taken from the value, not kept.
  - `hsl()` / `hsla()` writes carry their own hue and apply it as written; so does a hue typed into the HSL field.
  - Unparseable string → opaque black (`parseCssColor` fallback), hue kept.
  - Consequence: after an achromatic hex/rgb write the hue slider and HSL `H` field show the previous hue, the next HSL-mode emission spells it (`hsl(225, 0%, 100%)`), and a plane drag off the grey axis returns to it — `setValue('#ffffff')` on a picker at hue 225, then a drag to the top-right corner, emits `#0040ff` (hue 225), not `#ff0000` (hue 0).
- Emits HEX/HEXA, RGB/RGBA, or HSL/HSLA according to the active format.
- Duplicate `supportedFormats` entries are removed. An empty array falls back
  to all formats, and an unavailable `defaultMode` falls back to the first
  supported format.

#### Mode Tabs Accessibility

When multiple formats are available, the picker uses the shared
`mlv-tab-group` with `mlvDensity="tight"`. The tabs component owns the APG tab
semantics, roving focus, keyboard navigation, and tab/panel relationships.
With one supported format, the editor renders directly without a redundant
tablist.

---

### `MlvColorPickerPopup`

**File:** `libs/core/color-picker/src/lib/color-picker-popup/color-picker-popup.ts`
**Selector:** `mlv-color-picker-popup` | **Change Detection:** `OnPush` | **Encapsulation:** `None`

Wraps `MlvColorPicker` in a connected `mlv-popup` with a light-dismiss
backdrop. Its trigger
is an input-like `MlvFormControlWrapper` row containing editable CSS color text
and a rounded color swatch. Focusing the input or activating the swatch opens
the picker; click-outside or `Escape` closes it.

Extends `MlvSignalFormControlBase<string>` from `@malva-ui/core/form-utils`,
inheriting `disabled`, `readonly`, `state`, `id`, `label`, `hint`, `message`,
`clearable`, `prepend`, `append`, `touch`, and `computedDisabled()`. It provides
`MLV_FORM_CONTROL`, so the shared wrapper owns field chrome and projected
slots. Form-bound disabled state propagates to the input, swatch, and inner
picker.

**Draft/commit behavior:** native input and picker events update an internal
draft. With the default `live=false`, the draft commits on input blur or popup
close, including backdrop dismissal and Escape. With `live=true`, every valid
text or picker change commits immediately. Empty values and syntactically valid
CSS custom-property references such as `var(--brand, #ff0000)` are supported.
Invalid text rolls back to the most recent valid draft.

**Composition and focus management:** `presentation="field"` is the default
and preserves the input-like wrapper DOM. `presentation="swatch"` renders a
real Malva button trigger with the explicit `ariaLabel` applied to both trigger
and dialog. `presentation="icon"` keeps that same accessible Malva trigger and
projects its content as the icon, allowing toolbar owners to choose a semantic
icon without reimplementing the picker popup. Its optional clear action is a localized Malva button. Input focus
opens field mode without moving focus, so text remains editable. Keyboard
activation of either swatch moves focus to the first tabbable picker control
and closing restores focus to the connected trigger. The popup has
`role="dialog"` without `aria-modal` or a focus trap. `aria-haspopup`,
`aria-expanded`, and `aria-controls` link both triggers to the panel.

The public `opened` model supports controlled popup state and emits
`openedChange`. `afterOpened` fires after the detached panel attaches;
`afterClosed` fires after its leave lifecycle and teardown. Public readonly
`triggerElement` and `panelElement` signals expose the current native
composition boundaries and return `null` whenever the corresponding DOM is
not attached, including after close and destroy.

The former local fixed backdrop and absolute panel were removed. `mlv-popup`
now owns CDK connected positioning, stacking, Escape, and backdrop dismissal.
Its backdrop is inserted before the connected panel in the shared overlay
stacking context, so the panel remains above the backdrop.

#### Inputs

| Name               | Type                            | Default                 | Description                                                                                                                               |
| ------------------ | ------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `disabled`         | `BooleanInput`                  | `false`                 | _(inherited)_ Disables input, swatch, and picker; also settable via forms                                                                 |
| `readonly`         | `BooleanInput`                  | `false`                 | _(inherited)_ Prevents editing, clearing, and popup opening                                                                               |
| `clearable`        | `BooleanInput`                  | `false`                 | _(inherited)_ Shows the shared clear button while the committed value is non-empty and the picker is neither readonly nor disabled (#301) |
| `presentation`     | `'field' \| 'swatch' \| 'icon'` | `'field'`               | Chooses the input-like field, color swatch, or projected-icon Malva trigger                                                               |
| `ariaLabel`        | `string \| undefined`           | `undefined`             | Explicit accessible name for compact trigger and detached dialog                                                                          |
| `opened`           | `boolean`                       | `false`                 | Two-way model controlling the connected popup                                                                                             |
| `showOpacity`      | `BooleanInput`                  | `true`                  | Passed to inner picker                                                                                                                    |
| `defaultMode`      | `MlvColorInputMode`             | `'hex'`                 | Passed to inner picker                                                                                                                    |
| `supportedFormats` | `readonly MlvColorInputMode[]`  | `['hex', 'rgb', 'hsl']` | Passed to the inner picker; one format hides tabs                                                                                         |
| `live`             | `BooleanInput`                  | `false`                 | Publishes every valid draft immediately instead of on blur/close                                                                          |
| `state`            | `MlvFormState`                  | `'default'`             | _(inherited)_ Validation state rendered by `MlvFormControlWrapper`                                                                        |
| `id`               | `string`                        | auto (`mlvNextId`)      | _(inherited)_ Bound to the native input                                                                                                   |

#### Outputs

| Name           | Type      | Description                                                  |
| -------------- | --------- | ------------------------------------------------------------ |
| `colorChange`  | `string`  | Emits CSS color string on every change                       |
| `openedChange` | `boolean` | Model change emitted for popup open and close intent         |
| `afterOpened`  | `void`    | Emits after the detached picker panel has attached           |
| `afterClosed`  | `void`    | Emits after leave animation, teardown, and focus restoration |

#### Composition element signals

| Name             | Type                          | Description                                                      |
| ---------------- | ----------------------------- | ---------------------------------------------------------------- |
| `triggerElement` | `Signal<HTMLElement \| null>` | Current field/compact trigger, or `null` when it is not rendered |
| `panelElement`   | `Signal<HTMLElement \| null>` | Current detached picker panel, or `null` outside its lifetime    |

#### Forms value

Implements the same signal-control value contract as `MlvColorPicker`.
The inner picker keeps its hue across achromatic values while the panel is
open (#315); a freshly opened panel has no prior hue, so an achromatic
committed value opens at hue 0.
The committed value may be empty or a CSS variable reference. CSS variables
are displayed directly by the swatch and resolved through computed style only
to initialize the visual picker; opening never rewrites the public string.
That computed style is read through the injected `DOCUMENT`'s window
(`defaultView?.getComputedStyle`), so a document without one — the server's —
falls back to the picker default instead of throwing (#337).

---

## Color Utils

**File:** `libs/core/color-picker/src/lib/color-utils/color-utils.ts`

Pure-function color math with no external dependencies. Supports:

- HSL ↔ RGB conversion
- HEX ↔ RGBA conversion
- CSS color string parsing (hex, rgb, rgba, hsl, hsla)
- Strict parse-success detection for editable color validation
- CSS `var(...)` color-reference validation, including nested fallbacks
- CSS color string generation per mode

---

## Usage Examples

```html
<!-- Inline with event binding -->
<mlv-color-picker (colorChange)="selectedColor = $event" />

<!-- Inline with reactive forms -->
<mlv-color-picker [formControl]="colorControl" />

<!-- Popup mode -->
<mlv-color-picker-popup [formControl]="colorControl" />

<!-- Input-like popup with shared field slots and clear -->
<mlv-color-picker-popup clearable label="Brand color">
  <span *mlvFormControlPrepend>CSS</span>
  <span *mlvFormControlAppend>theme</span>
</mlv-color-picker-popup>

<!-- Popup with no opacity slider -->
<mlv-color-picker-popup [showOpacity]="false" />

<!-- Picker starting in RGB mode with only RGB and HSL available -->
<mlv-color-picker defaultMode="rgb" [supportedFormats]="['rgb', 'hsl']" />

<!-- Publish popup changes immediately instead of on blur/close -->
<mlv-color-picker-popup live />

<!-- Compact toolbar composition with controlled lifecycle -->
<mlv-color-picker-popup presentation="swatch" ariaLabel="Text color" clearable [(opened)]="colorPickerOpen" (afterOpened)="registerPicker()" (afterClosed)="restoreToolbarFocus()" />
```

---

## CSS Custom Properties

The component uses `--mlv-*` design tokens from `@malva-ui/styles`. No component-scoped custom properties are introduced — all sizing and colors come from the shared token set.

---

## Internationalization (i18n)

Strings resolve through `MLV_COLOR_PICKER_I18N` (`@malva-ui/i18n`). The popup swatch trigger `aria-label` uses the ICU string `pickColor` (`"Pick color: {color}"`), resolved via `MlvI18nResolverService` and exposed as the `_pickColorLabel` computed on `MlvColorPickerPopup`. Provide `provideMlvI18nTesting()` in specs.

## Dependencies

### Angular / third-party peers

| Package                  | Role                                          |
| ------------------------ | --------------------------------------------- |
| `@angular/core`          | Signals, DI, component, effects               |
| `@angular/forms/signals` | `FormValueControl` contract and `[formField]` |
| `@angular/cdk/coercion`  | Boolean coercion for inputs                   |

### Internal package dependencies

- `@malva-ui/cdk/accessibility` — `MlvTabbableElementService`, used for keyboard swatch focus transfer
- `@malva-ui/cdk/utils` — `mlvNextId`, used by `MlvColorPickerPopup` for its panel id
- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase`, `MLV_FORM_CONTROL`, `MlvFormControlWrapper`, label/hint/message, clearable, prepend, and append support
- `@malva-ui/core/popup` — connected non-modal overlay, light-dismiss, positioning, and shared stacking
- `@malva-ui/core/tabs` — shared tight-density tab group used for the format switcher
- `@malva-ui/core/input` — `MlvInput` (`mlv-input`), used for the HEX/RGB/HSL numeric/text value fields

---

## File Structure

```
libs/core/color-picker/src/
  index.ts                                    — public API barrel
  test-setup.ts                               — Vitest setup
  lib/
    color-utils/
      color-utils.ts                          — Pure color math (no deps)
    color-picker/
      color-picker.ts                         — MlvColorPicker
      color-picker.html                       — Template
      color-picker.scss                       — BEM styles
      color-picker.spec.ts                    — Unit tests
      color-picker-binding-matrix.spec.ts     — Forms binding matrix
      color-picker-hue.spec.ts                — Hue kept across achromatic values, write precision, echo/respell/forms hosts (#315)
      color-picker-echo.spec.ts               — Parse/sync/repaint counts per interaction (#315)
    color-picker-popup/
      color-picker-popup.ts                   — MlvColorPickerPopup
      color-picker-popup.html                 — Template
      color-picker-popup.scss                 — BEM styles
      color-picker-popup.spec.ts              — Unit tests
      color-picker-popup-binding-matrix.spec.ts — Forms binding matrix
      color-picker-popup-clear.spec.ts        — Clear action (#301)
      color-picker-popup-composition.spec.ts  — Public field/swatch composition and lifecycle tests
      color-picker-popup-field-label.spec.ts  — Projected `<mlv-label>` naming (#197)
      color-picker-popup-hue.spec.ts          — Hue kept in the open panel (#315)
```

---

## Document binding (2026-09, #337)

- Canvas drag listens for `pointermove` / `pointerup` on the **canvas's own document** (`ownerDocument` of the pointerdown's `currentTarget`), not the global `window` and not the injected `DOCUMENT`. Real pointer events reach it unchanged: the canvas holds pointer capture, so they are targeted at the canvas and bubble through its document. That is the app's document in the ordinary case, and the other document when the picker is rendered into an iframe preview or a print window — where the injected `DOCUMENT` would never see the drag. A **synthetic** event dispatched on `window` no longer drives a drag (events bubble document → window, not back) — dispatch on the canvas's document or the canvas. Browser-only by construction: a `pointerdown` never happens on the server.
- `mlv-color-picker-popup` finds its panel for keyboard focus transfer with the injected document's `getElementById`, and reads computed style through its `defaultView`.
- Specs: `color-picker.spec.ts` § _(canvas document)_ — an isolated `createHTMLDocument()` `DOCUMENT` (TestBed renders into it, so canvas and injected document coincide), and the fixture moved into a second document (canvas and injected document differ; the app's document hears nothing); `color-picker-popup.spec.ts` § _(injected DOCUMENT)_.

## Touched (2026-09, #347)

- `mlv-color-picker` emits `touch` when focus leaves the panel, via the base's `_reportTouchOnFocusLeave()` (`libs-form-utils.md` § _Touched when focus leaves the control_). It used to be a host `(focusout)` → `_markTouched()`, which touched on every internal move: canvas → hue strip → mode tabs → HEX field.
- Canvas drag: its `pointerdown` is `preventDefault()`ed, so the press moves no focus — whatever held focus keeps it (Chromium, Firefox and WebKit measured). The `pointerup` therefore touches only if `_focusIsInsideControl()` is `false`: focus elsewhere → touches at release (nothing else reports the gesture); focus on one of the picker's own inputs → touched waits for focus to leave. Before, every canvas `pointerup` touched.
- Known gap: the mode tab group's overflow popup is portaled, so focus moving into it counts as leaving. Follow-up.
- `mlv-color-picker-popup` is unchanged: its input → panel move and its Escape touch while focus stays inside. Follow-up.
- Spec: `color-picker-touched.spec.ts`.

## Field surface (2026-08)

- `ariaLabel` moved to `MlvSignalFormUiControlBase`; `MlvColorPickerPopup` no longer declares its own (same behaviour for the swatch/icon trigger). In `presentation="field"` mode it now also names the text input when no visible `label` is set, falling back to the i18n `colorPicker` string.
- Inherited `required` renders the `mlv-label` marker and sets `aria-required` on the field input.
- Inherited `description` renders `<mlv-description>` below the control; `aria-describedby` is the base's `_describedBy()` (replacing the local `_messageId()` computed).
- `mlv-color-picker` itself (the panel body) renders no label/description chrome, so `required` / `description` have no effect there — use `mlv-color-picker-popup` or an outer `mlv-form-field`.

## Naming from a projected `<mlv-label>` (2026-09, #197)

`MlvColorPickerPopup` reports `_externalLabelStrategy()` **`'native'`** in
`presentation="field"`, where `id()` lands on the native text `<input>`. The
`swatch` / `icon` presentations render a button trigger carrying no `id`, so
they report `'none'` and name themselves through `ariaLabel`. `MlvColorPicker`
(the inline canvas + range strips) is a composite with no single name target and
stays `'none'`.

The field input's `aria-label` falls back to the non-null `_i18n().colorPicker`
and was suppressed only by the control's own `label` **input** — which is empty
in exactly the case the name comes from the field. Since `aria-label` outranks
`<label for>`, that left the projected label delivering click-to-focus and no
name; the binding now also consults the base's `_externallyLabelled()`.

Full contract, the `'native'` vs `'aria'` split and the dev-mode warning:
`.claude/projects/libs-form-utils.md` → _`MlvFormField` → Accessible name_.

## Disabled surface (2026-09, #366)

- `mlv-color-picker--disabled` no longer multiplies the whole picker. The saturation plane (`__canvas-container`) and `__sliders` (hue / opacity strips + preview) keep `opacity: var(--mlv-disabled-opacity)` — colour data with no disabled token, allow-listed in the guard; `__input-label` and the format tabs take `--mlv-text-disabled` (tab indicator too); the HEX / RGB / HSL fields are `mlv-input`s with their own disabled field.
- `mlv-color-picker-popup--disabled`: only `__swatch` keeps the token opacity (allow-listed); the field and the swatch trigger (`mlvButton`) declare their own surface.
- Spec: `color-picker-disabled-styles.spec.ts`.
- Guard: `styles:check-disabled-surface` (`scripts/check-disabled-surface.mjs`, a `styles:lint` dependency) fails any other disabled `opacity` and any `--state-success/warning/info` rule.
