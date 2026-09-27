---
# Library: divider

> **Keep this file up to date.** Whenever this library's components, directives, services, or public API change, update this document.

## Overview

`@malva-ui/core/divider` provides a thin separator line component (`mlv-divider`) for visually dividing sections of content. It supports horizontal and vertical orientations, optional projected label content that splits the line into two flanking segments and names the separator for assistive technology, a dashed stroke variant, and a muted color variant.

Package import path: `@malva-ui/core/divider`

---

## Public API

| Export                  | Kind       | Description                                                              |
| ----------------------- | ---------- | ------------------------------------------------------------------------ |
| `MlvDivider`            | Component  | Renders a separator line (`mlv-divider`) with optional label projection. |
| `MlvDividerOrientation` | Type alias | `'horizontal' \| 'vertical'` — controls the direction of the line.       |

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

| Input            | Type                                  | Default        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orientation`    | `MlvDividerOrientation`               | `'horizontal'` | Sets the axis of the separator. `'horizontal'` renders a full-width horizontal rule; `'vertical'` renders a full-height vertical rule (requires the parent to have a defined height).                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `dashed`         | `BooleanInput` (coerced to `boolean`) | `false`        | Renders the separator as a dashed stroke instead of solid. Supports attribute syntax: `<mlv-divider dashed>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `muted`          | `BooleanInput` (coerced to `boolean`) | `false`        | Uses the subtle border color token (`--mlv-border-subtle`) instead of the default `--mlv-border-normal`. Supports attribute syntax: `<mlv-divider muted>`.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `ariaLabel`      | `string \| null \| undefined`         | `undefined`    | Explicit name, written to the host as `aria-label` while it has non-whitespace text; wins over the projected label (no `aria-labelledby` onto the wrapper). The **bound** form of a name — translated string, per-row value. Clearing it restores a static `aria-label`, or removes the attribute. Loses to `ariaLabelledBy` / a static `aria-labelledby` (accname order). Declared by #332, but not a new binding: `[ariaLabel]` compiled before as an unchecked DOM property (ARIA reflection, client only); the input now type-checks it (a non-string fails TS2322) and renders it on the server. |
| `ariaLabelledBy` | `string \| null \| undefined`         | `undefined`    | Space-separated ids naming the separator, written as `aria-labelledby` in place of the wrapper; outranks every other name source. The **bound** form of a reference — per-row heading id in `@for`, a changing value. Blank or unset: static `aria-labelledby`, then `ariaLabel`, then the label. Added by #332.                                                                                                                                                                                                                                                                                      |

#### Outputs

None.

#### Host Bindings

| Binding                           | Value                                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                           | `'mlv-divider'` (static block class)                                                                                                                                                                                |
| `role`                            | `'separator'` (static ARIA role)                                                                                                                                                                                    |
| `[class.mlv-divider--vertical]`   | `orientation() === 'vertical'`                                                                                                                                                                                      |
| `[class.mlv-divider--horizontal]` | `orientation() === 'horizontal'`                                                                                                                                                                                    |
| `[class.mlv-divider--dashed]`     | `dashed()`                                                                                                                                                                                                          |
| `[class.mlv-divider--muted]`      | `muted()`                                                                                                                                                                                                           |
| `[attr.aria-orientation]`         | `orientation()`                                                                                                                                                                                                     |
| `[attr.aria-labelledby]`          | `_labelledBy()` — `ariaLabelledBy`, else the consumer's static `aria-labelledby`, else `null` while `ariaLabel` or a static `aria-label` names the separator, else the label wrapper's id (`mlv-divider-label-<n>`) |

`aria-label` has **no** host binding: `ariaLabel` is written by a constructor `effect()` through `Renderer2`, and only once it has text. A host `[attr.aria-label]` would write `null` on the first render and win that render's tie against a consumer's own `[attr.aria-label]`, unnaming a bare divider named that way for good (measured; `divider.spec.ts` pins it). `effect()`, not `afterRenderEffect()`, so the attribute is in the server payload (`ssr-smoke.spec.ts`).

#### Content Projection

The template is one `<ng-content />` inside the `.mlv-divider__label` wrapper. Projected content (e.g. a text label "OR") appears between two flanking line segments. When nothing is projected the wrapper is `:empty`, so the two `::before` / `::after` pseudo-elements meet in a single continuous line. When the wrapper has content it is spaced from the segments — horizontal `margin-inline: var(--mlv-spacing-2)` (0.5rem), vertical `margin-block: var(--mlv-spacing-1)` (0.25rem). The spacing keys on the wrapper, never on the host: the wrapper is always rendered, so the host is never `:empty`.

The wrapper is one flex item, so a label made of several nodes (an icon and text, text and `<strong>`) flows as one inline run. Before #332 each projected node was its own flex item with the gap between each.

#### Accessibility (#332)

