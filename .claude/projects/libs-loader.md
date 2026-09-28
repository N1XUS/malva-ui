---
# Library: loader

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Loader library (`@malva-ui/core/loader`) provides a progress indicator component with two visual variants (bar and circle). Supports determinate (percentage) and indeterminate (animated) states. Fully accessible with ARIA `progressbar` role.

## Public API

Exported from `libs/core/loader/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvLoader` | Component | Progress indicator — `mlv-loader` |
| `MlvLoaderVariant` | Type | `'bar' \| 'circle'` |
| `MlvLoaderTone` | Type | `MlvTone \| 'default'` (`'info' \| 'success' \| 'warning' \| 'danger' \| 'default'`) |

---

## Components

### `MlvLoader`

**File:** `libs/core/loader/src/lib/loader/loader.ts`
**Styles:** `libs/core/loader/src/lib/loader/loader.scss`

- **Selector:** `mlv-loader`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`

#### Inputs

| Name            | Type                  | Default     | Description                                                                                             |
| --------------- | --------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `variant`       | `MlvLoaderVariant`    | `'bar'`     | Visual variant                                                                                          |
| `tone`          | `MlvLoaderTone`       | `'default'` | Semantic tone                                                                                           |
| `value`         | `number`              | `0`         | Current progress value                                                                                  |
| `max`           | `number`              | `100`       | Maximum progress value                                                                                  |
| `indeterminate` | `boolean`             | `false`     | Animated indeterminate mode                                                                             |
| `size`          | `number \| undefined` | `undefined` | Pixel size override (bar defaults to `4`, circle defaults to `48`)                                      |
| `strokeWidth`   | `number`              | `4`         | Stroke width in pixels (circle variant)                                                                 |
| `ariaLabel`     | `string`              | `'Loading'` | Accessible label                                                                                        |
| `showHint`      | `boolean`             | `false`     | Show percentage hint (bar: above track; circle: centred inside ring). Only visible in determinate mode. |
| `color`         | `string \| undefined` | `undefined` | Custom color override for `--mlv-l-color`; takes precedence over `tone`.                                |
| `trackColor`    | `string \| undefined` | `undefined` | Track color override for `--mlv-l-track-color`, both variants (bar `background`, circle `stroke`).      |
| `glow`          | `boolean`             | `false`     | Shimmer sweep over the filled bar. Determinate `'bar'` only; ignored when `indeterminate`.              |

#### Host Bindings

```ts
host: {
  class: 'mlv-loader',
  '[class]': '_hostClasses()',
  role: 'progressbar',
  '[style.--mlv-l-progress]': '_determinate() && _progressVisible() ? _percentage() / 100 : null',
  '[style.--mlv-l-diameter]': '_normalizedSize() + "px"',
  '[style.--mlv-l-stroke-width]': 'strokeWidth() + "px"',
  '[style.--mlv-l-color]': 'color() || null',
  '[style.--mlv-l-track-color]': 'trackColor() || null',
  '[attr.aria-valuenow]': '_determinate() ? value() : null',
  '[attr.aria-valuemin]': '_determinate() ? 0 : null',
  '[attr.aria-valuemax]': '_determinate() ? max() : null',
  '[attr.aria-label]': '_resolvedAriaLabel()',
}
```

#### Computed Signals (protected)

| Signal               | Description                                                                  |
| -------------------- | ---------------------------------------------------------------------------- |
| `_determinate`       | `!indeterminate()`                                                           |
| `_percentage`        | `(value / max) * 100`, clamped 0–100                                         |
| `_normalizedSize`    | `size` or the variant default (bar `4`, circle `48`)                         |
| `_resolvedAriaLabel` | `ariaLabel` or the i18n `loading` string                                     |
| `_hintText`          | Rounded percentage, `'NN%'`                                                  |
| `_showHint`          | `showHint() && _determinate()`                                               |
| `_hostClasses`       | `mlv-loader--{variant}`, `--{tone}`, plus `--indeterminate` / `--glow` flags |
| `_progressVisible`   | Truthy one tick after construction, gating the fill transition's first frame |

#### Template Summary

- **`'bar'`**: Optional `.mlv-loader__hint` span (above track when `showHint`), then `.mlv-loader__track` > `.mlv-loader__bar`.
- **`'circle'`**: `.mlv-loader__circle-wrapper` containing the SVG (track + fill circles); optional `.mlv-loader__hint` span centered inside via absolute positioning.

#### Tone Colors (via CSS custom property `--mlv-l-color`)

| Tone      | Color token                  |
| --------- | ---------------------------- |
| `default` | `--mlv-background-accent-1`  |
| `success` | `--mlv-background-success-1` |
| `info`    | `--mlv-background-info-1`    |
| `warning` | `--mlv-background-warning-1` |
| `danger`  | `--mlv-background-danger-1`  |

- Semantic fills only, never `--mlv-palette-*` (#302: `success` / `info` read the raw 500 steps, 2.09 / 2.54:1 on the light track).
- Track: `var(--mlv-l-track-color, var(--mlv-background-subtle))` on both variants (bar `background`, circle `stroke`). `trackColor` writes `--mlv-l-track-color`; before #303 the bar ignored it. A bar paints it as a background (a colour or gradient), a circle as a stroke (a colour or `url('#paintServerId')`) — the same split `color` already has.
- Each tone clears 3:1 against the default track in light, dark, high contrast and high contrast over dark — `styles:test` → `tone-contrast.spec.mjs`. The track used to be `--mlv-border-subtle`: same colour in light / dark, but `#999` in high contrast, which put `success` / `warning` / `danger` at 2.54 / 2.78 / 2.07:1 (#303).
- Not `--mlv-background-neutral-1`: `mlv-page-shell` remaps that in its chrome slots, where a track would follow the chrome (1.08:1 on a brand chrome). The spec fails if any component stylesheet redeclares a token the fill-vs-track score reads.

