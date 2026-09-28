---
# Library: card

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Card library (`@malva-ui/core/card`) provides a flexible, composable container for displaying grouped content. Supports multiple sizes, elevation levels, and named content sections (header, subheader, actions, footer) via structural directives. Background images are also supported.

## Public API

Exported from `libs/core/card/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvCard` | Component | Main card container — selector `mlv-card` |
| `MlvCardSize` | Type | `'s' \| 'm' \| 'l'` |
| `MlvCardBodyLayout` | Type | `'none' \| 'stack'` — layout applied to `.mlv-card__body` |
| `MlvCardHeaderDef` | Directive | Structural slot for the header — `[mlvCardHeaderDef]` |
| `MlvCardHeader` | Directive | Header host class `mlv-card__header` — `[mlvCardHeader]` |
| `MlvCardSubheaderDef` | Directive | Structural slot for the subheader — `[mlvCardSubheaderDef]` |
| `MlvCardSubheader` | Directive | Subheader host class `mlv-card__subheader` — `[mlvCardSubheader]` |
| `MlvCardActionsDef` | Directive | Structural slot for header-row actions — `[mlvCardActionsDef]` |
| `MlvCardActions` | Directive | Actions host class `mlv-card__actions` — `[mlvCardActions]` |
| `MlvCardFooterDef` | Directive | Structural slot for the footer — `[mlvCardFooterDef]` |
| `MlvCardFooter` | Directive | Footer host class `mlv-card__footer` + `withBorder` / `fullWidth` — `[mlvCardFooter]` |

- Slot = a `…Def` structural directive + its host-class directive on one element: `<h3 *mlvCardHeaderDef mlvCardHeader>`.
- The card queries only the `…Def` (`contentChild(MlvCardHeaderDef)`): `<ng-template mlvCardHeaderDef>` renders, `<ng-template mlvCardHeader>` alone renders nothing.

---

## Components

### `MlvCard`

**File:** `libs/core/card/src/lib/card/card.ts`

- **Selector:** `mlv-card`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Template:** `libs/core/card/src/lib/card/card.html`
- **Styles:** `libs/core/card/src/lib/card/card.scss`
- **Imports:** `NgTemplateOutlet`

#### Inputs

| Name              | Type                | Default  | Description                                                                                                                |
| ----------------- | ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `size`            | `MlvCardSize`       | `'m'`    | Size preset controlling padding and typography (radius is fixed — see Size Presets below)                                  |
| `elevated`        | `BooleanInput`      | `false`  | Larger shadow + hover lift effect                                                                                          |
| `backgroundImage` | `string \| null`    | `null`   | URL for a background image; sets the `--mlv-card-bg-image` CSS variable                                                    |
| `bodyLayout`      | `MlvCardBodyLayout` | `'none'` | `'stack'` turns `.mlv-card__body` into a vertical flex stack separated by `--mlv-card-body-gap`; `'none'` is a plain block |

#### Content Children (protected)

| Name           | Directive             | Description                |
| -------------- | --------------------- | -------------------------- |
| `headerRef`    | `MlvCardHeaderDef`    | Header section template    |
| `subheaderRef` | `MlvCardSubheaderDef` | Subheader section template |
| `actionsRef`   | `MlvCardActionsDef`   | Actions section template   |
| `footerRef`    | `MlvCardFooterDef`    | Footer section template    |

#### Host Bindings

```ts
host: {
  'class': 'mlv-card',
  '[class]': '"mlv-card--size-" + size()',
  '[class.mlv-card--elevated]': 'elevated()',
  '[class.mlv-card--has-bg-image]': '!!backgroundImage()',
  '[style.--mlv-card-bg-image]': 'backgroundImage() ? "url(" + backgroundImage() + ")" : null',
}
```

`bodyLayout` is **not** a host binding — it toggles `mlv-card__body--stack` on the body element inside the template, so only the body is affected and the card block keeps its own layout.

#### Template Structure (`card.html`)

