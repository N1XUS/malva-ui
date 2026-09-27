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
| `state`       | `MlvFormState`               | `'default'`    | _(inherited)_ Validation state; only `error` paints (see _Validation state_, #320)    |
| `description` | `string`                     | `''`           | _(inherited)_ Help text under the track, in every thumb's `aria-describedby` (#320)   |
| `message`     | `string`                     | `''`           | _(inherited)_ Validation message under the track, in `aria-describedby` (#320)        |

#### Host Bindings

```ts
host: {
  class: 'mlv-slider',
  '[class]': '"mlv-slider--state-" + resolvedState()',
  '[class.mlv-slider--range]': 'range()',
  '[class.mlv-slider--disabled]': 'computedDisabled()',
  '[class.mlv-slider--has-ticks]': 'showTicks()',
  '[class.mlv-slider--has-text]': '_hasText()',
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

**Readonly / disabled** (#298): no key moves a thumb, no track click jumps, no drag starts. `_setLowValue` / `_setHighValue` write through `_write()` (range writes via `_writeRange()`, see _Drag gesture end and emissions_). Before #298 every path checked only `computedDisabled()`, so a readonly slider moved on all of them. Readonly thumbs keep `tabindex="0"`, so the value stays reachable and announced.

- **Thumb keys:** disabled returns first (thumb out of tab order; key untouched, as before). Readonly: a recognised slider key (arrows, Page, Home, End) is still `preventDefault()`ed, then refused — a thumb has no caret, so its only remaining default is scrolling the page. Unrecognised keys (Tab, …) pass through.
- **Track `pointerdown`:** returns while `!_canWrite()` — no window listeners, no captured pointer, no `mlv-slider--dragging`.
- **Drag that outlives permission** (`readonly`/`disabled` flips on mid-drag): `onMove` returns while `!_canWrite()`, so the thumb stops following the pointer (not only the value) and rests at the last permitted position; release settles it on the value.

#### ARIA

- `role="slider"` on each thumb
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax` bound reactively
- `aria-orientation` reflects the `orientation` input
- `aria-disabled` when disabled
- `aria-readonly="true"` on each thumb while readonly (the slider role supports it); no attribute otherwise
- `aria-invalid="true"` on **each** thumb while `resolvedState()` is `error`; no attribute otherwise (#320)
- `aria-describedby` on each thumb = `_describedBy()`: own description, own message, the enclosing `mlv-form-field`'s error id (#320)
- `aria-label` describes each thumb (`"Value"`, `"Minimum value"`, `"Maximum value"`)
- Tooltip bubbles are visual-only (`aria-hidden="true"`) because `aria-valuenow` already exposes the live value without duplicate announcements

#### Pointer interaction (internal)

- The `.mlv-slider__track` element carries a `#track` template ref and is resolved with a signal `viewChild` (`_trackRef = viewChild<ElementRef<HTMLElement>>('track')`) — no `querySelector` on the host (it is the component's own static template element).
- The host `pointerdown` handler returns early when the press lands inside `.mlv-slider__description` / `.mlv-slider__message` (#320): the host renders them, and selecting their text must not jump a thumb.
- On `pointerdown` the track's `DOMRect` is measured once and cached in `_dragTrackRect`; the window `pointermove` handler reuses that cached rect for its percent math instead of forcing a `getBoundingClientRect` layout read per move. The cache is cleared when the gesture ends (`_pointerToPercent` falls back to a fresh `_trackRef()` measurement outside a drag). The move stream stays in-zone: sub-step thumb tracking (`_lowDragPercent`/`_highDragPercent`) needs change detection each move for smooth dragging.

#### Drag gesture end and emissions (#338)

- **Primary button only:** the host `pointerdown` returns first unless `event.button === 0`, so a right-click (context menu) or middle-click on a thumb or the track moves nothing, emits nothing and starts no drag. Before, any button jumped a thumb and started a drag (VERSIONING row 117 — the library's other drags already required the primary button).
- **Listeners:** a drag is one `fromEvent(window, 'pointermove')` stream filtered to the pressing `pointerId`, `takeUntil(end$)` + `takeUntilDestroyed`, plus one `end$` subscription running the end (`window` from the injected `DOCUMENT`'s `defaultView`). `end$` is `mlvPointerGestureEnd` (`@malva-ui/cdk/utils`, internal): `pointerup` / `pointercancel` on `window`, or the pressed thumb losing capture. A track press captures nothing, so it ends on the window events only. Before: three `Renderer2.listen('window', …)` disposers plus one `DestroyRef.onDestroy` closure **per drag** that nothing released — one registration per drag for the component's life — and lost capture did not end a drag. A `setPointerCapture` that throws (inactive pointer) is caught; the drag then ends on the window events.
- **Every end** clears `_activeDragThumb` (→ no `--dragging`), the drag percents and `_dragTrackRect`, and keeps the #347 touch rule (touches only when `_focusIsInsideControl()` is `false`).
- **Emissions — breaking, range mode only** (VERSIONING row 112; [migration](../../docs/migrations/2026-09-slider-range-single-emission.md)): `model()` dedupes with `Object.is`, and a range tuple is a fresh array on every write, so each range write emitted. Every path wrote twice — the setter, then an `_emitChange()` re-writing the same tuple — so a range drag sent **two** identical values per `pointermove` even inside one step (10 moves within a step: 20 `valueChange` + 20 `FormControl.valueChanges`), and one arrow key sent two. `_emitChange` is gone; range writes go through `_writeRange(low, high)`, which skips a tuple whose ends equal the current model's (`Object.is` per end). Now: moves within a step emit **0**, crossing a step **1**, one key **1**, a track press **1**. Scalar mode never duplicated (`Object.is` on a number) and is unchanged.
- **Not covered — owner question (#608):** a second pointer (or a second press while a track drag runs) re-enters `_onTrackPointerDown` and starts another drag over the first — the first pointer's moves then drive the thumb the second one picked, and the first lift clears both drags' state; the slider has no re-entry guard, unlike split pane and sidebar rail.
- Spec: `slider-gesture-end.spec.ts` (emission counts, primary button only on track and thumb, lost capture, no per-drag `DestroyRef` growth, destroy releases window listeners).

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

| Package                     | Role                                                                           |
| --------------------------- | ------------------------------------------------------------------------------ |
| `@angular/common`           | `NgTemplateOutlet` for custom tooltip rendering                                |
| `@angular/core`             | Signals, DI, component                                                         |
| `@angular/forms/signals`    | `FormValueControl` binding through the shared signal base                      |
| `@angular/cdk/coercion`     | Boolean coercion                                                               |
| `@malva-ui/core/form-utils` | `MlvSignalFormControlBase`, `MLV_FORM_CONTROL`, `MlvDescription`, `MlvMessage` |
| `@malva-ui/cdk/density`     | `MlvCompactComfortableDensity`, `MLV_DENSITY_ELEMENT`                          |

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
      slider-validation.spec.ts    — #320 error class, aria-invalid, description/message, --has-text, field error, compiled grid rules, axe
```

---

## Validation state (2026-09, #320)

- **Host class `mlv-slider--state-<resolvedState>`.** Only `--state-error` has a rule: `.mlv-slider--state-error .mlv-slider__track` takes `background-color: var(--mlv-border-error)` — the unfilled rail turns red, the fill and thumbs keep the accent so the value stays readable. `success` / `warning` / `info` emit the class and no rule (SF-R6).
- **`aria-invalid` and `aria-describedby` on every thumb** (both in range mode) — see _ARIA_.
- **`description` and `message` render under the track.** Before, both type-checked and rendered nothing.
- **Layout: the host is a one-column grid, no longer a flex row.** The track owns row 1 (`grid-area: 1 / 1 / 2 / 2`), the text stacks in auto rows below with a `--mlv-spacing-1` gap. The thumbs and tooltips are absolutely positioned **with** that grid area, so their containing block is row 1, not the host's padding box — `top: 50%` and the inline / `bottom` percentages still resolve against the track whether or not text renders. All four lines are written and pinned by `slider-validation.spec.ts`: an absolutely positioned grid child resolves an `auto` end line to the padding edge, so the two-line `grid-area: 1 / 1` puts the thumb off the track — measured 10px with no text, 17px with one text row, 28px with two. `align-content: center` keeps the old centring in a host taller than its content; vertical mode swaps the row to `minmax(0, 1fr)` and centres the track with `justify-self`.
- **`mlv-slider--has-text`** (`_hasText()`: the same `description() || message()` the template's `@if`s test). Row 1 is `auto` — as tall as the track, like the old flex line — and only under this modifier does a horizontal slider hold it at `minmax(var(--mlv-slider-thumb-size), auto)`, so the centred thumb clears the first text row. Unscoped, the minimum grew a text-less slider whose `--mlv-slider-thumb-size` exceeds the space its padding leaves (2rem: 44 → 56px). A vertical slider sizes row 1 from its explicit height; under the modifier its first text row (the description, else the message) takes `margin-block-start: calc(var(--mlv-slider-thumb-size) / 2)`, because a thumb at the minimum overhangs the rail's bottom end by half its size.
- Measured in Chromium and WebKit (Playwright, LTR + RTL, comfortable + compact, horizontal + vertical, default / `2rem` / `1.75rem` thumb): with no text the host size, track size, thumb cross-axis offset (0) and thumb position are identical to `main` in every case but one — **vertical compact**, whose thumbs now sit on the rail (at value 40: `main` 39.1% of the rail, now 40%). There the density's `padding-block: 0.5rem` wins over the vertical `padding-block: 0`, and on `main` the thumbs resolved `bottom` against the host's padding box, 8px beyond each rail end, while the pointer maths reads the rail — so a press and the thumb it moved disagreed by up to 8px. With text the thumb stays centred on the track at the same fraction and clears the text at 0 / 40 / 100; a vertical slider's track shrinks by the text rows (the pointer maths follows the track rect).
- The description / message take back `cursor: auto` and `user-select: text` from the host, and the host `pointerdown` handler ignores presses on them. **Not** `touch-action`: the effective value intersects down the tree, so the host's `none` still covers the text rows and a touch pan that starts on them does not scroll the page. Moving `none` onto the track and thumbs would make a drag that starts beside the 0.25rem rail — anywhere else in the 2.75rem host — pan instead; fixing it needs a dedicated hit layer (follow-up).

## Touched (2026-09, #347)

- Keyboard / focus: `touch` fires when focus leaves the slider, through the base's `_reportTouchOnFocusLeave()` (`libs-form-utils.md` § _Touched when focus leaves the control_). A move from one range thumb to the other does nothing. Before, each thumb's `(blur)` → `_onThumbBlur()` touched, so Tab from the start thumb to the end thumb touched mid-range. `_onThumbBlur` and both template bindings are gone.
- Pointer: the drag end touches only if `_focusIsInsideControl()` is `false` at release.
  - Thumb press → the thumb takes focus (Chromium, Firefox and WebKit measured) → no touch at release; touched waits for focus to leave, as for a keyboard user. Before, every drag end touched, so a thumb drag under a failing validator painted the rail `error` and set `aria-invalid` while the thumb still had focus.
  - Track press → focus goes to a focusable ancestor or nowhere, never into the slider → touches at release. The focus-leave report never sees that gesture, so its end is the only "done" signal a mouse user gives.
- Spec: `slider-touched.spec.ts` (thumb → thumb, leaving, thumb drag, track press).

## Field surface (2026-08)

- The single-thumb slider's accessible name is now `ariaLabel() || label() || i18n.value` — the inherited `ariaLabel` input takes precedence over `label`. Range mode is unchanged: the two thumbs keep the i18n `minValue` / `maxValue` names, which stay unambiguous.
- No `aria-required`: ARIA does not allow `aria-required` on `role="slider"`, so the inherited `required` input has no ARIA effect here.
