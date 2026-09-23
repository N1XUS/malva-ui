---
# Library: badge

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Badge library (`@malva-ui/core/badge`) provides a compact `mlv-badge` element component for displaying short status labels, counts, category tags, and other inline metadata. It uses the new design system color tokens — `--mlv-color-*` for solid fills and `--mlv-color-*-muted-*-surface` / `--mlv-color-*-muted-*-text` for soft tinted modes — and integrates with the Malva UI density system via `MlvDensityDirective`.

---

## Public API

Exported from `libs/core/badge/src/index.ts`:

| Export                 | Kind      | Description                                                                 |
| ---------------------- | --------- | --------------------------------------------------------------------------- |
| `MlvBadge`             | Component | `mlv-badge` — projects content, applies tone and muted styling              |
| `MlvBadgeTone`         | Type      | `MlvTone \| 'default' \| 'primary' \| 'secondary' \| 'accent'`              |
| `MlvBadgeIcon`         | Directive | `[mlvBadgeIcon]` — marks the projected icon slot; `position` picks the side |
| `MlvBadgeIconPosition` | Type      | `'start' \| 'end'`                                                          |

---

## Components

### `MlvBadge`

**File:** `libs/core/badge/src/lib/badge/badge.ts`
**Selector:** `mlv-badge` | **Change Detection:** `OnPush` | **Encapsulation:** `None`

#### Inputs

| Name                               | Type                      | Default     | Description                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tone`                             | `MlvBadgeTone`            | `'default'` | Semantic tone. Solid: the semantic fill + paired label (see _Tone Token Mapping_). Muted: `--mlv-muted-{tone}-bg-2` / `-text-2`.                                                                                                |
| `muted`                            | `BooleanInput`            | `false`     | When true, uses muted tint tokens instead of solid fill. Supports attribute syntax: `<mlv-badge muted>`.                                                                                                                        |
| `rounded`                          | `BooleanInput`            | `false`     | **Deprecated since 0.1.10, removed in 1.0.** No-op with no replacement input: badges are always pill-shaped (`--mlv-radius-full`); kept only so `[rounded]` bindings compile. Override `border-radius` on `.mlv-badge` instead. |
| `mlvDensity` _(via hostDirective)_ | `MlvDensity \| undefined` | —           | Explicit density override; falls back to `MlvDensityService`.                                                                                                                                                                   |

#### Host Bindings

```ts
host: {
  class: 'mlv-badge',
  '[class]': '"mlv-badge--tone-" + tone()',
  '[class.mlv-badge--muted]': 'muted()',
  '[class.mlv-badge--with-icon]': '!!_iconRef()',
}
```

#### Content Children (protected)

| Name       | Directive      | Description                                                                                                                                        |
| ---------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_iconRef` | `MlvBadgeIcon` | Presence-only — drives `mlv-badge--with-icon`, which is what turns on the label `gap`. Badges without an icon keep their previous spacing exactly. |

#### Density

Uses `MlvDensityDirective` as a `hostDirective` supporting all three levels (`compact`, `comfortable`, `spacious`). Provides `MLV_DENSITY_ELEMENT = 'badge'`.

CSS density classes applied: `mlv-badge--compact`, `mlv-badge--comfortable`, `mlv-badge--spacious`.

Density scales `padding-block` and `padding-inline` using the `density-scale()` SCSS mixin.

#### Content Projection

```html
<ng-content select="[mlvBadgeIcon]" /> <ng-content />
```

Everything that is not marked `mlvBadgeIcon` lands in the default slot — text, numbers, or unmarked icons — exactly as before. The icon slot comes first in the template, so a projected icon is always the badge's first DOM child; `position="end"` moves it visually with CSS `order` rather than a second projection point.

---

## Directives

### `MlvBadgeIcon`

**File:** `libs/core/badge/src/lib/badge-icon.ts`
**Selector:** `[mlvBadgeIcon]`

Marks a projected element as the badge's icon slot.

| Name       | Type                   | Default   | Description                                                                        |
| ---------- | ---------------------- | --------- | ---------------------------------------------------------------------------------- |
| `position` | `MlvBadgeIconPosition` | `'start'` | `'end'` adds `mlv-badge__icon--end` (CSS `order: 1`), rendering it after the label |

```ts
host: {
  class: 'mlv-badge__icon',
  '[class.mlv-badge__icon--end]': "position() === 'end'",
  'aria-hidden': 'true',
}
```

The icon is decorative by default — a badge normally repeats its meaning in the label. When the icon is the badge's only content, put an accessible name on the badge itself.

