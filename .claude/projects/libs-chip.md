---
# Library: chip

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Chip library (`@malva-ui/core/chip`) provides an interactive `mlv-chip` element component for representing tags, filters, and selected items. It extends the badge concept with richer functionality: prepend/append slot directives, a closable mode (renders a `LucideX` close button), a floating (elevated-shadow) variant, and full density system integration.

## Public API

Exported from `libs/core/chip/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvChip` | Component | `mlv-chip` — projects content, applies tone, muted, floating, and closable styling |
| `MlvChipTone` | Type | `MlvTone \| 'default' \| 'primary' \| 'secondary' \| 'accent'` |
| `MlvChipPrepend` | Directive | Template slot rendered before chip label — `[mlvChipPrepend]` |
| `MlvChipAppend` | Directive | Template slot rendered after chip label — `[mlvChipAppend]` |

---

## Components

### `MlvChip`

**File:** `libs/core/chip/src/lib/chip/chip.ts`
**Selector:** `mlv-chip` | **Change Detection:** `OnPush` | **Encapsulation:** `None`

#### Inputs

| Name                               | Type                      | Default     | Description                                                                                                                                                                                                                         |
| ---------------------------------- | ------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tone`                             | `MlvChipTone`             | `'default'` | Semantic tone. Solid: the same semantic fill + paired label map as `mlv-badge` (`libs-badge.md` § Tone Token Mapping; #302 moved `success` / `info` off the raw palette). Muted: `--mlv-muted-{tone}-bg-2` / `-text-2`.             |
| `muted`                            | `BooleanInput`            | `false`     | Uses muted tint tokens instead of solid fill. Supports attribute syntax: `<mlv-chip muted>`.                                                                                                                                        |
| `floating`                         | `BooleanInput`            | `false`     | Renders an elevated box-shadow (like button's `elevated` variant). Supports attribute syntax.                                                                                                                                       |
| `closable`                         | `BooleanInput`            | `false`     | Shows a `LucideX` close button after all content (`currentColor` at 0.85 opacity, 1 on hover — ≥ 3.7:1 on every solid tone in every theme, #302). Supports attribute syntax.                                                        |
| `chipTabIndex`                     | `number`                  | `0`         | Tabindex for the chip host. Set to `-1` when a parent (e.g. tokenizer) manages focus via `FocusKeyManager`.                                                                                                                         |
| `closeAriaLabel`                   | `string \| null`          | `null`      | Overrides the close button's `aria-label`. When `null`, falls back to the generic i18n `MLV_CHIP_I18N.remove` ("Remove"). Set to a descriptive value (e.g. `"Remove: Angular"`) so the label names the specific item being removed. |
| `mlvDensity` _(via hostDirective)_ | `MlvDensity \| undefined` | —           | Explicit density override; falls back to `MlvDensityService`.                                                                                                                                                                       |

#### Outputs

| Name        | Type                     | Description                                                                              |
| ----------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| `chipClose` | `OutputEmitterRef<void>` | Emits when the user clicks the close button. Event propagation is stopped automatically. |

#### Host Bindings

```ts
host: {
  class: 'mlv-chip',
  '[class]': '"mlv-chip--tone-" + tone()',
  '[class.mlv-chip--muted]': 'muted()',
  '[class.mlv-chip--floating]': 'floating()',
  '[class.mlv-chip--closable]': 'closable()',
}
```

#### Density

Uses `MlvDensityDirective` as a `hostDirective`. Provides `MLV_DENSITY_ELEMENT = 'chip'`.

CSS density classes applied via `density-scale()` mixin — scales `padding-block` and `padding-inline`.

#### Content Projection

- `<ng-content />` — main chip label text
- `<ng-template mlvChipPrepend>` — content rendered before the label
- `<ng-template mlvChipAppend>` — content rendered after the label (before the close button)

---

## Directives

Both defined in `libs/core/chip/src/lib/chip/chip.directives.ts`. Both extend `MlvStructural` from `@malva-ui/core/form-utils`.

| Directive        | Selector           | Purpose                                                |
| ---------------- | ------------------ | ------------------------------------------------------ |
| `MlvChipPrepend` | `[mlvChipPrepend]` | Marks `<ng-template>` as content before the chip label |
| `MlvChipAppend`  | `[mlvChipAppend]`  | Marks `<ng-template>` as content after the chip label  |

---

## Usage Examples

```html
<!-- Basic tone variants -->
<mlv-chip>Default</mlv-chip>
<mlv-chip tone="success">Active</mlv-chip>
<mlv-chip tone="danger">Error</mlv-chip>

<!-- Muted mode -->
<mlv-chip tone="warning" muted>Pending</mlv-chip>

<!-- Closable -->
<mlv-chip tone="primary" muted closable (chipClose)="removeTag(tag)"> {{ tag }} </mlv-chip>

<!-- Prepend icon -->
<mlv-chip tone="accent">
  <ng-template mlvChipPrepend>
    <svg lucideStar [size]="12" />
  </ng-template>
  Featured
</mlv-chip>

<!-- Append icon -->
<mlv-chip tone="primary">
  Next step
  <ng-template mlvChipAppend>
    <svg lucideArrowRight [size]="12" />
  </ng-template>
</mlv-chip>

<!-- Floating (elevated shadow) -->
<mlv-chip tone="info" floating>
  <ng-template mlvChipPrepend>
    <svg lucideClock [size]="12" />
  </ng-template>
  2 hours ago
</mlv-chip>

<!-- Density override -->
<mlv-chip tone="primary" mlvDensity="compact">Compact</mlv-chip>
<mlv-chip tone="primary" mlvDensity="spacious">Spacious</mlv-chip>
```

---

## Dependencies

| Package                     | Version   | Role                                         |
| --------------------------- | --------- | -------------------------------------------- |
| `@angular/core`             | `^22.0.0` | Signals, DI, component                       |
| `@angular/common`           | `^22.0.0` | `NgTemplateOutlet`                           |
| `@angular/cdk/coercion`     | `^22.0.0` | `BooleanInput`, `coerceBooleanProperty`      |
| `@malva-ui/cdk/density`     | `*`       | `MlvDensityDirective`, `MLV_DENSITY_ELEMENT` |
| `@malva-ui/core/form-utils` | `*`       | `MlvStructural` base class                   |
| `@lucide/angular`           | `*`       | `LucideX` icon for close button              |

---

## File Structure

```
libs/core/chip/src/
  index.ts                         — public API barrel
  lib/
    chip/
      chip.ts                      — MlvChip
      chip.html                    — template
      chip.scss                    — BEM styles with density, tone, muted, floating
      chip.directives.ts           — MlvChipPrepend, MlvChipAppend
```
