---
# Library: action-bar

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Action Bar library (`@malva-ui/core/action-bar`) provides a flexible header/toolbar container that can be fixed, sticky, anchored to the top or bottom of its container/viewport, and rendered either as a full-width bar or a content-width floating pill. An optional `contrast` mode flips the bar to a dark, inverted surface suitable for floating selection toolbars, and built-in enter/leave animations (via Angular 21's `animate.enter` / `animate.leave`) make the bar slide in and out smoothly whenever it enters or leaves the DOM. Child controls automatically adapt their colors inside a contrast bar.

The bar is an attribute-selector component and uses signal-based inputs throughout, so it can be applied to any semantic element (`<header>`, `<nav>`, `<footer>`, etc.).

## Public API

Exported from `libs/core/action-bar/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvActionBar` | Component | Main container — attribute selector `[mlvActionBar]` |
| `MlvActionBarPosition` | Type alias | `'top' \| 'bottom'` — vertical anchor of the bar |
| `MlvActionBarShape` | Type alias | `'default' \| 'pill'` — visual shape variant |
| `MlvActionBarActions` | Directive | Responsive desktop-actions marker — `[mlvActionBarActions]` |
| `MlvActionBarLogo` | Component | Logo/branding slot — `[mlvActionBarLogo]` |
| `MlvActionBarSpacer` | Component | Flex spacer — `[mlvActionBarSpacer]` |

---

## Components

### `MlvActionBar`

**File:** `libs/core/action-bar/src/lib/action-bar/action-bar.ts`

- **Selector:** `[mlvActionBar]` (attribute)
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Template:** `libs/core/action-bar/src/lib/action-bar/action-bar.html` — `<ng-content></ng-content>`
- **Styles:** `libs/core/action-bar/src/lib/action-bar/action-bar.scss`

#### Inputs

| Name       | Type                   | Default     | Description                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sticky`   | `BooleanInput`         | `false`     | Applies `position: sticky` so the bar stays pinned while its scroll container scrolls past it                                                                                                                                                                                                                                                                                                                               |
| `fixed`    | `BooleanInput`         | `false`     | Applies `position: fixed` (with `z-index: var(--mlv-z-sticky, 200)`) so the bar stays pinned to the viewport. When combined with `shape="pill"`, the bar is auto-centered horizontally                                                                                                                                                                                                                                      |
| `position` | `MlvActionBarPosition` | `'top'`     | Vertical placement of the bar. Acts as the anchor edge when combined with `fixed` or `sticky`, and selects the enter/leave animation direction                                                                                                                                                                                                                                                                              |
| `shape`    | `MlvActionBarShape`    | `'default'` | Visual shape. `'default'` is a full-width bar with a flush border; `'pill'` is a content-width floating pill with a fully rounded radius and a strong drop shadow                                                                                                                                                                                                                                                           |
| `wrap`     | `BooleanInput`         | `false`     | Lets the bar's content flow onto further lines once it no longer fits on one, instead of overflowing its container. Off by default so an application navigation bar keeps its single-row geometry and sheds controls through `[mlvActionBarActions]`; turn it on for content-heavy bars (e.g. a workflow toolbar projected into `mlv-page-dock`). Nothing wraps while there is room, so the wide-viewport look is unchanged |
| `contrast` | `BooleanInput`         | `false`     | Renders the bar on a dark, inverted surface so it stands out from the surrounding content. On the light theme the bar becomes a distinctive near-black surface; on the dark theme it flips to a slightly lighter surface so it still reads as elevated. Child `mlv-button` controls automatically re-tokenize their text/background colors to remain readable                                                               |

#### Host Bindings

```ts
host: {
  class: 'mlv-action-bar',
  '[class.mlv-action-bar--fixed]': 'fixed()',
  '[class.mlv-action-bar--sticky]': 'sticky()',
  '[class.mlv-action-bar--pos-top]': 'position() === "top"',
  '[class.mlv-action-bar--pos-bottom]': 'position() === "bottom"',
  '[class.mlv-action-bar--shape-pill]': 'shape() === "pill"',
  '[class.mlv-action-bar--wrap]': 'wrap()',
  '[class.mlv-action-bar--contrast]': 'contrast()',
  'animate.enter': 'mlv-action-bar--enter',
  'animate.leave': 'mlv-action-bar--leave',
}
```

The `animate.enter` / `animate.leave` host attributes are set statically — Angular only applies them when the element actually enters or leaves the DOM (e.g. when guarded by `@if`). A statically-rendered navigation bar is therefore unaffected.

#### Styles Summary

- Flexbox layout, center aligned, full width by default
- Component-scoped CSS variables for theming: `--mlv-action-bar-bg`, `--mlv-action-bar-fg`, `--mlv-action-bar-border`, `--mlv-action-bar-shadow`, plus `--mlv-action-bar-translate-x` which composes X centering through the enter/leave keyframes
- `backdrop-filter: blur(1.25rem)` on the default shape for a glassy translucent surface
- `--mlv-action-bar--pos-top`: anchors to top (`top: 0`), keeps `border-bottom`
- `--mlv-action-bar--pos-bottom`: anchors to bottom (`bottom: 0`), swaps to `border-top`
- `--mlv-action-bar--fixed`: `position: fixed` with `z-index: var(--mlv-z-sticky, 200)`
- `--mlv-action-bar--sticky`: `position: sticky`
- `--mlv-action-bar--wrap`: `flex-wrap: wrap` — the base `gap` already supplies the row spacing
- `--mlv-action-bar--shape-pill`: content-width, `max-width: calc(100% - 2rem)`, `padding: 0.375rem 0.5rem 0.375rem 0.75rem`, `border-radius: var(--mlv-radius-full)`, strong two-layer drop shadow, no backdrop filter
- `.mlv-action-bar--shape-pill.mlv-action-bar--fixed`: sets `--mlv-action-bar-translate-x: -50%` and uses `left: 50%; transform: translateX(-50%)` for automatic horizontal centering; `pos-top` anchors to `top: var(--mlv-spacing-3)` and `pos-bottom` to `bottom: var(--mlv-spacing-4)`
- `--mlv-action-bar--contrast`: overrides the CSS variables to render a near-black surface on the light theme (`--mlv-palette-neutral-900`) and a slightly lighter elevated surface on the dark theme (`--mlv-palette-neutral-700` under `[mlvTheme='dark']`). Button tokens are re-targeted inside a contrast bar so transparent buttons stay readable and primary buttons flip to an inverse color pair
- Enter/leave keyframes: `mlv-action-bar-enter-top` / `-leave-top` for top-anchored bars slide from `translateY(-0.75rem)`; `mlv-action-bar-enter-bottom` / `-leave-bottom` for bottom-anchored bars slide from `translateY(1.25rem)` with a subtle `scale(0.96)` pop. All keyframes use `translate(var(--mlv-action-bar-translate-x), Yrem)` so pill+fixed bars preserve their horizontal centering throughout the animation
- `@media (prefers-reduced-motion: reduce)` collapses the animation duration to 1ms

#### Types

```ts
export type MlvActionBarPosition = 'top' | 'bottom';
export type MlvActionBarShape = 'default' | 'pill';
```

---

### `MlvActionBarLogo`

**Files:**

- `libs/core/action-bar/src/lib/action-bar/components/action-bar-logo.ts`
- `libs/core/action-bar/src/lib/action-bar/components/action-bar-logo.scss`

- **Selector:** `[mlvActionBarLogo]` (attribute)
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Template:** Inline — `<ng-content />`

#### Host Bindings

```ts
host: { 'class': 'mlv-action-bar__logo' }
```

#### Styles

- `display: flex; align-items: center; gap: 0.25rem`
- `text-decoration: none; color: var(--mlv-text-primary)`
- `font: var(--mlv-typography-heading-h5)`

Inside a `.mlv-action-bar--contrast` bar the logo color is overridden to `var(--mlv-action-bar-fg)` so it remains readable on the dark surface.

Form controls are re-tokenized the same way buttons are: `.mlv-action-bar--contrast .mlv-form-control-wrapper` overrides `--container-background-color` (10% fg over transparent), `--container-border-color` (22% fg), `--container-side-content-color`, and `--container-action-color`, and native `input`/`textarea`/`select` elements get the bar foreground for text/caret with a 55%-fg placeholder — so e.g. `mlv-search-field` in a dark pill navbar renders on a smoky translucent surface instead of its default light elevation background.

---

### `MlvActionBarActions`

**File:** `libs/core/action-bar/src/lib/action-bar/components/action-bar-actions.ts`

- **Selector:** `[mlvActionBarActions]`
- **Host class:** `mlv-action-bar__actions`
- Hides desktop-only navigation controls at the medium breakpoint and below; the responsive rule is owned by `action-bar.scss`.

---

### `MlvActionBarSpacer`

**File:** `libs/core/action-bar/src/lib/action-bar/components/action-bar-spacer.ts`

- **Selector:** `[mlvActionBarSpacer]` (attribute)
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Template:** Inline — `<ng-content />`

#### Host Bindings

```ts
host: { 'class': 'mlv-action-bar__spacer' }
```

#### Styles (inline)

- `display: inline-flex; flex-grow: 1` — fills all available horizontal space, pushing sibling elements to the right

---

## Directives

None.

## Services

None.

---

## Usage Examples

### Default top navigation bar

```html
<header mlvActionBar sticky>
  <a mlvActionBarLogo href="/">
    <img src="logo.svg" alt="Brand" width="32" height="32" />
    Brand Name
  </a>
  <nav mlvActionBarActions aria-label="Primary navigation">
    <a mlvButton variant="transparent" href="/projects">Projects</a>
  </nav>
  <mlv-spacer />
  <button mlvButton variant="transparent">Sign In</button>
</header>
```

### Floating bottom pill (selection toolbar)

```html
@if (selected().size > 0) {
<nav mlvActionBar fixed position="bottom" shape="pill" contrast>
  <span>{{ selected().size }} selected</span>
  <div mlvActionBarSpacer></div>
  <button mlvButton variant="transparent" size="small">Export</button>
  <button mlvButton variant="transparent" size="small">Delete</button>
  <button mlvButton variant="primary" size="small" (click)="clear()" aria-label="Clear">
    <svg lucideX [size]="16" />
  </button>
</nav>
}
```

The `@if` guard is what makes the bar enter and leave the DOM, which in turn triggers Angular's `animate.enter` / `animate.leave` attributes bound on the host. For a bar that should always be present, simply render it unconditionally.

---

## Dependencies

- `@angular/core` ^22.0.0
- `@angular/cdk/coercion` — `BooleanInput`, `coerceBooleanProperty`
- Malva UI CSS design tokens (`--mlv-*`)
