---
name: libs-progress
description: Documentation for the @malva-ui/core/progress library — determinate linear and circular progress bar
type: project
---

# Library: progress

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library.

## Overview

The Progress library (`@malva-ui/core/progress`) provides a standalone determinate progress indicator component — distinct from `mlv-loader` (which handles indeterminate/loading states).

**Features:**

- Linear `bar` and circular `circle` shape variants
- Determinate only — requires a `value` (0–100)
- Size variants: `s`, `m` (default), `l`
- Semantic tone variants: `default`, `success`, `warning`, `danger`, `info`
- Optional percentage display centered inside circle or beside bar
- Label slot via `ng-content`
- SVG `stroke-dashoffset` animation for the circle variant
- Fully accessible: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`

## Public API

Exported from `libs/core/progress/src/index.ts`:

| Export             | Kind      | Description                                                                          |
| ------------------ | --------- | ------------------------------------------------------------------------------------ |
| `MlvProgress`      | Component | `mlv-progress` — the main component                                                  |
| `MlvProgressShape` | Type      | `'bar' \| 'circle'`                                                                  |
| `MlvProgressSize`  | Type      | `'s' \| 'm' \| 'l'`                                                                  |
| `MlvProgressTone`  | Type      | `MlvTone \| 'default'` (`'info' \| 'success' \| 'warning' \| 'danger' \| 'default'`) |

## Component: `MlvProgress` (`mlv-progress`)

### Inputs

| Input            | Type               | Default      | Description                            |
| ---------------- | ------------------ | ------------ | -------------------------------------- |
| `value`          | `number`           | — (required) | Progress value, clamped to 0–100       |
| `shape`          | `MlvProgressShape` | `'bar'`      | Linear bar or circular ring            |
| `size`           | `MlvProgressSize`  | `'m'`        | Size variant                           |
| `tone`           | `MlvProgressTone`  | `'default'`  | Semantic tone                          |
| `showPercentage` | `BooleanInput`     | `false`      | Whether to show the numeric percentage |
| `ariaLabel`      | `string`           | `'Progress'` | Accessible label for the progressbar   |

### Host

- `role="progressbar"`
- `[attr.aria-valuenow]="value()"`
- `[attr.aria-valuemin]="0"`, `[attr.aria-valuemax]="100"`
- `[attr.aria-label]="ariaLabel()"`
- BEM classes: `mlv-progress`, `mlv-progress--bar/circle`, `mlv-progress--s/m/l`, `mlv-progress--default/success/warning/danger/info`

## SCSS / BEM

Block: `mlv-progress`

| Class                                   | Description                                      |
| --------------------------------------- | ------------------------------------------------ |
| `.mlv-progress`                         | Host element                                     |
| `.mlv-progress__track`                  | Bar: outer track div                             |
| `.mlv-progress__fill`                   | Bar: inner fill div, `width` driven by `value()` |
| `.mlv-progress__svg`                    | Circle: SVG element                              |
| `.mlv-progress__circle-bg`              | Circle: background stroke                        |
| `.mlv-progress__circle-fill`            | Circle: animated foreground stroke               |
| `.mlv-progress__percentage`             | Percentage text (inside circle or beside bar)    |
| `.mlv-progress__label`                  | `ng-content` label slot                          |
| `--bar` modifier                        | Linear bar layout                                |
| `--circle` modifier                     | Circular SVG ring                                |
| `--s/m/l`                               | Size variants                                    |
| `--default/success/warning/danger/info` | Tone color variants                              |

Tone colors map to the semantic solid fills `--mlv-background-{success,warning,danger,info}-1` (`default` → `--mlv-background-accent-1`) — never a `--mlv-palette-*` step, so the high-contrast theme reaches them. The bar track and the circle track paint `--mlv-background-subtle`, and each tone clears 3:1 against it in light, dark, high contrast and high contrast over dark (`styles:test` → `tone-contrast.spec.mjs`, #302 / #303). The track used to be `--mlv-border-subtle`: same colour in light / dark, but `#999` in high contrast, which put `success` / `warning` / `danger` at 2.54 / 2.78 / 2.07:1. It is not `--mlv-background-neutral-1`, which `mlv-page-shell` remaps inside its chrome slots (1.08:1 fill vs track on a brand chrome); the spec fails if any component stylesheet redeclares a token the fill-vs-track score reads.

## Dependencies

- `@malva-ui/styles` — all `--mlv-*` CSS custom properties

## Notes

- **Not** a replacement for `mlv-loader` — use `mlv-loader` for indeterminate loading spinners/bars.
- The circle SVG uses `stroke-dasharray` = circumference, `stroke-dashoffset` = circumference × (1 - value/100).
- Percentage display for circle is centered as an absolutely-positioned span over the SVG.
