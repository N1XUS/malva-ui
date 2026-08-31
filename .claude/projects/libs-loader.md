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

| Tone      | Color token                 |
| --------- | --------------------------- |
| `default` | `--mlv-background-accent-1` |
| `success` | `--mlv-status-positive`     |
| `info`    | `--mlv-status-info`         |
| `warning` | `--mlv-status-warning`      |
| `danger`  | `--mlv-status-negative`     |

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
