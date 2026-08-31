---
# Library: skeleton

> **Keep this file up to date.** Whenever this library's components, directives, services, or public API change, update this document.

## Overview

`@malva-ui/core/skeleton` provides a skeleton loader component (`mlv-skeleton`) used as a visual placeholder while content is loading. It renders a pulsing shimmer animation that communicates the shape of the incoming content before it arrives. Three shape variants are available: `rectangle` (default), `text` (pill, mimics a line of text), and `circle` (for avatar/icon placeholders). Width and height are applied directly on the host element via inline styles. The component is always `aria-hidden="true"` — it carries no semantic meaning for assistive technology. The shimmer animation is automatically disabled when the user has enabled `prefers-reduced-motion`.

Package import path: `@malva-ui/core/skeleton`

---

## Public API

| Export               | Kind       | Description                                                                                      |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------ |
| `MlvSkeleton`        | Component  | Pulsing placeholder element (`mlv-skeleton`) with configurable shape, dimensions, and animation. |
| `MlvSkeletonVariant` | Type alias | `'text'                                                                                          | 'circle' | 'rectangle'` — the visual shape of the skeleton. |

---

## Components

### `MlvSkeleton`

**File:** `libs/core/skeleton/src/lib/skeleton/skeleton.ts`

| Property           | Value                                                              |
| ------------------ | ------------------------------------------------------------------ |
| Selector           | `mlv-skeleton`                                                     |
| Change Detection   | `OnPush`                                                           |
| View Encapsulation | `None`                                                             |
| Template           | Inline — empty string `''` (the host element is the entire visual) |
| Styles             | `skeleton.scss`                                                    |

#### Inputs

| Input               | Type                                  | Default       | Description                                                                                                                                                                                            |
| ------------------- | ------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `variant`           | `MlvSkeletonVariant`                  | `'rectangle'` | Visual shape. `'rectangle'` is a standard block; `'text'` is a pill-shaped line mimicking text; `'circle'` is fully rounded for avatar/icon placeholders.                                              |
| `width`             | `string`                              | `'100%'`      | CSS width applied inline on the host element. Accepts any valid CSS width value (e.g. `'100%'`, `'12rem'`, `'200px'`).                                                                                 |
| `height`            | `string`                              | `'1rem'`      | CSS height applied inline on the host element. Accepts any valid CSS height value (e.g. `'1rem'`, `'48px'`).                                                                                           |
| `animated`          | `BooleanInput` (coerced to `boolean`) | `true`        | Whether the shimmer animation is active. Set to `false` for a static placeholder (e.g. reduced-motion, or when you want no distraction). Supports attribute syntax: `<mlv-skeleton animated>`.         |
| `animationDuration` | `string`                              | `'2s'`        | CSS duration for the shimmer animation (e.g. `'1s'`, `'0.8s'`). Passed as the `--mlv-skeleton-duration` CSS custom property on the host, controlling the `animation-duration` of the shimmer keyframe. |

#### Outputs

None.

#### Host Bindings

| Binding                           | Value                                                                |
| --------------------------------- | -------------------------------------------------------------------- |
| `class`                           | `'mlv-skeleton'` (static block class)                                |
| `[class]`                         | `'"mlv-skeleton--" + variant()` — applies the variant modifier class |
| `[class.mlv-skeleton--animated]`  | `animated()`                                                         |
| `aria-hidden`                     | `'true'` (static — always hidden from assistive technology)          |
| `[style.width]`                   | `width()`                                                            |
| `[style.height]`                  | `height()`                                                           |
| `[style.--mlv-skeleton-duration]` | `animationDuration()`                                                |

#### Content Projection

None. The component has an empty inline template (`template: ''`). The skeleton is purely a visual host element.

#### SCSS Structure

