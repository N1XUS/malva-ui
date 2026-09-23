---
# Library: slider

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Slider library (`@malva-ui/core/slider`) provides a range slider component (`mlv-slider`) for selecting numeric values or numeric ranges. It supports single-thumb (value) and dual-thumb (range) modes, horizontal and vertical orientation, optional tick marks, live value tooltips with custom renderers, keyboard navigation, all three Angular forms APIs through `MlvSignalFormControlBase<MlvSliderValue>`, and density scaling through `@malva-ui/cdk/density`.

## Public API

Exported from `libs/core/slider/src/index.ts`:

| Export                    | Kind      | Description                                                     |
| ------------------------- | --------- | --------------------------------------------------------------- |
| `MlvSlider`         | Component | Range slider — `mlv-slider`                                     |
| `MlvSliderTooltipDef`        | Directive | `[mlvSliderTooltipDef]` custom tooltip renderer                  |
| `MlvSliderValue`             | Type      | `number \| [number, number]`                                    |
| `MlvSliderTooltipDefContext` | Interface | Custom tooltip context with `$implicit`, `value`, and `thumb`    |
| `MlvSliderTooltipThumb`      | Type      | Semantic thumb identity: `'value' \| 'min' \| 'max'`             |

---

## Components

### `MlvSlider`

**File:** `libs/core/slider/src/lib/slider/slider.ts`
**Selector:** `mlv-slider` | **Change Detection:** `OnPush`

Extends `MlvSignalFormControlBase<MlvSliderValue>` from `@malva-ui/core/form-utils`. Its `value = model<MlvSliderValue>(0)` is the single source for the scalar/range selection and implements `FormValueControl<MlvSliderValue>` without a CVA provider.

#### Inputs

| Name          | Type                         | Default        | Description                                                                           |
| ------------- | ---------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| `min`         | `number`                     | `0`            | Minimum value                                                                         |
| `max`         | `number`                     | `100`          | Maximum value                                                                         |
| `step`        | `number`                     | `1`            | Step increment                                                                        |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Track direction; vertical runs bottom-to-top and requires a height on the host        |
| `showTicks`   | `BooleanInput`               | `false`        | Render tick marks at each step                                                        |
| `range`       | `BooleanInput`               | `false`        | Dual-thumb range mode; value becomes `[number, number]`                               |
| `tooltip`     | `BooleanInput`               | `false`        | Show live thumb values on hover, drag, and keyboard focus                             |
| `disabled`    | `BooleanInput`               | `false`        | _(inherited)_ Disables interaction                                                    |
| `readonly`    | `BooleanInput`               | `false`        | _(inherited)_ Value locked, thumbs still focusable; also a signal-forms field binding |
| `label`       | `string`                     | `''`           | _(inherited)_ `aria-label` for single-thumb mode                                      |

#### Host Bindings

```ts
host: {
  class: 'mlv-slider',
  '[class.mlv-slider--range]': 'range()',
  '[class.mlv-slider--disabled]': 'computedDisabled()',
  '[class.mlv-slider--has-ticks]': 'showTicks()',
  '[class.mlv-slider--vertical]': '_isVertical()',
  '[class.mlv-slider--dragging]': '_activeDragThumb() !== null',
  '[style.--mlv-slider-fill-start]': '_fillStart()',
  '[style.--mlv-slider-fill-end]': '_fillEnd()',
  '(pointerdown)': '_onTrackPointerDown($event)',
}
```

#### Density

Uses `MlvCompactComfortableDensity` as a `hostDirective` (no spacious support — sliders are already compact in comfortable mode). Provides `MLV_DENSITY_ELEMENT = 'slider'`.

CSS density classes applied: `mlv-slider--compact`, `mlv-slider--comfortable`.

#### Keyboard Navigation

| Key                       | Action                                 |
| ------------------------- | -------------------------------------- |
| `ArrowRight` / `ArrowUp`  | Increase focused thumb by `step`       |
| `ArrowLeft` / `ArrowDown` | Decrease focused thumb by `step`       |
| `PageUp`                  | Increase focused thumb by 10% of range |
| `PageDown`                | Decrease focused thumb by 10% of range |
| `Home`                    | Move focused thumb to `min`            |
| `End`                     | Move focused thumb to `max`            |

Horizontal arrows are **logical** — in RTL `ArrowLeft` increases and `ArrowRight` decreases. Direction is resolved from the slider's own host (`normalizeArrowKey(event, this._direction())`), the same cached `_direction` signal that feeds the pointer maths, so a slider inside a scoped `dir="rtl"` subtree (or an overlay pane, which CDK stamps with its own `dir`) mirrors both halves together while the document stays LTR. Vertical arrows, `PageUp`/`PageDown` and `Home`/`End` never mirror.

