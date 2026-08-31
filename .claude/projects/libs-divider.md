---
# Library: divider

> **Keep this file up to date.** Whenever this library's components, directives, services, or public API change, update this document.

## Overview

`@malva-ui/core/divider` provides a thin separator line component (`mlv-divider`) for visually dividing sections of content. It supports horizontal and vertical orientations, optional projected label content that splits the line into two flanking segments, a dashed stroke variant, and a muted color variant.

Package import path: `@malva-ui/core/divider`

---

## Public API

| Export                  | Kind       | Description                                                              |
| ----------------------- | ---------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| `MlvDivider`            | Component  | Renders a separator line (`mlv-divider`) with optional label projection. |
| `MlvDividerOrientation` | Type alias | `'horizontal'                                                            | 'vertical'` — controls the direction of the line. |

---

## Components

### `MlvDivider`

**File:** `libs/core/divider/src/lib/divider/divider.ts`

| Property           | Value          |
| ------------------ | -------------- |
| Selector           | `mlv-divider`  |
| Change Detection   | `OnPush`       |
| View Encapsulation | `None`         |
| Template           | `divider.html` |
| Styles             | `divider.scss` |

#### Inputs

| Input         | Type                                  | Default        | Description                                                                                                                                                                           |
| ------------- | ------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orientation` | `MlvDividerOrientation`               | `'horizontal'` | Sets the axis of the separator. `'horizontal'` renders a full-width horizontal rule; `'vertical'` renders a full-height vertical rule (requires the parent to have a defined height). |
| `dashed`      | `BooleanInput` (coerced to `boolean`) | `false`        | Renders the separator as a dashed stroke instead of solid. Supports attribute syntax: `<mlv-divider dashed>`.                                                                         |
| `muted`       | `BooleanInput` (coerced to `boolean`) | `false`        | Uses the subtle border color token (`--mlv-border-subtle`) instead of the default `--mlv-border-normal`. Supports attribute syntax: `<mlv-divider muted>`.                            |

#### Outputs

None.

#### Host Bindings

| Binding                           | Value                                |
| --------------------------------- | ------------------------------------ |
| `class`                           | `'mlv-divider'` (static block class) |
| `role`                            | `'separator'` (static ARIA role)     |
| `[class.mlv-divider--vertical]`   | `orientation() === 'vertical'`       |
| `[class.mlv-divider--horizontal]` | `orientation() === 'horizontal'`     |
| `[class.mlv-divider--dashed]`     | `dashed()`                           |
| `[class.mlv-divider--muted]`      | `muted()`                            |
| `[attr.aria-orientation]`         | `orientation()`                      |

#### Content Projection

The component template is a single `<ng-content />`. Any projected content (e.g. a text label "OR") appears between two flanking line segments. When no content is projected, the two `::before` / `::after` pseudo-elements merge into a single continuous line. When content is present, a gap is added around it (horizontal: `0.5rem`, vertical: `0.25rem`).

#### Template Summary

```html
<ng-content />
```

The two line segments are produced by the `::before` and `::after` CSS pseudo-elements on the host element (no additional DOM elements are created).

#### SCSS Structure

```
.mlv-divider                  — block: flex container, applies CSS variables
  &::before, &::after          — line segments (flex: 1, use --mlv-divider-color / --mlv-divider-style)
  &--horizontal                — flex-direction: row; width: 100%
  &--vertical                  — flex-direction: column; align-self: stretch
  &--dashed                    — overrides --mlv-divider-style to 'dashed'
  &--muted                     — overrides --mlv-divider-color to --mlv-border-subtle
```

**Component-scoped CSS variables:**

| Variable              | Default                    | Purpose                                                 |
| --------------------- | -------------------------- | ------------------------------------------------------- |
| `--mlv-divider-color` | `var(--mlv-border-normal)` | Color of the line segments                              |
| `--mlv-divider-style` | `solid`                    | Border style of the line segments (`solid` or `dashed`) |

---

## Interfaces & Types

### `MlvDividerOrientation`

```ts
export type MlvDividerOrientation = 'horizontal' | 'vertical';
```

Controls the axis along which the separator line is drawn.

---

## Usage Examples

### Basic horizontal divider (default)

```html
<mlv-divider />
```

### Horizontal divider with centered label

```html
<mlv-divider>OR</mlv-divider>
```

### Vertical divider between inline elements

```html
<div style="display: flex; height: 2rem; align-items: center; gap: 0.5rem;">
  <span>Left</span>
  <mlv-divider orientation="vertical" />
  <span>Right</span>
</div>
```

### Dashed divider

```html
<mlv-divider dashed />
```

### Muted divider

```html
<mlv-divider muted />
```

### Combined: dashed and muted

```html
<mlv-divider dashed muted />
```

### Dynamic binding

```html
<mlv-divider [orientation]="isDividerVertical ? 'vertical' : 'horizontal'" [dashed]="useDashedStyle" [muted]="useSubtleColor" />
```

---

## Dependencies

### Angular / third-party

- `@angular/core`
- `@angular/cdk/coercion` (`BooleanInput`, `coerceBooleanProperty`)

### Internal

- `@malva-ui/styles` (SCSS mixins and CSS design tokens referenced in `divider.scss`)
