---
# Library: action-bar

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Action Bar library (`@malva-ui/core/action-bar`) provides a flexible header/toolbar container that can be fixed, sticky, anchored to the top or bottom of its container/viewport, and rendered either as a full-width bar or a content-width floating pill. An optional `contrast` mode flips the bar to a dark, inverted surface suitable for floating selection toolbars, and built-in enter/leave animations (via Angular's `animate.enter` / `animate.leave`) make the bar slide in and out smoothly whenever it enters or leaves the DOM — which a bar that is permanent chrome turns off with `animated="false"`. Child controls automatically adapt their colors inside a contrast bar.

The bar is an attribute-selector component and uses signal-based inputs throughout, so it can be applied to any semantic element (`<header>`, `<nav>`, `<footer>`, etc.).

The bar is also a **density scope**: `mlvDensity` scales its own box and the rhythm between its controls, and is projected to directive-bearing controls inside it, so one attribute sizes the whole bar.

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

| Name                               | Type                      | Default     | Description                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------- | ------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sticky`                           | `BooleanInput`            | `false`     | Applies `position: sticky` so the bar stays pinned while its scroll container scrolls past it                                                                                                                                                                                                                                                                                                                               |
| `fixed`                            | `BooleanInput`            | `false`     | Applies `position: fixed` (with `z-index: var(--mlv-z-sticky, 200)`) so the bar stays pinned to the viewport. When combined with `shape="pill"`, the bar is auto-centered horizontally                                                                                                                                                                                                                                      |
| `position`                         | `MlvActionBarPosition`    | `'top'`     | Vertical placement of the bar. Acts as the anchor edge when combined with `fixed` or `sticky`, and selects the enter/leave animation direction                                                                                                                                                                                                                                                                              |
| `shape`                            | `MlvActionBarShape`       | `'default'` | Visual shape. `'default'` is a full-width bar with a flush border; `'pill'` is a content-width floating pill with a fully rounded radius and a strong drop shadow                                                                                                                                                                                                                                                           |
| `wrap`                             | `BooleanInput`            | `false`     | Lets the bar's content flow onto further lines once it no longer fits on one, instead of overflowing its container. Off by default so an application navigation bar keeps its single-row geometry and sheds controls through `[mlvActionBarActions]`; turn it on for content-heavy bars (e.g. a workflow toolbar projected into `mlv-page-dock`). Nothing wraps while there is room, so the wide-viewport look is unchanged |
| `mlvDensity` _(via hostDirective)_ | `MlvDensity \| undefined` | —           | Explicit density override for this bar (`'tight' \| 'compact' \| 'comfortable' \| 'spacious' \| 'airy'`). Falls back to the nearest ancestor `MLV_DENSITY_CONTEXT`, then `MlvDensityService`. Scales the bar's padding, the gap between its controls and the `[mlvActionBarLogo]` type ramp, and is re-projected as `MLV_DENSITY_CONTEXT` so controls inside the bar size themselves to match                               |
| `animated`                         | `BooleanInput`            | `true`      | Whether the bar plays its enter / leave animation when it is inserted into or removed from the DOM. Turn it off for a bar that is permanent chrome inside a view the router rebuilds: a repeated view is not a new surface, and a page that renders many bars fades and slides all of them on every arrival. Independent of `prefers-reduced-motion`, which shortens the animation rather than saying there is none         |
| `contrast`                         | `BooleanInput`            | `false`     | Renders the bar on a dark, inverted surface so it stands out from the surrounding content. On the light theme the bar becomes a distinctive near-black surface; on the dark theme it flips to a slightly lighter surface so it still reads as elevated. Child `mlv-button` controls automatically re-tokenize their text/background colors to remain readable                                                               |

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
  '[class.mlv-action-bar--no-animation]': '!animated()',
  'animate.enter': 'mlv-action-bar--enter',
  'animate.leave': 'mlv-action-bar--leave',
}
```

The `animate.enter` / `animate.leave` host attributes are set statically, and they
cannot be anything else: a non-bracketed `host` key is an _attribute_, which
Angular's `parseHostBindings` stores as `literal(value)` — there is no
interpolation and no expression. (`[animate.enter]` is a different feature
entirely: it compiles to `ɵɵanimateEnterListener`, which _calls_ the value as an
animation callback instead of reading classes off it.)

Angular applies them whenever the element enters or leaves the DOM — **including
the first render of a view the router rebuilds**, not only an `@if` toggle. A bar
declared unconditionally inside a routed view therefore animates on every
arrival, and a page that renders several of them animates all of them at once.
That is what `animated="false"` is for: the enter / leave classes still arrive,
and `.mlv-action-bar--no-animation` cancels the keyframes in CSS.

It cancels the **transition** too, and that half is not decoration. On the frame
after it adds the class, Angular asks the element how long to wait; with no
running animation it falls back to the _computed styles_ —
`animation-duration`, then `transition-duration`. The bar declares a 0.1s colour
transition, so cancelling only the keyframes leaves a non-zero answer: the enter
class then stays on the host indefinitely with its `animationstart` /
`transitionstart` listeners retained (measured in Chromium: still present two
frames after a routed navigation), and a leaving bar sits in the DOM for
`duration + 50ms` waiting for a `transitionend` that never comes. With both at
zero Angular finds nothing to wait for, strips the class and releases the
listeners on the next frame. The colour transition is back the moment the class
is gone, and could not have been mid-flight anyway — the element had just
entered.

#### Density

Uses `MlvDensityDirective` as a `hostDirective` (all five levels), provides
`MLV_DENSITY_ELEMENT = 'action-bar'` — so the resolved level lands on the host
as `mlv-action-bar--<density>` — and `provideMlvDensityContext(MlvDensityDirective)`,
which republishes that resolved level as `MLV_DENSITY_CONTEXT` for everything
declared inside the bar. A `<header mlvActionBar mlvDensity="tight">` therefore
shrinks its own box **and** the `mlvButton`s / `mlv-select`s projected into it,
with no per-control attribute.

The scale (comfortable is the shipped default and is unchanged):

| Step          | Bar padding                 | Control gap                    | Pill padding (block / inline start · end)     | Logo font / gap                |
| ------------- | --------------------------- | ------------------------------ | --------------------------------------------- | ------------------------------ |
| `tight`       | `--mlv-spacing-1` (0.25rem) | `--mlv-spacing-0-5` (0.125rem) | `0-5` / `1-5` · `1` (0.125 / 0.375 · 0.25rem) | `font-size-s` / `spacing-1`    |
| `compact`     | `--mlv-spacing-2` (0.5rem)  | inherits comfortable (0.25rem) | `1` / `2` · `1-5` (0.25 / 0.5 · 0.375rem)     | `font-size-m` / `spacing-1-5`  |
| `comfortable` | `--mlv-spacing-3` (0.75rem) | `--mlv-spacing-1` (0.25rem)    | `1-5` / `3` · `2` (0.375 / 0.75 · 0.5rem)     | `font-size-l` / `spacing-2`    |
| `spacious`    | `--mlv-spacing-4` (1rem)    | `--mlv-spacing-2` (0.5rem)     | `2` / `4` · `3` (0.5 / 1 · 0.75rem)           | `font-size-xl` / `spacing-2-5` |
| `airy`        | `--mlv-spacing-5` (1.25rem) | `--mlv-spacing-3` (0.75rem)    | `3` / `5` · `4` (0.75 / 1.25 · 1rem)          | `font-size-2xl` / `spacing-3`  |

Notes on the implementation, each of which a spec pins
(`action-bar-styles.spec.ts`, `action-bar-logo-density.spec.ts`):

- **Gap is shape-agnostic**, declared once on `.mlv-action-bar`; the pill no
  longer declares a `gap` of its own (its old value was identical to the base).
  `compact` deliberately reuses comfortable's 0.25rem — already the floor at
  which neighbouring controls stay separable — and distinguishes itself through
  box padding.
- **Padding is per-shape, and the two sets are disjoint by _source order_.**
  Both land at `(0,2,0)`, and `padding-block` / `padding-inline` cascade against
  the `padding` shorthand as one declaration per side, so the pill's rules —
  emitted after the default-shape ones — replace all four sides. Moving the pill
  block above the default block would flatten the pill, which is why the order
  itself is asserted. (These rules previously carried a
  `:not(.mlv-action-bar--shape-pill)` justified as outranking the pill's
  "(0,1,0) single-class rule". That was never true — the pill's rules are
  `(0,2,0)` as well — and ablating the `:not()` in Chromium across both shapes
  and all five steps moved no pixel, while it did cost the bar's own padding a
  specificity step against a consumer override.)
- **The logo's density comes from the bar as two custom properties**,
  `--mlv-action-bar-logo-gap` and `--mlv-action-bar-logo-font-size`, declared in
  the bar's own density blocks and read by `.mlv-action-bar__logo` with the
  comfortable values as `var()` fallbacks. The logo may **not** include the
  `density.density-*` mixins itself: it carries no density modifier of its own,
  so only the mixins' _ancestor_ branch can reach it — and that branch is
  anchored on any density-modified ancestor, not on the bar. All four branches
  matched the logo at `(0,3,0)` and source order picked the winner (airy >
  spacious > compact > tight), so a `tight` bar inside a `spacious` region
  rendered an 18px logo and inside an `airy` one a 20px logo. A custom property
  inherits from the nearest declaring ancestor instead, which is the bar, and
  nests correctly. The bar itself was never affected: it always carries its own
  stamped modifier, so every disagreeing ancestor branch is excluded by the
  mixin's `:not()`.
- WCAG 2.2 SC 2.5.8 (24×24 target size) is held by the controls inside the bar,
  which carry their own tight-density floor and receive this bar's density
  through the context; the bar itself is not a pointer target. The one control
  the bar owns is `[mlvActionBarLogo]`, typically an `<a>` and therefore a
  pointer target with no padding of its own — it holds a **density-invariant**
  `min-block-size` / `min-inline-size` of `1.5rem`, so `tight`'s 0.75rem type
  cannot take a text-only logo under the floor. It does not change the bar's
  height, whose other content is already at least that tall at every step.
- A **region-only** density (an ancestor `mlv--compact` class with no matching
  service value or `mlvDensity` input) cannot be read from JS, so the bar
  resolves `comfortable` and stamps `mlv-action-bar--comfortable`. That modifier
  excludes the region's ancestor branch on the bar, and — since the logo ramp is
  published by the bar — on the logo too, so the whole bar renders comfortable
  rather than splitting between the two. Note this is _not_ a general cascade
  block: any descendant that carries no density modifier and does include the
  mixins directly is still reached by the region. This is the density library's
  documented limitation, shared with `form[mlvForm]` and `mlv-tile`; pass
  `mlvDensity` explicitly in that case.
- A consumer that writes a static `mlvDensity="…"` **and** imports the
  standalone `MlvDensityDirective` in the same component ends up with two
  directive instances on the bar's host — the host directive and the
  template-matched one — each running an `effect()` that writes the same class.
  Harmless duplicate work, and the resolved density is identical; the import is
  simply unnecessary on a `[mlvActionBar]`.

##### Breaking

`mlvDensity` on `[mlvActionBar]` used to be inert, and the bar ignored the
ambient density entirely. It no longer does. See
[docs/migrations/2026-09-action-bar-density.md](../../docs/migrations/2026-09-action-bar-density.md).

#### Styles Summary

- Flexbox layout, center aligned, full width by default; `padding: var(--mlv-spacing-3)` and `gap: var(--mlv-spacing-1)` at comfortable, both density-scaled (see _Density_ above)
- Component-scoped CSS variables for theming: `--mlv-action-bar-bg`, `--mlv-action-bar-fg`, `--mlv-action-bar-border`, `--mlv-action-bar-shadow`, plus `--mlv-action-bar-translate-x` which composes X centering through the enter/leave keyframes
- `--mlv-action-bar-logo-gap` / `--mlv-action-bar-logo-font-size`: the logo type ramp, declared on the bar per density and read by `.mlv-action-bar__logo` — see _Density_ above for why the logo cannot resolve it itself. Overridable per bar
- `backdrop-filter: blur(1.25rem)` on the default shape for a glassy translucent surface
- `--mlv-action-bar--pos-top`: anchors to top (`top: 0`, `inset-inline: 0`), keeps `border-bottom`
- `--mlv-action-bar--pos-bottom`: anchors to bottom (`bottom: 0`, `inset-inline: 0`), swaps to `border-top`
- `--mlv-action-bar--fixed`: `position: fixed` with `z-index: var(--mlv-z-sticky, 200)`
- `--mlv-action-bar--sticky`: `position: sticky`
- `--mlv-action-bar--wrap`: `flex-wrap: wrap` — the base `gap` already supplies the row spacing
- `--mlv-action-bar--shape-pill`: content-width, `max-width: calc(100% - 2rem)`, `padding-block: var(--mlv-spacing-1-5)` + `padding-inline: var(--mlv-spacing-3) var(--mlv-spacing-2)` (**logical** — the leading side holds the label and the trailing side a control, so the asymmetry mirrors in RTL; this replaced a physical four-value shorthand that did not), `border-radius: var(--mlv-radius-full)`, strong two-layer drop shadow, no backdrop filter. Inherits the bar's shape-agnostic `gap`
- `.mlv-action-bar--shape-pill.mlv-action-bar--fixed`: sets `--mlv-action-bar-translate-x: -50%` and uses `left: 50%; right: auto; transform: translateX(-50%)` for automatic horizontal centering — the one **physical** pair in the stylesheet, because a `left: 50%` + `translateX(-50%)` pair is already direction-agnostic and converting one half would offset the pill by half its width in RTL (`right: auto` releases the position modifier's `inset-inline: 0`); `pos-top` anchors to `top: var(--mlv-spacing-3)` and `pos-bottom` to `bottom: var(--mlv-spacing-4)`
- `--mlv-action-bar--contrast`: overrides the CSS variables to render a near-black surface on the light theme (`--mlv-palette-neutral-800` at 62%) and a slightly lighter elevated surface on the dark theme (`--mlv-palette-neutral-700` at 68% under `[mlvTheme='dark']`). Button tokens are re-targeted inside a contrast bar so transparent buttons stay readable and primary buttons flip to an inverse color pair
- `--mlv-action-bar--no-animation`: `animation: none` **and `transition: none`** on the enter and leave classes, the `animated="false"` opt-out. Both are load-bearing — Angular falls back to the computed `transition-duration` when no animation runs, so cancelling only the keyframes would leave the enter class and its listeners on the host for good (see _Animation_ above). Emitted **after** the `--pos-bottom` animation rules, because the two pairs are both (0,2,0) and a bottom-anchored bar carries all three classes at once
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

- `display: flex; align-items: center`
- `font-weight: 500`, `text-decoration: none; color: var(--mlv-text-primary)`
- `gap: var(--mlv-action-bar-logo-gap, var(--mlv-spacing-2))` and `font-size: var(--mlv-action-bar-logo-font-size, var(--mlv-font-size-l))`. Both follow the enclosing bar's density, because the **bar** declares those two custom properties per density step — see `MlvActionBar` → _Density_. The logo carries no density modifier of its own, so it deliberately includes **no** `density.density-*` mixin: their ancestor branch is anchored on any density-modified ancestor rather than on the bar, so all four branches match the logo at equal specificity and source order picks the winner. The `var()` fallbacks are the comfortable values, so a logo rendered outside a bar still looks right
- `min-block-size` / `min-inline-size: 1.5rem`, **density-invariant** — WCAG 2.2 SC 2.5.8. A logo on an `<a>` is a pointer target with no padding of its own, and `tight` takes its type to 0.75rem, so without the floor a text-only logo would fall under 24×24

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

#### Styles

**File:** `libs/core/action-bar/src/lib/action-bar/components/action-bar-spacer.scss`

- `display: inline-flex; flex-grow: 1` — fills all available horizontal space, pushing sibling elements to the right
- Nothing to scale per density: the spacer paints no box of its own, and the separation it produces is the bar's `gap`, which is density-scaled on the bar
- Deliberately a `styleUrl`, not an inline `styles: []` array. `libs/styles/src/lib/layers.spec.mjs` walks `.css` / `.scss` files only, so an inline rule is structurally invisible to the layer guard and ships **unlayered** — and an unlayered library rule outranks every layered one, so a consumer's own `@layer mlv.components { .mlv-action-bar__spacer { flex-grow: 0 } }` could never win

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

### Compact bar (e.g. a per-example toolbar)

```html
<header mlvActionBar mlvDensity="tight" aria-label="Example controls">
  <span mlvActionBarLogo>Preview</span>
  <div mlvActionBarSpacer></div>
  <!-- No per-control attribute: the buttons resolve MLV_DENSITY_CONTEXT from the bar. -->
  <button mlvButton variant="transparent">Code</button>
  <button mlvButton variant="transparent">Copy</button>
</header>
```

The `@if` guard is what makes the bar enter and leave the DOM _repeatedly_, which is what the `animate.enter` / `animate.leave` attributes on the host are for. An unconditional bar still animates its first render — and re-animates whenever the view around it is rebuilt, which for a routed view is every navigation — so a bar that is permanent chrome should say `animated="false"`.

---

## Dependencies

- `@angular/core` ^22.0.0
- `@angular/cdk/coercion` — `BooleanInput`, `coerceBooleanProperty`
- `@malva-ui/cdk/density` — `MlvDensityDirective`, `MLV_DENSITY_ELEMENT`, `provideMlvDensityContext`
- Malva UI CSS design tokens (`--mlv-*`)