```html
@if (headerRef() || actionsRef()) {
<div class="mlv-card__header-row">@if (headerRef(); as headerTpl) { <ng-container [ngTemplateOutlet]="headerTpl.templateRef" /> } @if (actionsRef(); as actionsTpl) { <ng-container [ngTemplateOutlet]="actionsTpl.templateRef" /> }</div>
} @if (subheaderRef(); as subheaderTpl) { <ng-container [ngTemplateOutlet]="subheaderTpl.templateRef" /> }
<div class="mlv-card__body" [class.mlv-card__body--stack]="bodyLayout() === 'stack'"><ng-content /></div>
@if (footerRef(); as footerTpl) { <ng-container [ngTemplateOutlet]="footerTpl.templateRef" /> }
```

- No wrapper elements around the slots: `mlv-card__header` / `__subheader` / `__actions` / `__footer` (and the footer modifiers) come from the host-class directives on the consumer's own element.

#### Size Presets

Radius is fixed at `--mlv-card-radius: var(--mlv-radius-card)` (→ `--mlv-radius-xl`, 12px) for every size — the per-size radius step (`s`→`xl`, `m`→`2xl`, `l`→`3xl`) was removed per RR-R2 (no per-density/per-size radius overrides; a card role has one radius).

| Size | Padding     | Heading font    | Subheading     | Gap       |
| ---- | ----------- | --------------- | -------------- | --------- |
| `s`  | `spacing-3` | `font-size-xl`  | `font-size-s`  | Inherited |
| `m`  | `spacing-5` | `font-size-3xl` | `font-size-l`  | Inherited |
| `l`  | `spacing-8` | `font-size-4xl` | `font-size-xl` | Inherited |

#### Styles Summary (`card.scss`)

- Base: `display: flex; flex-direction: column; overflow: hidden`
- Background: `var(--mlv-elevation-bg-2)`; Shadow: `var(--mlv-shadow-raised)`; border `0.0625rem solid var(--mlv-border-subtle)`
- Smooth transitions on shadow, background, transform
- Elevated variant: larger shadow, hover → `translateY(-0.125rem)` lift
- Background image variant: `background-size: cover; background-position: center`
- CSS class helpers:
  - `.mlv-card__header-row` — `display: flex; justify-content: space-between`
  - `.mlv-card__header` — `flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`; size-scaled `font-size`
  - `.mlv-card__actions` — `display: flex; align-items: center; gap: 0.25rem; flex-shrink: 0`
  - `.mlv-card__subheader` — secondary text color, `line-height: 1.5`; size-scaled `font-size`
  - `.mlv-card__body` — `flex: 1; min-height: 0` (untouched by `bodyLayout="none"`)
  - `.mlv-card__body--stack` — `display: flex; flex-direction: column; gap: var(--mlv-card-body-gap)`; `--mlv-card-body-gap` defaults to `--mlv-spacing-3` and scales with the size preset (`s` → `--mlv-spacing-2`, `m` → `--mlv-spacing-3`, `l` → `--mlv-spacing-4`). Override it per card (`style="--mlv-card-body-gap: 1.5rem"`).
  - `.mlv-card__footer` — `display: flex; align-items: center; gap: 0.5rem; padding-top: var(--mlv-card-padding); margin-top: auto`. **No border by default.**
  - `.mlv-card__footer--border` (`withBorder`) — `border-block-start: var(--mlv-stroke-width) solid var(--mlv-border-normal)`. Until #369 the stylesheet styled `--with-border`, which nothing emitted, so `withBorder` drew nothing.
    - `--mlv-border-normal`, not `--mlv-border-subtle`: subtle = card fill in dark (1.00:1, invisible). Measured in Chrome vs the card fill: light 1.26:1, dark 1.46:1, HC 5.74:1 (2px). Same token dialog / drawer dividers use.
    - The card's own outline stays `--mlv-border-subtle`.
  - `.mlv-card__footer--full-width > *` (`fullWidth`) — `flex: 1` (equal-width footer items)
- `card.spec.ts` § _emitted classes vs stylesheet_ pins the BEM surface:
  - every `mlv-card…` class the TS emits is styled, every styled one is emitted;
  - the audit host imports **and renders** every component / directive the card barrel exports — a new one (even input-less, e.g. a host-class-only slot directive) fails until the host uses it;
  - the inputs the audit host switches on = every input the card barrel declares (`MlvCard`: `backgroundImage` / `bodyLayout` / `elevated` / `size`; `MlvCardFooter`: `fullWidth` / `withBorder`) — a new input fails until the host covers it;
  - union values (`size`, `bodyLayout`) are listed by hand; a styled value nothing emits still fails the reverse check.