#### Bar Animations

- **Determinate:** `width` transition on `.mlv-loader__bar` (`--mlv-duration-normal`).
- **Glow** (`glow`, determinate only): `.mlv-loader__bar::after` sheen, `mlv-loader-bar-shimmer` (1.8s loop).
- **Indeterminate:** Material MDC two-segment sweep on `.mlv-loader__track::before` / `::after` — `mlv-loader-bar-{primary,secondary}-{translate,scale}` (3s loop, secondary delayed 1.725s); `.mlv-loader__bar` hidden.

#### Circle Animations

- **Determinate:** `stroke-dashoffset` transition on `.mlv-loader__circle-fill--filled` (enabled via `_progressVisible` after one tick).
- **Indeterminate:** `mlv-loader-circle-rotate` on the SVG + `mlv-loader-circle-dash` on the fill (both 4s loops).

#### RTL (#367)

- Bar sweep and glow sheen run toward **inline-end**: right → left under any `[dir="rtl"]` ancestor, a scoped one inside an LTR document included.
  - Segments anchored with `inset-inline-start: 0`; `transform-origin: calc(50% - 50% * var(--mlv-inline-direction)) center`.
  - Every `translate` keyframe goes through `mixins.inline-distance()`; the sign resolves on the pseudo-element (inherited from its element), so a scoped `[dir]` mirrors. LTR keyframe values unchanged.
  - Before #367: physical `left: 0` / `transform-origin: left center` / bare `translate` — RTL swept left → right, against the fill.
- Circle does **not** mirror: rotation reads like a clock face (`.claude/rules/rtl.md`, time glyphs), and the determinate arc starts at 12 o'clock and fills clockwise in both directions.
- No physical inline value left in `loader.scss`; the glow's symmetric `90deg` gradient carries a `// physical:` comment.

#### Reduced motion (#367)

- `mixins.reduced-motion($block)` selects elements only (`.mlv-loader *`, `[class^='mlv-loader__']`), never a descendant's `::before` / `::after` — so the bar sweep and glow kept running. What it does reach it only shortens, ending on the un-animated frame (the circle collapsed to an empty ring).
- Local `@media (prefers-reduced-motion: reduce)` block, same selectors as the animating rules (equal specificity, later order), gives each part a static state:
  - Indeterminate bar: `::before` held at a centred segment — `inset-inline-start: 30%`, `width: 40%` (30–70% of the track). Detached from inline-start, so not readable as a determinate value; centred, so identical in LTR / RTL. `::after` hidden.
  - Indeterminate circle: SVG and fill `animation: none`; fill a static quarter arc centred on 12 o'clock (`stroke-dashoffset: 0.75 × circumference`, `rotate(-135deg)`).
  - Glow: sheen hidden (`display: none`); the determinate fill carries the value.
- ARIA unchanged: indeterminate stays `role="progressbar"` with no `aria-valuenow`.
- Pinned by `loader-styles.spec.ts` (compiled CSS through `stripCssLayersFromText()`): every animated selector owes a same-selector reduced-motion override; static geometry; no physical inline value; keyframes mirror at `-1` and match the pre-#367 values at `1`.

---

## Usage Examples

```html
<!-- Bar progress -->
<mlv-loader variant="bar" [value]="progress()" [max]="100" />

<!-- Bar with hint above track -->
<mlv-loader variant="bar" [value]="75" [showHint]="true" />

<!-- Indeterminate circle -->
<mlv-loader variant="circle" [indeterminate]="true" [size]="64" ariaLabel="Loading data" />

<!-- Circle with centered percentage hint -->
<mlv-loader variant="circle" [value]="60" [showHint]="true" [size]="80" />

<!-- Status-based -->
<mlv-loader variant="bar" tone="success" [value]="100" />
<mlv-loader variant="bar" tone="danger" [indeterminate]="true" />

<!-- Large circle -->
<mlv-loader variant="circle" [size]="120" [strokeWidth]="6" [value]="75" />
```

---

## Dependencies

- `@angular/core`
- `rxjs` — `of`, `delay` for `_progressVisible` signal
