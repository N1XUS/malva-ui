# Library: compare

> **Keep this file up to date.** Update this file whenever you change any component, directive, public API, template, styling, or dependency wiring in this library.

## Overview

`@malva-ui/core/compare` provides `mlv-compare`, a **before/after comparison
surface**: two projected content layers (images, charts, arbitrary markup)
stacked in one grid cell and split by a draggable divider. The two-way `value`
(0–100) is the share of the surface, measured from the inline-start edge (top
edge when vertical), that shows the _before_ layer. Feature-parity target:
PrimeNG Compare.

- **Leaf project (Nx):** `core-compare` at `libs/core/compare`
- **Secondary entry point:** `@malva-ui/core/compare` (also re-exported from the grouped `@malva-ui/core` barrel)
- **Package tag:** `scope:ui`

## Public API

Exported from `libs/core/compare/src/index.ts`:

| Symbol                    | Kind      | Selector                | Description                                                        |
| ------------------------- | --------- | ----------------------- | ------------------------------------------------------------------ |
| `MlvCompare`              | Component | `mlv-compare`           | Before/after comparison surface.                                   |
| `MlvCompareHandleDef`     | Directive | `[mlvCompareHandleDef]` | Structural template replacing the default glyph inside the handle. |
| `MlvCompareHandleContext` | Interface | —                       | Context of that template: `$implicit` / `orientation`, `dragging`. |
| `MlvCompareOrientation`   | Type      | —                       | `'horizontal' \| 'vertical'`                                       |

The two content layers are plain attribute selectors on projected elements —
no marker directive is needed; the handle glyph is a structural template:

| Slot                               | Role                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `[mlvCompareBefore]`               | Start-side layer (in the DOM first; rendered underneath).                                                                                  |
| `[mlvCompareAfter]`                | End-side layer (rendered on top, clipped from the start edge by `value`).                                                                  |
| `ng-template[mlvCompareHandleDef]` | Optional glyph replacing the default Lucide chevrons inside the handle (decorative); rendered with `{ $implicit, orientation, dragging }`. |

## Component

### `MlvCompare` — `mlv-compare`

- **Change detection:** `OnPush` · **Encapsulation:** `None`
- **Template:** `compare.html` — two `.mlv-compare__layer` grid-stacked
  divs (`--before`, `--after`), each carrying its optional
  `span.mlv-compare__label` caption (`--before` / `--after`, rendered only
  while the matching `beforeLabel` / `afterLabel` is set), a visually hidden native
  `<input type="range" class="mlv-compare__input">`, and an `aria-hidden`
  `.mlv-compare__divider` carrying the `.mlv-compare__handle`. The handle
  renders the `*mlvCompareHandleDef` template through `ngTemplateOutlet` when
  one is projected, otherwise the default `svg.mlv-compare__glyph` — Lucide
  `chevrons-left-right`, or `chevrons-up-down` when vertical.
- **Imports:** `NgTemplateOutlet`, `LucideChevronsLeftRight`, `LucideChevronsUpDown`

#### Inputs / Model