---

## Directives

All defined in their own files under `libs/core/card/src/lib/`.

Each file declares a `…Def` (extends `MlvStructural`, exposes `templateRef`) and a host-class directive.

### `MlvCardHeaderDef` / `MlvCardHeader`

**File:** `libs/core/card/src/lib/card-header-def.ts` | **Selectors:** `[mlvCardHeaderDef]` / `[mlvCardHeader]` (host class `mlv-card__header`)

Rendered first in the header row.

### `MlvCardSubheaderDef` / `MlvCardSubheader`

**File:** `libs/core/card/src/lib/card-subheader-def.ts` | **Selectors:** `[mlvCardSubheaderDef]` / `[mlvCardSubheader]` (host class `mlv-card__subheader`)

Rendered below the header row.

### `MlvCardActionsDef` / `MlvCardActions`

**File:** `libs/core/card/src/lib/card-actions-def.ts` | **Selectors:** `[mlvCardActionsDef]` / `[mlvCardActions]` (host class `mlv-card__actions`)

Rendered in the header row after the header, pushed to the inline end.

### `MlvCardFooterDef` / `MlvCardFooter`

**File:** `libs/core/card/src/lib/card-footer-def.ts` | **Selectors:** `[mlvCardFooterDef]` / `[mlvCardFooter]` (host class `mlv-card__footer`)

Rendered after the body, pushed to the bottom (`margin-top: auto`). No divider unless `withBorder` is set.

#### `MlvCardFooter` Inputs

| Name         | Type           | Default | Description                                                                                                         |
| ------------ | -------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `withBorder` | `BooleanInput` | `false` | Hairline divider on the block-start edge — `mlv-card__footer--border` (`--mlv-stroke-width`, `--mlv-border-normal`) |
| `fullWidth`  | `BooleanInput` | `false` | Direct children share the width equally — `mlv-card__footer--full-width` (`flex: 1` each)                           |

---

## Services

None.

---

## Usage Examples

```html
<!-- Basic card -->
<mlv-card>
  <p>Content here</p>
</mlv-card>

<!-- Card with header, subheader, actions, and footer -->
<mlv-card size="l" [elevated]="true">
  <h2 *mlvCardHeaderDef mlvCardHeader>Card Title</h2>
  <div *mlvCardActionsDef mlvCardActions>
    <button mlvButton shape="square" variant="transparent" aria-label="More actions">⋯</button>
  </div>
  <p *mlvCardSubheaderDef mlvCardSubheader>A supporting subtitle</p>

  <p>Main body content</p>

  <div *mlvCardFooterDef mlvCardFooter withBorder>
    <button mlvButton variant="outlined">Cancel</button>
    <button mlvButton>Save</button>
  </div>
</mlv-card>

<!-- One full-width footer action -->
<mlv-card>
  <p>Access all features with the premium plan.</p>
  <div *mlvCardFooterDef mlvCardFooter fullWidth>
    <button mlvButton>Subscribe</button>
  </div>
</mlv-card>

<!-- Card with background image -->
<mlv-card backgroundImage="/assets/banner.jpg">
  <p>Text over image</p>
</mlv-card>

<!-- Stacked body — no hand-rolled wrapper needed for vertical rhythm -->
<mlv-card bodyLayout="stack">
  <p>Summary line</p>
  <div><mlv-badge tone="success" muted>Healthy</mlv-badge></div>
  <p>Last deployed 12 minutes ago.</p>
</mlv-card>

<!-- Per-card gap override -->
<mlv-card bodyLayout="stack" style="--mlv-card-body-gap: 1.5rem">…</mlv-card>
```

---

## Dependencies

- `@angular/core` ^22.0.0 — signals, `contentChild()`
- `@angular/common` — `NgTemplateOutlet`
- `@angular/cdk/coercion` — `BooleanInput`
- Malva UI CSS design tokens (`--mlv-*`)
