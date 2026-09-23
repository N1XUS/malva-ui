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

#### Host Bindings

```ts
host: {
  'role': 'progressbar',
  'class': 'mlv-loader',
  '[class]': 'hostClasses()',
  '[attr.aria-valuenow]': 'determinate() ? value() : null',
  '[attr.aria-valuemin]': 'determinate() ? 0 : null',
  '[attr.aria-valuemax]': 'determinate() ? max() : null',
  '[attr.aria-label]': 'ariaLabel()',
}
```

#### Computed Signals

| Signal        | Description                                 |
| ------------- | ------------------------------------------- |
| `determinate` | `!indeterminate()`                          |
| `percentage`  | `(value / max) * 100`, clamped 0–100        |
| `center`      | `size / 2` — SVG circle center              |
| `radius`      | `(size - strokeWidth) / 2`                  |
| `viewBox`     | `'0 0 {size} {size}'`                       |
| `dashArray`   | `'{percentage} 100'` — SVG stroke-dasharray |

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

- **Indeterminate only:** `loader-bar-indeterminate` (left→right sweep, 2s loop)
- No shimmer on determinate bar mode.

#### Circle Animations

- **Determinate:** smooth `stroke-dasharray` transition (enabled via `_progressVisible` signal after one tick)
- **Indeterminate:** `loader-circle-rotate` (full rotation 2s) + `loader-circle-dash`/`loader-circle-spin` (alternating, 3s)

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