| Name             | Type                    | Default        | Description                                                                                                                                                                                                                                                                                                  |
| ---------------- | ----------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `orientation`    | `MlvCompareOrientation` | `'horizontal'` | Axis the divider travels along. `'vertical'` stacks _before_ above _after_, reads the block axis for pointer + keyboard, and adds `mlv-compare--vertical`.                                                                                                                                                   |
| `slideOnHover`   | `boolean` (coerced)     | `false`        | Steer the divider from the hovering pointer instead of press-and-drag (press/drag and touch scrubbing keep working). Adds `mlv-compare--hover`.                                                                                                                                                              |
| `step`           | `number`                | `1`            | Keyboard increment in percentage points for a plain arrow key; Shift+Arrow / PageUp / PageDown move ten steps. Non-positive or missing values fall back to `1`. Pointer input is continuous.                                                                                                                 |
| `value`          | `model<number>`         | `50`           | Two-way divider position (0–100, share of the surface showing _before_). Rendering clamps; an out-of-range bound value is **never written back**, so a controlled binding keeps its own truth.                                                                                                               |
| `beforeLabel`    | `string \| undefined`   | `undefined`    | Optional caption pinned to the start corner of the _before_ layer (inline-start / top). Rendered as visible text **inside that layer** — the _after_ layer covers it as the divider passes, so it only ever labels the side that shows; nothing renders while empty. Themed through `--mlv-compare-label-*`. |
| `afterLabel`     | `string \| undefined`   | `undefined`    | Optional caption pinned to the end corner of the _after_ layer — inline-end when horizontal, the bottom (block-end, inline-start) when vertical, so it always sits where that layer is visible. Same rendering rules as `beforeLabel`.                                                                       |
| `ariaLabel`      | `string \| undefined`   | `undefined`    | Accessible name of the slider. Falls back to the translated `compare.ariaLabel` (`MLV_COMPARE_I18N`). Ignored while `ariaLabelledby` is set.                                                                                                                                                                 |
| `ariaLabelledby` | `string \| undefined`   | `undefined`    | Id of a visible label element; takes precedence over `ariaLabel` and the fallback (no `aria-label` is emitted then, so the two never compete).                                                                                                                                                               |

#### Host bindings

```ts
host: {
  class: 'mlv-compare',
  '[class.mlv-compare--vertical]': '_isVertical()',
  '[class.mlv-compare--hover]': 'slideOnHover()',
  '[class.mlv-compare--dragging]': '_dragging()',
  '[style.--mlv-compare-value]': '_cssValue()',   // e.g. "37.5%" — the one geometry input the stylesheet reads
  '(pointerdown)': '_onPointerDown($event)',
  '(pointerenter)': '_onPointerEnter()',
  '(pointerleave)': '_onPointerLeave()',
}
```

Only the gesture _starts_ are host bindings. The move / end listeners are
attached with `Renderer2.listen` for the life of a gesture (see **Pointer** and
**Hover** below) and detached on release, leave and destroy, so an idle surface
has no hot-path listener at all.

#### Behaviour

- **Pointer.** Primary-button `pointerdown` on the host measures the surface
  once (`getBoundingClientRect`, cached for the whole drag — no layout read per
  move), captures the pointer on the host, attaches `pointermove` / `pointerup` /
  `pointercancel` listeners on the **window** (plus `lostpointercapture` on the
  host) for the life of the gesture, focuses the hidden range input
  (`preventScroll`), jumps the divider to the press position and calls
  `preventDefault()` (no native image drag / text selection / focus steal).
  Only moves with the same `pointerId` follow; a second `pointerdown` during a
  drag is ignored outright, so a second finger never hijacks — or, on lift, ends
  — the first finger's gesture. Release / cancel / lost capture end the drag,
  drop the cached rect and detach the listeners; because they live on the
  window this also holds when `setPointerCapture` threw and the release lands
  outside the host. Nothing is attached while idle (a host `pointermove`
  binding would schedule change detection on every idle mouse move). Non-primary
  buttons are ignored.
- **Hover.** With `slideOnHover`, `pointerenter` primes the rect cache and
  attaches a host `pointermove` listener that steers the divider (never while a
  drag is in progress); `pointerleave` detaches it and drops the cache (unless
  a drag still owns it). Hovering never adds `--dragging`.
- **Geometry.** `clientX` / `clientY` are physical; the inline offset is taken
  from the inline-start edge — the **right** edge in RTL — via
  `MlvRtlService.elementDirection(host)` (scoped `[dir]` aware). The block
  axis never mirrors. Pointer values are rounded to two decimals.