- The host **is** the separator: static `role="separator"` plus `aria-orientation`. No `<hr>` is rendered.
- `role="separator"` takes its name from the author only and its children are presentational — Chromium exposes a separator to platform APIs as a leaf (`AXNode::IsLeaf`, `kSplitter`), Firefox prunes one whose only child is a text leaf (`nsAccUtils::MustPrune`). So a plain text label ("OR") was announced in neither engine. Firefox does expose content of more than one node — `Today, <strong>12 May</strong>`, a projected `<button>` — as children (measured in review, Firefox 146).
- A projected label therefore **names** the separator: the host points `aria-labelledby` at the wrapper. Measured natively (Chromium CDP `getFullAXTree`, Firefox BiDi accessibility locator): `<mlv-divider>OR</mlv-divider>` is a separator named "OR"; a bare divider stays unnamed.
- The wrapper is `aria-hidden="true"`. `aria-labelledby` still reads a hidden node it references directly (accname step 2A); left visible, Chromium's tree also carries the text as a StaticText child of the separator.
- `aria-labelledby` is emitted on every self-labelled divider, bare ones included: an empty reference yields no name and accname falls through to `aria-label` (both engines). A label that arrives, changes or empties later is followed by the browser — no script reads the DOM.
- Consumer naming, static: a static `aria-labelledby` is kept (read through `HostAttributeToken`; the host binding writes it back instead of the wrapper id); a static `aria-label` suppresses the divider's `aria-labelledby`, so the consumer's wording stays the name. Neither allocates a wrapper id. A static attribute does **not** feed the same-named input (`aria-label` ≠ `ariaLabel`, measured), which is why the token is still read.
- Consumer naming, bound: `[ariaLabel]` / `[ariaLabelledBy]` (above). Measured natively (Chromium 145 CDP, Firefox 146 BiDi) on the rendered markup: both land on the first render, follow changes, per-row `[ariaLabelledBy]` in `@for` names each row, and clearing either falls back. What a bare attribute binding does now:
  - `[attr.aria-label]` / `[aria-label]`: names a **bare** divider (the empty wrapper reference falls through to it), loses to any label with text.
  - `[attr.aria-labelledby]`: the host binding wins the first render's tie, so the consumer's value lands only once it changes and a constant one never does — a bare divider is then unnamed, a labelled one named by its label.
  - Never combine `[attr.aria-label]` with `[ariaLabel]` on one divider: clearing `ariaLabel` removes the attribute, the bound `[attr.aria-label]` included, until that binding's value changes.
- `createComponent(…, { hostElement })` root host: `HostAttributeToken` is always `null` there, so the attributes the host came with are not read and a projected label wins over them; name it through `setInput('ariaLabel' | 'ariaLabelledBy', …)`. Clearing `ariaLabel` on such a host then removes the attribute (there is no static value to restore).
- Hydration residual: a divider the server named through `ariaLabel` keeps that `aria-label` when the client's `ariaLabel` resolves blank from its first render — the effect removes only an attribute it wrote itself. Seeding that from `ngh` is not safe: hydration re-writes a consumer's `[attr.aria-label]` first, and a seeded effect would remove it. Nothing in the repo renders a server-only `ariaLabel`.
- Content is a label, phrasing only. Never project a link or button. Chromium never exposed a separator's children; Firefox exposed any content of more than one node, focusable controls included. Inside the `aria-hidden` wrapper that content is hidden in both engines while a control stays focusable — a regression for Firefox users (a focus stop announcing nothing, WCAG 4.1.2) and an axe `aria-hidden-focus` violation. Move the control out of the divider.
- No axe rule asks a separator for a name, so the sweep cannot see a missing one; `divider.spec.ts` § _accessible name_ and § _naming inputs_ assert the resolved name, and `ssr-smoke.spec.ts` pins the label reference and an `ariaLabel` name in the server payload.

#### Template Summary

```html
<span class="mlv-divider__label" [attr.id]="_labelId" aria-hidden="true"><ng-content /></span>
```

The two line segments are produced by the `::before` and `::after` CSS pseudo-elements on the host element; the wrapper is the only element the template creates.

#### SCSS Structure

```
.mlv-divider                  — block: flex container, applies CSS variables
  &::before, &::after          — line segments (flex: 1, use --mlv-divider-color / --mlv-divider-style)
  &__label                     — label wrapper (aria-hidden, aria-labelledby target); spaced only while :not(:empty)
  &--horizontal                — flex-direction: row; width: 100%; > __label:not(:empty) margin-inline
  &--vertical                  — flex-direction: column; align-self: stretch; > __label:not(:empty) margin-block
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

### Divider named by a bound string

```html
<!-- translated, or richer than the visible label -->
<mlv-divider [ariaLabel]="signInOptionsLabel()">OR</mlv-divider>

<!-- per row -->
@for (section of sections(); track section.id) {
<h3 [id]="'section-' + section.id">{{ section.title }}</h3>
<mlv-divider [ariaLabelledBy]="'section-' + section.id" />
}
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

- `@angular/core` (`HostAttributeToken` for the consumer's static `aria-label` / `aria-labelledby`; `effect` + `Renderer2` for the `ariaLabel` write)
- `@angular/cdk/coercion` (`BooleanInput`, `coerceBooleanProperty`)

### Internal

- `@malva-ui/cdk/utils` (`mlvNextId` for the label wrapper id)
- `@malva-ui/styles` (SCSS mixins and CSS design tokens referenced in `divider.scss`)