```
@keyframes mlv-skeleton-shimmer    — animates background-position from 200% → -200% center

.mlv-skeleton                      — block: display:block, background: --mlv-skeleton-base, border-radius --mlv-radius-s
  &--animated                       — shimmer gradient (90deg, base → highlight → base), background-size 400% 100%
                                      animation: mlv-skeleton-shimmer var(--mlv-skeleton-duration, 2s) infinite
                                      @media(prefers-reduced-motion): animation:none, static background
  &--text                           — border-radius: --mlv-radius-xxl (pill), height: 0.875em
  &--circle                         — border-radius: 50%
  &--rectangle                      — border-radius: --mlv-radius-s (same as block default)
```

**Component-scoped CSS variables:**

| Variable                   | Default                              | Purpose                                           |
| -------------------------- | ------------------------------------ | ------------------------------------------------- |
| `--mlv-skeleton-base`      | `var(--mlv-background-neutral-1)`    | Background color of the skeleton body             |
| `--mlv-skeleton-highlight` | `var(--mlv-background-base)`         | Lighter highlight color used in the shimmer sweep |
| `--mlv-skeleton-duration`  | `2s` (via `animationDuration` input) | Controls the shimmer animation speed              |

Both `--mlv-skeleton-base` and `--mlv-skeleton-highlight` can be overridden by the parent context for custom theming.

---

## Interfaces & Types

### `MlvSkeletonVariant`

```ts
export type MlvSkeletonVariant = 'text' | 'circle' | 'rectangle';
```

| Value         | Visual                              | Use case                              |
| ------------- | ----------------------------------- | ------------------------------------- |
| `'rectangle'` | Rectangular block with small radius | Cards, images, generic content blocks |
| `'text'`      | Pill-shaped line (0.875em tall)     | Text lines, labels                    |
| `'circle'`    | Fully round circle                  | Avatars, icon placeholders            |

---

## Usage Examples

### Default rectangle (full-width, 1rem tall)

```html
<mlv-skeleton />
```

### Circle avatar placeholder

```html
<mlv-skeleton variant="circle" width="2.5rem" height="2.5rem" />
```

### Text line placeholder (partial width)

```html
<mlv-skeleton variant="text" width="60%" />
```

### Multiple text line placeholders (simulating a paragraph)

```html
<div style="display: flex; flex-direction: column; gap: 0.5rem;">
  <mlv-skeleton variant="text" width="90%" />
  <mlv-skeleton variant="text" width="80%" />
  <mlv-skeleton variant="text" width="65%" />
</div>
```

### Card skeleton (avatar + text lines)

```html
<div style="display: flex; align-items: center; gap: 1rem; padding: 1rem;">
  <mlv-skeleton variant="circle" width="3rem" height="3rem" />
  <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem;">
    <mlv-skeleton variant="text" width="50%" />
    <mlv-skeleton variant="text" width="80%" />
  </div>
</div>
```

### Static (no animation) placeholder

```html
<mlv-skeleton [animated]="false" width="12rem" height="2rem" />
```

### Faster shimmer animation

```html
<mlv-skeleton animationDuration="1s" />
```

### Conditional rendering (show skeleton while loading)

```html
@if (isLoading()) {
<mlv-skeleton variant="rectangle" width="100%" height="10rem" />
} @else {
<img [src]="imageUrl()" [alt]="imageAlt()" />
}
```

---

## Accessibility

The `mlv-skeleton` component is always `aria-hidden="true"`. It must never be the only content presented to screen reader users — ensure that meaningful content replaces skeletons once loading completes. Consider pairing skeletons with a live region (`aria-live="polite"`) on the container that announces loading state changes.

The shimmer animation is automatically suppressed when the user has enabled the `prefers-reduced-motion` media query — the component falls back to a static colored background.

---

## Dependencies

### Angular / third-party

- `@angular/core`
- `@angular/cdk/coercion` (`BooleanInput`, `coerceBooleanProperty`)

### Internal

- `@malva-ui/styles` (SCSS mixins and CSS design tokens referenced in `skeleton.scss`)