- **Keyboard** (on the range input, all handled keys `preventDefault`ed so the
  browser never steps a second time): `ArrowRight` / `ArrowLeft` ± `step`
  (mirrored in RTL through `normalizeArrowKey`), `ArrowUp` / `ArrowDown` ±
  `step` (horizontal: Up increases, native range convention; vertical: Down
  increases, following the divider's direction of travel), `Shift` × 10,
  `PageUp` / `PageDown` ± 10 steps, `Home` / `End` → 0 / 100. Unhandled keys
  pass through.
- **Native `input` event** (a screen reader's adjust gesture writing straight
  into the range) is synced into the model. The input has `step="any"` so its
  value / `aria-valuenow` is the exact rounded position rather than a
  step-snapped one.
- **Writes** go through `_commit`: clamp → round to 2 decimals → `value.set`
  only on change.

### `MlvCompareHandleDef` — `[mlvCompareHandleDef]`

Structural template-def directive (extends `MlvStructural` from
`@malva-ui/cdk/utils`, so it exposes the injected `templateRef`) that replaces
the glyph inside the handle. The handle chrome — size, shape, background,
shadow, hover / press feedback and the focus ring — always belongs to the
component; the template only supplies what sits inside it, and it is
decorative (`aria-hidden` inherits from the divider), so the slider's name
still comes from `ariaLabel` / `ariaLabelledby`. Keep the template
non-interactive: the divider is also `pointer-events: none`, so a focusable
element inside it would be unreachable by pointer yet still tabbable — an
`aria-hidden-focus` axe violation.

| Member                   | Kind          | Description                                                                                                  |
| ------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------ |
| `templateRef`            | Property      | `TemplateRef<MlvCompareHandleContext>` (inherited from `MlvStructural`).                                     |
| `ngTemplateContextGuard` | Static method | Type guard so `let-orientation` / `let-dragging="dragging"` infer `MlvCompareHandleContext` in the template. |

The component queries it with `contentChild(MlvCompareHandleDef)` and renders
it with a computed `MlvCompareHandleContext` — `$implicit` and `orientation`
are the current orientation, `dragging` is `true` only while a pointer drag is
in progress (never while merely hovering with `slideOnHover`).

## Accessibility

- **Direction (RTL): scoped, not per-document.** `_onKeydown` passes the host to `MlvRtlService.normalizeArrowKey(event, host)`, so a divider inside a `[dir="rtl"]` subtree mirrors its arrow stepping while the document stays LTR — and an LTR island under an RTL document does not. The same host feeds the pointer maths, so the keyboard and geometry halves cannot disagree. Vertical arrows, `Home` / `End` and `PageUp` / `PageDown` never mirror. Regressions in `compare.spec.ts`.
  Slider semantics come from the real `<input type="range" min="0" max="100"
step="any">` — role, `aria-valuenow`, `aria-valuemin/max` for free — plus
  `aria-valuetext="<n>%"`, `aria-orientation`, and an accessible name
  (`aria-labelledby` › `aria-label` › translated fallback). The input is
  visually hidden (`opacity: 0`), pointer-transparent, full-size (a screen
  reader's focus rectangle outlines the whole surface) and stays in the tab
  order. The divider/handle is `aria-hidden` and pointer-transparent.

Focus ring: keyboard focus lives on the hidden input, so the ring is drawn on
the handle the user sees —
`.mlv-compare:has(.mlv-compare__input:focus-visible) .mlv-compare__handle`,
Form A (SF-R3). The handle is 2.5rem (WCAG 2.5.8 target), though the whole
surface is the pointer target. `forced-colors: active` repaints the divider
and handle with system colours.

Projected content is display-only (the surface owns the gesture); consumers
should keep interactive controls out of the layers or out of the tab order.

## Styling

BEM block `.mlv-compare`, `@layer mlv.components`, logical properties
throughout. Elements: `__layer` (`--before` / `--after`), `__label`
(`--before` / `--after`), `__input`, `__divider`, `__handle`, `__glyph`.
Modifiers: `--vertical`, `--hover`, `--dragging`.

- **Layout.** Host is `display: grid` with `minmax(0, 1fr)` tracks; both
  layers sit in `grid-area: 1 / 1`, so the taller content sizes the surface
  and the other stretches — or an explicit `block-size` / `inline-size` on the
  host wins and both crop. Direct `img` / `video` / `canvas` / `picture` /
  `svg` children of a layer get `inline-size: 100%; block-size: 100%;
object-fit: cover`. `overflow: clip`, `isolation: isolate`,
  `border-radius: var(--mlv-compare-radius)`.
- **Clipping.** `.mlv-compare__layer--after` is clipped with
  `clip-path: inset(0 calc(max(0, -1 * var(--mlv-inline-direction)) * v) 0 calc(max(0, var(--mlv-inline-direction)) * v))`
  where `v` is `--mlv-compare-value` — `inset()` sides are physical, so the
  direction sign token picks the side (0 on the wrong one) and a scoped
  `[dir]` at any depth flips it with no duplicated rule. Vertical:
  `inset(v 0 0 0)`.
- **Divider / handle.** Divider at `inset-inline-start: v` centred with
  `mixins.translate-inline(-50%)` (block axis uses `inset-block-start` +
  `translateY(-50%)`); a `--mlv-compare-halo` box-shadow keeps it legible over
  light content. The handle is wider than the hairline it sits on, so it is
  absolutely positioned on the divider's midpoint — `inset-block-start: 50%`,
  `inset-inline-start: 50%`, `translate: calc(-50% * var(--mlv-inline-direction)) -50%`
  (the `translate` property, so it never fights the `transform` used for
  feedback, and the inline half is signed by direction so RTL centres the same
  way). Hover lift `scale(1.06)` (gated to `(hover: hover) and (pointer: fine)`),
  pressed `scale(0.94)` + tighter shadow while `--dragging`, glyph spreads
  along the travel axis (`scaleX(1.18)`, `scaleY(1.18)` when vertical) while
  dragging. Cursor `col-resize` / `row-resize`.
- **Captions.** Each `__label` is absolutely positioned inside its own
  `__layer` (`position: relative`), so it is clipped with that layer and only
  the visible side is ever labelled. Pinned to the travel-axis corners on the
  cross axis' start edge: `--before` at `inset-block-start` /
  `inset-inline-start`, `--after` at `inset-inline-end` (horizontal) or
  `inset-block-end` + `inset-inline-start` (vertical), all offset by
  `--mlv-compare-label-inset`. Uppercase body-s pill with a translucent scrim,
  `backdrop-filter: blur(0.375rem)`, one line with an ellipsis, capped at the
  layer width minus both insets. Forced-colors: `Canvas` / `CanvasText` with a
  hairline border.
- **Touch.** `touch-action: pan-y` (horizontal) / `pan-x` (vertical) — the
  surface owns only the axis the divider travels on, so it never becomes a
  scroll trap.
- **Motion.** Transforms/shadows at `var(--mlv-duration-fast)` with
  `--mlv-ease-out-strong` / `--mlv-ease-default`;
  `@include mixins.reduced-motion($block)`.
- **Theming surface** (custom properties declared on the host):

| Property                          | Default                                                               |
| --------------------------------- | --------------------------------------------------------------------- |
| `--mlv-compare-radius`            | `var(--mlv-radius-l)`                                                 |
| `--mlv-compare-divider-width`     | `0.125rem`                                                            |
| `--mlv-compare-divider-color`     | `var(--mlv-palette-neutral-50)`                                       |
| `--mlv-compare-handle-size`       | `2.5rem`                                                              |
| `--mlv-compare-handle-radius`     | `var(--mlv-radius-full)`                                              |
| `--mlv-compare-handle-background` | `var(--mlv-background-base)`                                          |
| `--mlv-compare-handle-color`      | `var(--mlv-text-primary)`                                             |
| `--mlv-compare-handle-shadow`     | `var(--mlv-shadow-floating)`                                          |
| `--mlv-compare-glyph-size`        | `1.25rem`                                                             |
| `--mlv-compare-halo`              | `color-mix(in srgb, var(--mlv-palette-neutral-950) 16%, transparent)` |
| `--mlv-compare-label-inset`       | `var(--mlv-spacing-3)`                                                |
| `--mlv-compare-label-radius`      | `var(--mlv-radius-full)`                                              |
| `--mlv-compare-label-background`  | `color-mix(in srgb, var(--mlv-palette-neutral-950) 55%, transparent)` |
| `--mlv-compare-label-color`       | `var(--mlv-palette-neutral-50)`                                       |

`--mlv-compare-value` is **written by the component** (host style binding) and
read by the stylesheet; consumers may read it but must not set it.

## Usage

```html
<mlv-compare [(value)]="position" beforeLabel="Before" afterLabel="After" ariaLabel="Colour grade, before and after">
  <img mlvCompareBefore src="raw.jpg" alt="Untouched photograph" />
  <img mlvCompareAfter src="graded.jpg" alt="Colour-graded photograph" />
</mlv-compare>

<!-- Vertical, hover-steered reveal with a custom handle glyph -->
<mlv-compare orientation="vertical" slideOnHover [value]="0" ariaLabelledby="chart-title" style="block-size: 20rem">
  <canvas mlvCompareBefore role="img" aria-label="Actuals"></canvas>
  <canvas mlvCompareAfter role="img" aria-label="Plan"></canvas>
  <ng-template mlvCompareHandleDef let-dragging="dragging">
    <svg lucideMoveVertical [size]="20" [class.spread]="dragging" />
  </ng-template>
</mlv-compare>
```

```ts
import { MlvCompare, MlvCompareHandleDef } from '@malva-ui/core/compare';

@Component({ imports: [MlvCompare, MlvCompareHandleDef] })
```

## Dependencies

- `@angular/cdk/coercion` — `BooleanInput`, `coerceBooleanProperty`
- `@angular/cdk/keycodes` — arrow-key constants
- `@angular/common` — `NgTemplateOutlet` (handle template)
- `@lucide/angular` — `LucideChevronsLeftRight`, `LucideChevronsUpDown` (default glyphs)
- `@malva-ui/cdk/utils` — `clamp`, `MlvRtlService`, `MlvStructural`
- `@malva-ui/i18n` — `MLV_COMPARE_I18N` (`compare.ariaLabel`, shipped in all 14 locale packs)
- Malva UI CSS design tokens (`--mlv-*`)

## Tests

`compare.spec.ts` (42 specs): axe runs (`axe-core`, the jsdom-evaluable ARIA /
focus / label rules) in both orientations, with captions and with a projected
handle template; default rendering of the hidden range
(`type`, `min`/`max`, `step="any"`, value, `aria-valuetext`,
`aria-orientation`, `--mlv-compare-value`); label precedence
(`ariaLabelledby` › `ariaLabel` › i18n fallback); `beforeLabel` /
`afterLabel` captions rendered inside their own layer only while set (and the
compiled corner-pinning rules, incl. the vertical block-end swap); default Lucide glyph per
orientation (`lucide-chevrons-left-right` / `lucide-chevrons-up-down`);
out-of-range clamping without write-back; orientation class + attribute;
pointer press/drag/release with one `getBoundingClientRect` per drag,
non-primary buttons ignored, two-decimal rounding + integer ARIA value,
drag end on `pointercancel` / `lostpointercapture`, a drag whose
`setPointerCapture` threw still following and ending from window-level events,
a second `pointerdown` during a drag ignored (neither hijacking nor ending it),
RTL inline-end mapping, vertical block-axis mapping, focus moves to the input
on press; hover steering only with `slideOnHover` (+ attribute coercion) with
the move listener alive only between `pointerenter` and `pointerleave`; the
compiled `clip-path` polarity (inline-end factor in the right slot, inline-start
in the left); the full keyboard
model with `preventDefault`, edge clamping, `step`, RTL mirroring and vertical
mapping; native `input` sync; content projection (before/after), the
`*mlvCompareHandleDef` template with its `orientation` / `dragging` context
tracking a press and release, and two-way `[(value)]` through a host
component; and compiled-stylesheet assertions via `stripCssLayersFromText`
(direction-signed `clip-path`, vertical `clip-path`, the handle centred on the
divider through `translate`, Form A focus ring routed through `:has()`,
per-axis `touch-action`, pointer-transparent layers, reduced-motion and
forced-colors blocks, no `--mlv-padding-*` misuse).

Docs: `apps/docs/src/app/pages/compare/examples/5/index.spec.ts` pins the
canvas example's `viewChild('surface', { read: ElementRef })` — the
`#surface` ref sits on `<mlv-compare>`, so without `read` it resolves to the
component instance and `MlvResizeObserverService.observe()` throws
`parameter 1 is not of type 'Element'` inside the observable's subscribe. The
spec swaps in a recording observer service and asserts the observed target is
the `<mlv-compare>` element.