Sizing is `width: var(--mlv-badge-icon-size); height: var(--mlv-badge-icon-size)`, which overrides the intrinsic `width`/`height` attributes an icon set ships with (`24px` for a Lucide default).

---

## Usage Examples

```html
<!-- Solid color variants -->
<mlv-badge tone="success">Active</mlv-badge>
<mlv-badge tone="danger">Error</mlv-badge>
<mlv-badge tone="primary">New</mlv-badge>

<!-- Muted (soft tint) -->
<mlv-badge tone="warning" muted>Pending</mlv-badge>
<mlv-badge tone="info" muted>Queued</mlv-badge>

<!-- Dynamic binding -->
<mlv-badge [tone]="task.statusTone" [muted]="useMuted">{{ task.status }}</mlv-badge>

<!-- Density override -->
<mlv-badge tone="primary" mlvDensity="compact">New</mlv-badge>

<!-- Leading icon -->
<mlv-badge tone="success" muted>
  <svg lucideCheck mlvBadgeIcon />
  Published
</mlv-badge>

<!-- Trailing icon -->
<mlv-badge tone="info">
  Syncing
  <svg lucideRefreshCw mlvBadgeIcon position="end" />
</mlv-badge>
```

---

## CSS Custom Properties

| Property                | Default                           | Description                                                                                            |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--mlv-badge-bg`        | `var(--mlv-background-neutral-1)` | Badge background; overridden by tone modifier                                                          |
| `--mlv-badge-color`     | `var(--mlv-text-primary)`         | Badge text color; overridden by tone modifier                                                          |
| `--mlv-badge-gap`       | `0.25rem`                         | Gap between the icon slot and the label; scaled per density, applied only under `mlv-badge--with-icon` |
| `--mlv-badge-icon-size` | `1em`                             | Icon slot width/height; `em` so it tracks the density-driven font size                                 |

---

## Tone Token Mapping

| `tone`      | Solid background             | Solid text                       | Muted background           | Muted text                   |
| ----------- | ---------------------------- | -------------------------------- | -------------------------- | ---------------------------- |
| `default`   | `--mlv-background-neutral-1` | `--mlv-text-primary`             | `--mlv-muted-default-bg-2` | `--mlv-muted-default-text-2` |
| `primary`   | `--mlv-background-accent-1`  | `--mlv-text-primary-on-accent-1` | `--mlv-muted-primary-bg-2` | `--mlv-muted-primary-text-2` |
| `secondary` | `--mlv-background-neutral-1` | `--mlv-text-action`              | `--mlv-muted-{tone}-bg-2`  | `--mlv-muted-{tone}-text-2`  |
| `accent`    | `--mlv-background-accent-2`  | `--mlv-text-primary-on-accent-2` | ″                          | ″                            |
| `success`   | `--mlv-background-success-1` | `--mlv-text-on-success`          | ″                          | ″                            |
| `info`      | `--mlv-background-info-1`    | `--mlv-text-on-info`             | ″                          | ″                            |
| `warning`   | `--mlv-background-warning-1` | `--mlv-text-on-warning`          | ″                          | ″                            |
| `danger`    | `--mlv-background-danger-1`  | `--mlv-text-on-danger`           | ″                          | ″                            |

- Solid tones read the semantic fill + its paired label only — never `--mlv-palette-*` (#302: `success` / `info` read the raw 500 steps under `--mlv-text-inverse`, 2.28 / 2.77:1 in light, and never reached the high-contrast fills).
- Every solid label ≥ 4.5:1 in light, dark and high contrast — `styles:test` → `tone-contrast.spec.mjs`. Density changes size only, never colour.

---

## Dependencies

| Package                 | Version   | Role                                         |
| ----------------------- | --------- | -------------------------------------------- |
| `@angular/core`         | `^22.0.0` | Signals, DI, component                       |
| `@angular/cdk/coercion` | `^22.0.0` | `BooleanInput`, `coerceBooleanProperty`      |
| `@malva-ui/cdk/density` | `*`       | `MlvDensityDirective`, `MLV_DENSITY_ELEMENT` |

---

## File Structure

```
libs/core/badge/src/
  index.ts                         — public API barrel
  lib/
    badge-icon.ts                  — MlvBadgeIcon + MlvBadgeIconPosition
    badge/
      badge.ts                     — MlvBadge
      badge.html                   — icon slot + default slot
      badge.scss                   — BEM styles with density support
      badge.spec.ts                — unit tests (DOM + compiled-SCSS assertions)
```