#### Direction (RTL) geometry (#308)

- Horizontal positions are **logical**: thumbs, tooltips and ticks bind `[style.inset-inline-start]` (was `[style.left]`), like the fill's `inset-inline-start: var(--mlv-slider-fill-start)`. Before #308 the fill mirrored and the thumbs did not — `value=20` in RTL drew the fill at 320–400px of a 400px track and the thumb at 80.
- Centring shift is direction-signed: `translate(mixins.inline-distance(-50%), …)` on the thumb (incl. `:hover` / `:active`), the tooltip (hidden and visible) and `translateX(mixins.inline-distance(-50%))` on a tick — `inset-inline-start` anchors the box's right edge in RTL.
- Snap-back transitions name `inset-inline-start` (fill, thumb, tooltip); a `left` transition never saw the RTL start move.
- `.mlv-slider__ticks` spans the track with `inset-inline-start: 0` + `width: 100%` — symmetric, so written logically.
- Physical, with `// physical:` comments: the tooltip arrow's `left: 50%` centring pair, and the whole vertical cross axis (ticks, thumb, tooltip `left`, tooltip `transform-origin`). Open decision, not settled here: keep the vertical cross axis physical or mirror it — together with the vertical tooltip arrow, which points away from its thumb in RTL (`inset-inline-end: 100%` + `border-inline-end` resolve to the tooltip's far side).
- Vertical rules reset the logical inset their horizontal base sets before going physical — in RTL the base resolves to `right` and over-constrains the box, so a bare `left` is ignored:
  - fill: `inset-inline-start: 0` (was a physical `left: 0`, which offset a vertical range fill by the low value's percentage);
  - ticks row: `inset-inline-start: auto` **ahead of** `left: 50%` in the same rule (without it, ticks sit 2px off the track centre in RTL).
- Pinned by `slider.spec.ts` § _horizontal geometry is logical_ (bound styles, LTR / global RTL / scoped RTL) and `slider-styles.spec.ts` (compiled CSS: fill and ticks placement, centring, transitions, vertical resets). Verified in Chromium: scoped and global RTL `value=20` → thumb centre 320, fill 320–400; LTR and vertical LTR byte-identical to before.

**Readonly / disabled** (#298): no key moves a thumb, no track click jumps, no drag starts. `_setLowValue` / `_setHighValue` / `_emitChange` write through `_write()`. Before #298 every path checked only `computedDisabled()`, so a readonly slider moved on all of them. Readonly thumbs keep `tabindex="0"`, so the value stays reachable and announced.

- **Thumb keys:** disabled returns first (thumb out of tab order; key untouched, as before). Readonly: a recognised slider key (arrows, Page, Home, End) is still `preventDefault()`ed, then refused — a thumb has no caret, so its only remaining default is scrolling the page. Unrecognised keys (Tab, …) pass through.
- **Track `pointerdown`:** returns while `!_canWrite()` — no window listeners, no captured pointer, no `mlv-slider--dragging`.
- **Drag that outlives permission** (`readonly`/`disabled` flips on mid-drag): `onMove` returns while `!_canWrite()`, so the thumb stops following the pointer (not only the value) and rests at the last permitted position; release settles it on the value.

#### ARIA

- `role="slider"` on each thumb
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax` bound reactively
- `aria-orientation` reflects the `orientation` input
- `aria-disabled` when disabled
- `aria-readonly="true"` on each thumb while readonly (the slider role supports it); no attribute otherwise
- `aria-label` describes each thumb (`"Value"`, `"Minimum value"`, `"Maximum value"`)
- Tooltip bubbles are visual-only (`aria-hidden="true"`) because `aria-valuenow` already exposes the live value without duplicate announcements

#### Pointer interaction (internal)

- The `.mlv-slider__track` element carries a `#track` template ref and is resolved with a signal `viewChild` (`_trackRef = viewChild<ElementRef<HTMLElement>>('track')`) — no `querySelector` on the host (it is the component's own static template element).
- On `pointerdown` the track's `DOMRect` is measured once and cached in `_dragTrackRect`; the window `pointermove` handler reuses that cached rect for its percent math instead of forcing a `getBoundingClientRect` layout read per move. The cache is cleared on `pointerup` or `pointercancel` (`_pointerToPercent` falls back to a fresh `_trackRef()` measurement outside a drag). The move stream stays in-zone: sub-step thumb tracking (`_lowDragPercent`/`_highDragPercent`) needs change detection each move for smooth dragging.

### `MlvSliderTooltipDef`

**File:** `libs/core/slider/src/lib/slider/slider-tooltip-def.ts`

**Selector:** `[mlvSliderTooltipDef]`

The structural directive supplies an optional inline renderer for tooltip text.
The context exposes the current number as both `$implicit` and `value`, plus the
semantic `thumb` identity (`'value'`, `'min'`, or `'max'`). Tooltips are
positioned as thumb siblings, so their content is not distorted by thumb
hover/press transforms and follows raw drag geometry without overlay layout
work.

---

## Usage Examples

```html
<!-- Single value -->
<mlv-slider [min]="0" [max]="100" [(ngModel)]="volume" />

<!-- Range -->
<mlv-slider [range]="true" [min]="0" [max]="1000" [step]="50" [(ngModel)]="priceRange" />

<!-- Discrete with ticks -->
<mlv-slider [min]="0" [max]="5" [step]="1" [showTicks]="true" [(ngModel)]="rating" />

<!-- Reactive Forms -->
<mlv-slider [formControl]="myControl" />

<!-- Density override -->
<mlv-slider mlvDensity="compact" [min]="0" [max]="10" />

<!-- Vertical (host must have a height) -->
<mlv-slider orientation="vertical" style="height: 10rem;" [(ngModel)]="volume" />

<!-- Vertical range -->
<mlv-slider orientation="vertical" [range]="true" style="height: 12rem;" [(ngModel)]="tempRange" />

<!-- Default live value tooltip -->
<mlv-slider tooltip [(ngModel)]="volume" />

<!-- Custom tooltip renderer -->
<mlv-slider tooltip range [(ngModel)]="priceRange">
  <ng-template mlvSliderTooltipDef let-value let-thumb="thumb"> {{ thumb === 'min' ? 'From' : 'To' }}: {{ value | currency }} </ng-template>
</mlv-slider>
```

---

## CSS Custom Properties

| Property                          | Default                               | Description                          |
| --------------------------------- | ------------------------------------- | ------------------------------------ |
| `--mlv-slider-track-height`       | `0.25rem`                             | Track bar height                     |
| `--mlv-slider-thumb-size`         | `1.25rem`                             | Thumb circle diameter                |
| `--mlv-slider-thumb-border-width` | `0.125rem`                            | Thumb border width                   |
| `--mlv-slider-tooltip-gap`        | `0.5rem`                              | Distance between a thumb and tooltip |
| `--mlv-slider-tooltip-background` | `var(--mlv-palette-neutral-950)`      | Tooltip background color             |
| `--mlv-slider-tooltip-color`      | `var(--mlv-text-primary-on-accent-1)` | Tooltip foreground color             |
| `--mlv-slider-fill-start`         | `0%`                                  | Fill region start (set by component) |
| `--mlv-slider-fill-end`           | `0%`                                  | Fill region end (set by component)   |

Compact density reduces track height to `0.1875rem` and thumb size to `1rem`.

---

## Internationalization (i18n)

Thumb `aria-label`s resolve through `MLV_SLIDER_I18N` (`@malva-ui/i18n`):
`minValue` (single / min thumb), `maxValue` (range max thumb), and `value` (fallback when no `label` input is set). Provide `provideMlvI18nTesting()` in specs that instantiate the component.

## Dependencies

| Package                     | Role                                                      |
| --------------------------- | --------------------------------------------------------- |
| `@angular/common`           | `NgTemplateOutlet` for custom tooltip rendering           |
| `@angular/core`             | Signals, DI, component                                    |
| `@angular/forms/signals`    | `FormValueControl` binding through the shared signal base |
| `@angular/cdk/coercion`     | Boolean coercion                                          |
| `@malva-ui/core/form-utils` | `MlvSignalFormControlBase`, `MLV_FORM_CONTROL`            |
| `@malva-ui/cdk/density`     | `MlvCompactComfortableDensity`, `MLV_DENSITY_ELEMENT`     |

---

## File Structure

```
libs/core/slider/src/
  index.ts                         — public API barrel
  lib/
    slider/
      slider.ts                    — MlvSlider
      slider.html                  — template
      slider.scss                  — BEM styles
      slider-tooltip-def.ts — custom tooltip renderer definition
      slider.spec.ts               — unit tests
      slider-styles.spec.ts        — compiled-CSS checks (#308 RTL centring, transitions)
      slider-binding-matrix.spec.ts — forms integration matrix
      slider-readonly.spec.ts      — #298 write permission + axe sweeps
```

---

## Field surface (2026-08)

- The single-thumb slider's accessible name is now `ariaLabel() || label() || i18n.value` — the inherited `ariaLabel` input takes precedence over `label`. Range mode is unchanged: the two thumbs keep the i18n `minValue` / `maxValue` names, which stay unambiguous.
- No `aria-required`: ARIA does not allow `aria-required` on `role="slider"`, so the inherited `required` input has no ARIA effect here.
