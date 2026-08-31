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
| `MlvCardHeaderDef` | Directive | Slot for header content — `[mlvCardHeader]` |
| `MlvCardSubheaderDef` | Directive | Slot for subheader — `[mlvCardSubheader]` |
| `MlvCardActionsDef` | Directive | Slot for action buttons — `[mlvCardActions]` |
| `MlvCardFooterDef` | Directive | Slot for footer — `[mlvCardFooter]` |

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
<div class="mlv-card__header-row">
  @if (headerRef()) { <ng-container [ngTemplateOutlet]="headerRef()!.templateRef" /> } @if (actionsRef()) {
  <div class="mlv-card__actions"><ng-container [ngTemplateOutlet]="..." /></div>
  }
</div>
} @if (subheaderRef()) { <ng-container [ngTemplateOutlet]="subheaderRef()!.templateRef" /> }
<div class="mlv-card__body" [class.mlv-card__body--stack]="bodyLayout() === 'stack'"><ng-content /></div>
@if (footerRef()) {
<div class="mlv-card__footer"><ng-container [ngTemplateOutlet]="footerRef()!.templateRef" /></div>
}
```

#### Size Presets

Radius is fixed at `--mlv-card-radius: var(--mlv-radius-card)` (→ `--mlv-radius-xl`, 12px) for every size — the per-size radius step (`s`→`xl`, `m`→`2xl`, `l`→`3xl`) was removed per RR-R2 (no per-density/per-size radius overrides; a card role has one radius).

| Size | Padding     | Heading font    | Subheading     | Gap       |
| ---- | ----------- | --------------- | -------------- | --------- |
| `s`  | `spacing-3` | `font-size-xl`  | `font-size-s`  | Inherited |
| `m`  | `spacing-5` | `font-size-3xl` | `font-size-l`  | Inherited |
| `l`  | `spacing-8` | `font-size-4xl` | `font-size-xl` | Inherited |

#### Styles Summary (`card.scss`)

- Base: `display: flex; flex-direction: column; overflow: hidden`
- Background: `var(--mlv-background-elevation-1)`; Shadow: `var(--mlv-shadow-small)`
- Smooth transitions on shadow, background, transform
- Elevated variant: larger shadow, hover → `translateY(-0.125rem)` lift
- Background image variant: `background-size: cover; background-position: center`
- CSS class helpers:
  - `.mlv-card__header-row` — `display: flex; justify-content: space-between`
  - `.mlv-card__heading` — `flex: 1; overflow: hidden; text-overflow: ellipsis`
  - `.mlv-card__actions` — `display: flex; align-items: center; gap: 0.25rem; flex-shrink: 0`
  - `.mlv-card__subheading` — secondary text color, `line-height: 1.5`
  - `.mlv-card__body` — `flex: 1; min-height: 0` (untouched by `bodyLayout="none"`)
  - `.mlv-card__body--stack` — `display: flex; flex-direction: column; gap: var(--mlv-card-body-gap)`; `--mlv-card-body-gap` defaults to `--mlv-spacing-3` and scales with the size preset (`s` → `--mlv-spacing-2`, `m` → `--mlv-spacing-3`, `l` → `--mlv-spacing-4`). Override it per card (`style="--mlv-card-body-gap: 1.5rem"`).
  - `.mlv-card__footer` — `display: flex; align-items: center; border-top; margin-top: auto; gap: 0.5rem`
  - `.mlv-card__footer--full-width > *` — `flex: 1` (equal-width footer items)

---

## Directives

All defined in their own files under `libs/core/card/src/lib/`.

### `MlvCardHeaderDef`

**File:** `libs/core/card/src/lib/card-header-def.ts` | **Selector:** `[mlvCardHeader]`

Provides `templateRef = inject(TemplateRef)`. Used with `<ng-template mlvCardHeader>`.

### `MlvCardSubheaderDef`

**File:** `libs/core/card/src/lib/card-subheader-def.ts` | **Selector:** `[mlvCardSubheader]`

Provides `templateRef = inject(TemplateRef)`. Used with `<ng-template mlvCardSubheader>`.

### `MlvCardActionsDef`

**File:** `libs/core/card/src/lib/card-actions-def.ts` | **Selector:** `[mlvCardActions]`

Provides `templateRef = inject(TemplateRef)`. Renders in the header row, right-aligned.

### `MlvCardFooterDef`

**File:** `libs/core/card/src/lib/card-footer-def.ts` | **Selector:** `[mlvCardFooter]`

Provides `templateRef = inject(TemplateRef)`. Renders at the bottom with a top border separator.

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
  <ng-template mlvCardHeader>
    <h2 class="mlv-card__heading">Card Title</h2>
  </ng-template>
  <ng-template mlvCardActions>
    <button mlvButton shape="square" variant="transparent" size="small">⋯</button>
  </ng-template>
  <ng-template mlvCardSubheader>
    <p class="mlv-card__subheading">A supporting subtitle</p>
  </ng-template>

  <div>Main body content</div>

  <ng-template mlvCardFooter>
    <button mlvButton>Save</button>
    <button mlvButton variant="outlined">Cancel</button>
  </ng-template>
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
