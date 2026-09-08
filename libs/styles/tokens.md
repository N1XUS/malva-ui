<!-- GENERATED FILE — do not edit by hand.
     Regenerate with: yarn nx run styles:generate-tokens -->

# Malva UI design tokens

Every public `--mlv-*` custom property the design system declares — 449 tokens, generated from `libs/styles/src/lib/*.scss`.

**If a token is not in this file, it does not exist.** `var()` silently falls back
when a custom property is undefined, so a misspelled token never errors — it just
renders the fallback and quietly drops out of theming. Check the name here first.

## Commonly mistaken names

Names that look right, resolve to nothing, and ship the fallback.

| Invented name                                          | Use instead                                                                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `--mlv-error-text-1`                                   | `--mlv-text-error (or --mlv-text-negative)`                                                                    |
| `--mlv-muted-text-1`                                   | `--mlv-text-secondary (or --mlv-muted-default-text-1)`                                                         |
| `--mlv-border-1`                                       | `--mlv-border-normal`                                                                                          |
| `--mlv-radius-2`                                       | `--mlv-radius-s … --mlv-radius-3xl (letter scale)`                                                             |
| `--mlv-color-text-secondary`                           | `--mlv-text-secondary`                                                                                         |
| `--mlv-color-border`                                   | `--mlv-border-normal`                                                                                          |
| `--mlv-color-surface`                                  | `--mlv-background-raised`                                                                                      |
| `--mlv-color-secondary`                                | `--mlv-background-neutral-1`                                                                                   |
| `--mlv-color-on-surface`                               | `--mlv-text-primary`                                                                                           |
| `--mlv-background-surface-1`                           | `--mlv-background-raised`                                                                                      |
| `--mlv-background-neutral-0`                           | `--mlv-background-base`                                                                                        |
| `--mlv-background-hover`                               | `--mlv-background-neutral-1-hover`                                                                             |
| `--mlv-background-elevation-1`                         | `--mlv-elevation-bg-1`                                                                                         |
| `--mlv-color-foreground-secondary`                     | `--mlv-text-secondary`                                                                                         |
| `--mlv-border-neutral`                                 | `--mlv-border-normal`                                                                                          |
| `--mlv-danger-500`                                     | `--mlv-palette-danger-500`                                                                                     |
| `--mlv-status-info / -positive / -negative / -warning` | `--mlv-background-{info,success,danger,warning}-1 (fill) or --mlv-text-{info,positive,negative,warning}(text)` |
| `--mlv-shadow-small / -medium / -large / -popup`       | `--mlv-shadow-1 … -5, or --mlv-shadow-raised / -floating / -overlay / -modal`                                  |
| `--mlv-radius-xxl`                                     | `--mlv-radius-3xl (or --mlv-radius-full)`                                                                      |
| `--mlv-duration-s / -m / -l`                           | `--mlv-duration-fast / -normal / -slow`                                                                        |
| `--mlv-easing`                                         | `--mlv-ease-default`                                                                                           |
| `--mlv-font-size-sm`                                   | `--mlv-font-size-s`                                                                                            |
| `--mlv-spacing-sm`                                     | `--mlv-spacing-2`                                                                                              |
| `--mlv-typography-body-m / -body-s / -body-l`          | `--mlv-typography-body-{m,s,l}-size (also -weight, -line-height)`                                              |
| `--mlv-typography-ui-s / -ui-xs / -ui-2xs`             | `--mlv-typography-ui-{l,m,s}-size — there is no ui-xs tier`                                                    |
| `--mlv-typography-label-s`                             | `--mlv-typography-label-size`                                                                                  |
| `--mlv-line-height`                                    | `--mlv-line-height-normal (or a scale-specific -line-height token)`                                            |

## Theme activation

| Selector                               | Mode            |
| -------------------------------------- | --------------- |
| `:root`, `:host`, `[mlvTheme='light']` | Light (default) |
| `[mlvTheme='dark']`                    | Dark            |
| `[data-theme='high-contrast']`         | High contrast   |

`MlvThemeService` (from `@malva-ui/cdk/theme`) sets the `mlvTheme` attribute on
`documentElement`. Tokens with no dark or high-contrast value inherit the light
value in every mode.

## Tokens

### Color palettes

Raw ramps. Prefer a semantic token below; reach for a palette stop only when no semantic token expresses the intent.

| Token                         | Light     |
| ----------------------------- | --------- |
| `--mlv-palette-accent-50`     | `#fff3ee` |
| `--mlv-palette-accent-100`    | `#ffe6d9` |
| `--mlv-palette-accent-200`    | `#ffcbb0` |
| `--mlv-palette-accent-300`    | `#fea882` |
| `--mlv-palette-accent-400`    | `#fd9265` |
| `--mlv-palette-accent-500`    | `#fd774d` |
| `--mlv-palette-accent-600`    | `#f45728` |
| `--mlv-palette-accent-700`    | `#d03e16` |
| `--mlv-palette-accent-800`    | `#a83011` |
| `--mlv-palette-accent-900`    | `#85250e` |
| `--mlv-palette-accent-950`    | `#4a1207` |
| `--mlv-palette-danger-50`     | `#fff1f2` |
| `--mlv-palette-danger-100`    | `#ffe4e6` |
| `--mlv-palette-danger-200`    | `#fecdd3` |
| `--mlv-palette-danger-300`    | `#fda4af` |
| `--mlv-palette-danger-400`    | `#fb7185` |
| `--mlv-palette-danger-500`    | `#f43f5e` |
| `--mlv-palette-danger-600`    | `#e11d48` |
| `--mlv-palette-danger-700`    | `#be123c` |
| `--mlv-palette-danger-800`    | `#9f1239` |
| `--mlv-palette-danger-900`    | `#881337` |
| `--mlv-palette-danger-950`    | `#4c0519` |
| `--mlv-palette-info-50`       | `#f0f9ff` |
| `--mlv-palette-info-100`      | `#e0f2fe` |
| `--mlv-palette-info-200`      | `#bae6fd` |
| `--mlv-palette-info-300`      | `#7dd3fc` |
| `--mlv-palette-info-400`      | `#38bdf8` |
| `--mlv-palette-info-500`      | `#0ea5e9` |
| `--mlv-palette-info-600`      | `#0284c7` |
| `--mlv-palette-info-700`      | `#0369a1` |
| `--mlv-palette-info-800`      | `#075985` |
| `--mlv-palette-info-900`      | `#0c4a6e` |
| `--mlv-palette-info-950`      | `#082f49` |
| `--mlv-palette-neutral-50`    | `#fafafa` |
| `--mlv-palette-neutral-100`   | `#f5f5f5` |
| `--mlv-palette-neutral-200`   | `#e5e5e5` |
| `--mlv-palette-neutral-300`   | `#d4d4d4` |
| `--mlv-palette-neutral-400`   | `#a3a3a3` |
| `--mlv-palette-neutral-500`   | `#737373` |
| `--mlv-palette-neutral-600`   | `#525252` |
| `--mlv-palette-neutral-700`   | `#404040` |
| `--mlv-palette-neutral-800`   | `#262626` |
| `--mlv-palette-neutral-900`   | `#171717` |
| `--mlv-palette-neutral-950`   | `#0a0a0a` |
| `--mlv-palette-primary-50`    | `#eceffc` |
| `--mlv-palette-primary-100`   | `#dbe4f9` |
| `--mlv-palette-primary-200`   | `#bacbf4` |
| `--mlv-palette-primary-300`   | `#90aaeb` |
| `--mlv-palette-primary-400`   | `#6c88dd` |
| `--mlv-palette-primary-500`   | `#5770cb` |
| `--mlv-palette-primary-600`   | `#4359b1` |
| `--mlv-palette-primary-700`   | `#334393` |
| `--mlv-palette-primary-800`   | `#273373` |
| `--mlv-palette-primary-900`   | `#1b2454` |
| `--mlv-palette-primary-950`   | `#111634` |
| `--mlv-palette-secondary-50`  | `#f9f9f9` |
| `--mlv-palette-secondary-100` | `#f3f3f3` |
| `--mlv-palette-secondary-200` | `#ebebeb` |
| `--mlv-palette-secondary-300` | `#d1d1d1` |
| `--mlv-palette-secondary-400` | `#aaaaaa` |
| `--mlv-palette-secondary-500` | `#808080` |
| `--mlv-palette-secondary-600` | `#5e5e5e` |
| `--mlv-palette-secondary-700` | `#3d3d3d` |
| `--mlv-palette-secondary-800` | `#272727` |
| `--mlv-palette-secondary-900` | `#181818` |
| `--mlv-palette-secondary-950` | `#0d0d0d` |
| `--mlv-palette-success-50`    | `#f0fdf4` |
| `--mlv-palette-success-100`   | `#dcfce7` |
| `--mlv-palette-success-200`   | `#bbf7d0` |
| `--mlv-palette-success-300`   | `#86efac` |
| `--mlv-palette-success-400`   | `#4ade80` |
| `--mlv-palette-success-500`   | `#22c55e` |
| `--mlv-palette-success-600`   | `#16a34a` |
| `--mlv-palette-success-700`   | `#15803d` |
| `--mlv-palette-success-800`   | `#166534` |
| `--mlv-palette-success-900`   | `#14532d` |
| `--mlv-palette-success-950`   | `#052e16` |
| `--mlv-palette-warning-50`    | `#fffbeb` |
| `--mlv-palette-warning-100`   | `#fef3c7` |
| `--mlv-palette-warning-200`   | `#fde68a` |
| `--mlv-palette-warning-300`   | `#fcd34d` |
| `--mlv-palette-warning-400`   | `#fbbf24` |
| `--mlv-palette-warning-500`   | `#f59e0b` |
| `--mlv-palette-warning-600`   | `#d97706` |
| `--mlv-palette-warning-700`   | `#b45309` |
| `--mlv-palette-warning-800`   | `#92400e` |
| `--mlv-palette-warning-900`   | `#78350f` |
| `--mlv-palette-warning-950`   | `#451a03` |

### Backgrounds

Surface and fill colors. `-pale` variants are tinted backgrounds for inline status surfaces; the unsuffixed `-1` variants are solid fills that pair with the `--mlv-text-on-*` colors.

| Token                                   | Light                                                                                    | Dark                                                                                     | High contrast                          | Notes        |
| --------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------- | ------------ |
| `--mlv-background-accent-1`             | `var(--mlv-palette-primary-500)`                                                         | `var(--mlv-palette-primary-500)`                                                         | `#0000cc`                              |              |
| `--mlv-background-accent-1-active`      | `color-mix(in srgb, var(--mlv-palette-primary-500) 75%, black)`                          | `color-mix(in srgb, var(--mlv-palette-primary-500) 65%, white)`                          | `#000066`                              |              |
| `--mlv-background-accent-1-hover`       | `color-mix(in srgb, var(--mlv-palette-primary-500) 82%, white)`                          | `color-mix(in srgb, var(--mlv-palette-primary-500) 80%, white)`                          | `#000099`                              |              |
| `--mlv-background-accent-1-pale`        | `color-mix(in srgb, var(--mlv-palette-primary-500) 12%, white)`                          | `color-mix(in srgb, var(--mlv-palette-primary-500) 15%, var(--mlv-palette-neutral-900))` | `#e0e0ff`                              |              |
| `--mlv-background-accent-1-pale-hover`  | `color-mix(in srgb, var(--mlv-palette-primary-500) 20%, white)`                          | `color-mix(in srgb, var(--mlv-palette-primary-500) 25%, var(--mlv-palette-neutral-900))` | `#c8c8ff`                              |              |
| `--mlv-background-accent-2`             | `var(--mlv-palette-accent-500)`                                                          | `var(--mlv-palette-accent-500)`                                                          | `#cc3300`                              |              |
| `--mlv-background-accent-2-active`      | `color-mix(in srgb, var(--mlv-palette-accent-500) 75%, black)`                           | `color-mix(in srgb, var(--mlv-palette-accent-500) 65%, white)`                           | `#881f00`                              |              |
| `--mlv-background-accent-2-hover`       | `color-mix(in srgb, var(--mlv-palette-accent-500) 82%, white)`                           | `color-mix(in srgb, var(--mlv-palette-accent-500) 80%, white)`                           | `#aa2800`                              |              |
| `--mlv-background-accent-2-pale`        | `color-mix(in srgb, var(--mlv-palette-accent-500) 12%, white)`                           | `color-mix(in srgb, var(--mlv-palette-accent-500) 15%, var(--mlv-palette-neutral-900))`  | `#ffe8e0`                              |              |
| `--mlv-background-accent-2-pale-hover`  | `color-mix(in srgb, var(--mlv-palette-accent-500) 20%, white)`                           | `color-mix(in srgb, var(--mlv-palette-accent-500) 25%, var(--mlv-palette-neutral-900))`  | `#ffd0c0`                              |              |
| `--mlv-background-bar`                  | `var(--mlv-background-base)`                                                             | `var(--mlv-background-base)`                                                             | `#ffffff`                              |              |
| `--mlv-background-bar-overlapped`       | `var(--mlv-background-raised)`                                                           | `var(--mlv-background-raised)`                                                           | `#f5f5f5`                              |              |
| `--mlv-background-base`                 | `var(--mlv-palette-neutral-50)`                                                          | `var(--mlv-palette-neutral-900)`                                                         | `#ffffff`                              |              |
| `--mlv-background-chrome`               | `var(--mlv-palette-neutral-100)`                                                         | `var(--mlv-palette-neutral-950)`                                                         | `#000000`                              |              |
| `--mlv-background-danger-1`             | `var(--mlv-palette-danger-600)`                                                          | `var(--mlv-palette-danger-600)`                                                          | `#cc0000`                              |              |
| `--mlv-background-danger-1-active`      | `color-mix(in srgb, var(--mlv-palette-danger-600) 70%, black)`                           | `color-mix(in srgb, var(--mlv-palette-danger-600) 65%, white)`                           | `#660000`                              |              |
| `--mlv-background-danger-1-hover`       | `color-mix(in srgb, var(--mlv-palette-danger-600) 85%, black)`                           | `color-mix(in srgb, var(--mlv-palette-danger-600) 80%, white)`                           | `#990000`                              |              |
| `--mlv-background-danger-1-pale`        | `color-mix(in srgb, var(--mlv-palette-danger-500) 12%, white)`                           | `color-mix(in srgb, var(--mlv-palette-danger-500) 15%, var(--mlv-palette-neutral-900))`  | `#ffe0e0`                              |              |
| `--mlv-background-danger-1-pale-hover`  | `color-mix(in srgb, var(--mlv-palette-danger-500) 20%, white)`                           | `color-mix(in srgb, var(--mlv-palette-danger-500) 25%, var(--mlv-palette-neutral-900))`  | `#ffc8c8`                              |              |
| `--mlv-background-disabled`             | `var(--mlv-palette-neutral-200)`                                                         | `color-mix(in srgb, var(--mlv-palette-neutral-800) 60%, var(--mlv-palette-neutral-900))` | `#d0d0d0`                              |              |
| `--mlv-background-info-1`               | `var(--mlv-palette-info-600)`                                                            | `var(--mlv-palette-info-600)`                                                            | `#003399`                              |              |
| `--mlv-background-info-1-active`        | `color-mix(in srgb, var(--mlv-palette-info-600) 70%, black)`                             | `color-mix(in srgb, var(--mlv-palette-info-600) 65%, white)`                             | `#001155`                              |              |
| `--mlv-background-info-1-hover`         | `color-mix(in srgb, var(--mlv-palette-info-600) 85%, black)`                             | `color-mix(in srgb, var(--mlv-palette-info-600) 80%, white)`                             | `#002277`                              |              |
| `--mlv-background-info-1-pale`          | `color-mix(in srgb, var(--mlv-palette-info-500) 12%, white)`                             | `color-mix(in srgb, var(--mlv-palette-info-500) 15%, var(--mlv-palette-neutral-900))`    | `#e0f0ff`                              |              |
| `--mlv-background-info-1-pale-hover`    | `color-mix(in srgb, var(--mlv-palette-info-500) 20%, white)`                             | `color-mix(in srgb, var(--mlv-palette-info-500) 25%, var(--mlv-palette-neutral-900))`    | `#c0e0ff`                              |              |
| `--mlv-background-info-pale`            | `var(--mlv-background-info-1-pale)`                                                      | `var(--mlv-background-info-1-pale)`                                                      | `var(--mlv-background-info-1-pale)`    | alias        |
| `--mlv-background-neutral-1`            | `var(--mlv-palette-neutral-100)`                                                         | `var(--mlv-palette-neutral-800)`                                                         | `#e8e8e8`                              |              |
| `--mlv-background-neutral-1-active`     | `var(--mlv-palette-neutral-200)`                                                         | `color-mix(in srgb, var(--mlv-palette-neutral-800) 88%, white)`                          | `#b8b8b8`                              |              |
| `--mlv-background-neutral-1-hover`      | `color-mix(in srgb, var(--mlv-palette-neutral-100) 60%, var(--mlv-palette-neutral-200))` | `color-mix(in srgb, var(--mlv-palette-neutral-800) 94%, white)`                          | `#d0d0d0`                              |              |
| `--mlv-background-neutral-2`            | `var(--mlv-palette-neutral-200)`                                                         | `var(--mlv-palette-neutral-700)`                                                         | `#d0d0d0`                              |              |
| `--mlv-background-overlay`              | `rgba(0, 0, 0, 0.22)`                                                                    | —                                                                                        | —                                      |              |
| `--mlv-background-raised`               | `#ffffff`                                                                                | `#1e1e1e`                                                                                | `#ffffff`                              | neutral ~850 |
| `--mlv-background-selected`             | `var(--mlv-background-accent-1-pale)`                                                    | `var(--mlv-background-accent-1-pale)`                                                    | —                                      |              |
| `--mlv-background-selected-hover`       | `var(--mlv-background-accent-1-pale-hover)`                                              | `var(--mlv-background-accent-1-pale-hover)`                                              | —                                      |              |
| `--mlv-background-subtle`               | `var(--mlv-palette-neutral-100)`                                                         | `var(--mlv-palette-neutral-800)`                                                         | `#f5f5f5`                              |              |
| `--mlv-background-success-1`            | `var(--mlv-palette-success-600)`                                                         | `var(--mlv-palette-success-600)`                                                         | `#006600`                              |              |
| `--mlv-background-success-1-active`     | `color-mix(in srgb, var(--mlv-palette-success-600) 70%, black)`                          | `color-mix(in srgb, var(--mlv-palette-success-600) 65%, white)`                          | `#002200`                              |              |
| `--mlv-background-success-1-hover`      | `color-mix(in srgb, var(--mlv-palette-success-600) 85%, black)`                          | `color-mix(in srgb, var(--mlv-palette-success-600) 80%, white)`                          | `#004400`                              |              |
| `--mlv-background-success-1-pale`       | `color-mix(in srgb, var(--mlv-palette-success-500) 12%, white)`                          | `color-mix(in srgb, var(--mlv-palette-success-500) 15%, var(--mlv-palette-neutral-900))` | `#e0ffe0`                              |              |
| `--mlv-background-success-1-pale-hover` | `color-mix(in srgb, var(--mlv-palette-success-500) 20%, white)`                          | `color-mix(in srgb, var(--mlv-palette-success-500) 25%, var(--mlv-palette-neutral-900))` | `#c0ffc0`                              |              |
| `--mlv-background-success-pale`         | `var(--mlv-background-success-1-pale)`                                                   | `var(--mlv-background-success-1-pale)`                                                   | `var(--mlv-background-success-1-pale)` | alias        |
| `--mlv-background-sunken`               | `var(--mlv-palette-neutral-100)`                                                         | `var(--mlv-palette-neutral-950)`                                                         | `#e8e8e8`                              |              |
| `--mlv-background-warning-1`            | `var(--mlv-palette-warning-600)`                                                         | `var(--mlv-palette-warning-600)`                                                         | `#804000`                              |              |
| `--mlv-background-warning-1-active`     | `color-mix(in srgb, var(--mlv-palette-warning-600) 70%, black)`                          | `color-mix(in srgb, var(--mlv-palette-warning-600) 65%, white)`                          | `#401000`                              |              |
| `--mlv-background-warning-1-hover`      | `color-mix(in srgb, var(--mlv-palette-warning-600) 85%, black)`                          | `color-mix(in srgb, var(--mlv-palette-warning-600) 80%, white)`                          | `#602000`                              |              |
| `--mlv-background-warning-1-pale`       | `color-mix(in srgb, var(--mlv-palette-warning-500) 12%, white)`                          | `color-mix(in srgb, var(--mlv-palette-warning-500) 15%, var(--mlv-palette-neutral-900))` | `#fff0cc`                              |              |
| `--mlv-background-warning-1-pale-hover` | `color-mix(in srgb, var(--mlv-palette-warning-500) 20%, white)`                          | `color-mix(in srgb, var(--mlv-palette-warning-500) 25%, var(--mlv-palette-neutral-900))` | `#ffe0aa`                              |              |
| `--mlv-background-warning-pale`         | `var(--mlv-background-warning-1-pale)`                                                   | `var(--mlv-background-warning-1-pale)`                                                   | `var(--mlv-background-warning-1-pale)` | alias        |

### Elevation backgrounds

Stepped surface colors. Identical in light mode; in dark mode each step is lighter than the last.

| Token                  | Light                          | Dark                                                            | Notes                                 |
| ---------------------- | ------------------------------ | --------------------------------------------------------------- | ------------------------------------- |
| `--mlv-elevation-bg-1` | `var(--mlv-background-base)`   | `#1e1e1e`                                                       | flush — canvas-level, border only     |
| `--mlv-elevation-bg-2` | `var(--mlv-background-raised)` | `var(--mlv-palette-neutral-800)`                                | raised — card, dialog, drawer         |
| `--mlv-elevation-bg-3` | `var(--mlv-background-raised)` | `#333333`                                                       | floating — popup, toast, form-control |
| `--mlv-elevation-bg-4` | `var(--mlv-background-raised)` | `var(--mlv-palette-neutral-700)`                                | overlay — drawers, side overlays      |
| `--mlv-elevation-bg-5` | `var(--mlv-background-raised)` | `color-mix(in srgb, var(--mlv-palette-neutral-700) 75%, white)` | switch-thumb only — never behind text |

### Text colors

Never use `--mlv-text-tertiary`, `--mlv-text-disabled` or `--mlv-text-placeholder` for meaningful content — they do not meet WCAG AA against body backgrounds.

| Token                            | Light                                                           | Dark                                                            | High contrast |
| -------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- | ------------- |
| `--mlv-text-action`              | `var(--mlv-palette-primary-600)`                                | `color-mix(in srgb, var(--mlv-palette-primary-300) 85%, white)` | `#0000ee`     |
| `--mlv-text-action-hover`        | `color-mix(in srgb, var(--mlv-palette-primary-600) 80%, black)` | `color-mix(in srgb, var(--mlv-palette-primary-300) 65%, white)` | `#0000bb`     |
| `--mlv-text-caption`             | `var(--mlv-palette-neutral-500)`                                | `var(--mlv-palette-neutral-400)`                                | `#444444`     |
| `--mlv-text-disabled`            | `var(--mlv-palette-neutral-500)`                                | `var(--mlv-palette-neutral-500)`                                | `#666666`     |
| `--mlv-text-error`               | `var(--mlv-palette-danger-600)`                                 | `var(--mlv-palette-danger-400)`                                 | `#cc0000`     |
| `--mlv-text-heading`             | `var(--mlv-palette-neutral-950)`                                | `#ffffff`                                                       | `#000000`     |
| `--mlv-text-hint`                | `var(--mlv-palette-neutral-500)`                                | `var(--mlv-palette-neutral-400)`                                | `#444444`     |
| `--mlv-text-info`                | `var(--mlv-palette-info-700)`                                   | `var(--mlv-palette-info-400)`                                   | `#003399`     |
| `--mlv-text-inverse`             | `#ffffff`                                                       | `var(--mlv-palette-neutral-900)`                                | `#ffffff`     |
| `--mlv-text-label`               | `var(--mlv-palette-neutral-700)`                                | `var(--mlv-palette-neutral-200)`                                | `#111111`     |
| `--mlv-text-negative`            | `var(--mlv-palette-danger-700)`                                 | `var(--mlv-palette-danger-400)`                                 | `#cc0000`     |
| `--mlv-text-on-chrome`           | `var(--mlv-text-primary)`                                       | `var(--mlv-text-primary)`                                       | `#ffffff`     |
| `--mlv-text-on-danger`           | `#ffffff`                                                       | `#ffffff`                                                       | `#ffffff`     |
| `--mlv-text-on-info`             | `#ffffff`                                                       | `#ffffff`                                                       | `#ffffff`     |
| `--mlv-text-on-selected`         | `var(--mlv-text-action)`                                        | `var(--mlv-text-action)`                                        | —             |
| `--mlv-text-on-success`          | `#ffffff`                                                       | `#ffffff`                                                       | `#ffffff`     |
| `--mlv-text-on-warning`          | `#ffffff`                                                       | `#ffffff`                                                       | `#ffffff`     |
| `--mlv-text-placeholder`         | `var(--mlv-palette-neutral-400)`                                | `var(--mlv-palette-neutral-500)`                                | `#666666`     |
| `--mlv-text-positive`            | `var(--mlv-palette-success-800)`                                | `var(--mlv-palette-success-400)`                                | `#006600`     |
| `--mlv-text-primary`             | `var(--mlv-palette-neutral-900)`                                | `#ffffff`                                                       | `#000000`     |
| `--mlv-text-primary-on-accent-1` | `#ffffff`                                                       | `#ffffff`                                                       | `#ffffff`     |
| `--mlv-text-primary-on-accent-2` | `#ffffff`                                                       | `#ffffff`                                                       | `#ffffff`     |
| `--mlv-text-secondary`           | `var(--mlv-palette-neutral-600)`                                | `var(--mlv-palette-neutral-300)`                                | `#1a1a1a`     |
| `--mlv-text-tertiary`            | `var(--mlv-palette-neutral-400)`                                | `var(--mlv-palette-neutral-500)`                                | `#333333`     |
| `--mlv-text-warning`             | `var(--mlv-palette-warning-800)`                                | `var(--mlv-palette-warning-400)`                                | `#804000`     |

### Border colors

| Token                  | Light                            | Dark                             | High contrast |
| ---------------------- | -------------------------------- | -------------------------------- | ------------- |
| `--mlv-border-error`   | `var(--mlv-palette-danger-500)`  | `var(--mlv-palette-danger-400)`  | `#cc0000`     |
| `--mlv-border-focus`   | `var(--mlv-palette-primary-500)` | `var(--mlv-palette-primary-400)` | `#000000`     |
| `--mlv-border-info`    | `var(--mlv-palette-info-500)`    | `var(--mlv-palette-info-400)`    | `#003399`     |
| `--mlv-border-normal`  | `var(--mlv-palette-neutral-200)` | `var(--mlv-palette-neutral-700)` | `#666666`     |
| `--mlv-border-strong`  | `var(--mlv-palette-neutral-300)` | `var(--mlv-palette-neutral-600)` | `#000000`     |
| `--mlv-border-subtle`  | `var(--mlv-palette-neutral-100)` | `var(--mlv-palette-neutral-800)` | `#999999`     |
| `--mlv-border-success` | `var(--mlv-palette-success-500)` | `var(--mlv-palette-success-400)` | `#006600`     |
| `--mlv-border-warning` | `var(--mlv-palette-warning-500)` | `var(--mlv-palette-warning-400)` | `#804000`     |

### Shadows

Prefer the semantic aliases (`raised`, `floating`, `overlay`, `modal`) over the numbered levels.

| Token                   | Light                                                            | Dark                                                             | Notes                     |
| ----------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------- |
| `--mlv-shadow-0`        | `none`                                                           | —                                                                |                           |
| `--mlv-shadow-1`        | `0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.05)`   | `0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)`     |                           |
| `--mlv-shadow-2`        | `0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)`   | `0 4px 6px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.2)`    |                           |
| `--mlv-shadow-3`        | `0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)`  | `0 10px 15px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.2)`   |                           |
| `--mlv-shadow-4`        | `0 20px 25px rgba(0, 0, 0, 0.1), 0 8px 10px rgba(0, 0, 0, 0.04)` | `0 20px 25px rgba(0, 0, 0, 0.35), 0 8px 10px rgba(0, 0, 0, 0.2)` |                           |
| `--mlv-shadow-5`        | `0 25px 50px rgba(0, 0, 0, 0.25)`                                | `0 25px 50px rgba(0, 0, 0, 0.5)`                                 |                           |
| `--mlv-shadow-flat`     | `var(--mlv-shadow-0)`                                            | `var(--mlv-shadow-0)`                                            | same surface, no depth    |
| `--mlv-shadow-floating` | `var(--mlv-shadow-3)`                                            | `var(--mlv-shadow-3)`                                            | dropdowns, popups, panels |
| `--mlv-shadow-modal`    | `var(--mlv-shadow-5)`                                            | `var(--mlv-shadow-5)`                                            | modal dialogs             |
| `--mlv-shadow-overlay`  | `var(--mlv-shadow-4)`                                            | `var(--mlv-shadow-4)`                                            | drawers, side overlays    |
| `--mlv-shadow-raised`   | `var(--mlv-shadow-1)`                                            | `var(--mlv-shadow-1)`                                            | cards, slightly elevated  |

### Border radius

| Token                  | Light                    | Notes |
| ---------------------- | ------------------------ | ----- |
| `--mlv-radius-2xl`     | `1rem`                   | 16px  |
| `--mlv-radius-3xl`     | `1.5rem`                 | 24px  |
| `--mlv-radius-badge`   | `var(--mlv-radius-full)` |       |
| `--mlv-radius-button`  | `var(--mlv-radius-l)`    |       |
| `--mlv-radius-card`    | `var(--mlv-radius-xl)`   |       |
| `--mlv-radius-dialog`  | `var(--mlv-radius-2xl)`  |       |
| `--mlv-radius-full`    | `9999px`                 |       |
| `--mlv-radius-input`   | `var(--mlv-radius-l)`    |       |
| `--mlv-radius-l`       | `0.5rem`                 | 8px   |
| `--mlv-radius-m`       | `0.375rem`               | 6px   |
| `--mlv-radius-panel`   | `var(--mlv-radius-l)`    |       |
| `--mlv-radius-s`       | `0.25rem`                | 4px   |
| `--mlv-radius-tag`     | `var(--mlv-radius-full)` |       |
| `--mlv-radius-tooltip` | `var(--mlv-radius-m)`    |       |
| `--mlv-radius-xl`      | `0.75rem`                | 12px  |
| `--mlv-radius-xs`      | `0.125rem`               | 2px   |

### Popover list surfaces

Shared vocabulary for every popover that presents a list of rows (select, combobox, autocomplete, menu, pagination, breadcrumb overflow). Consume these directly — do not re-derive the underlying spacing/radius token.

| Token                          | Light                             |
| ------------------------------ | --------------------------------- |
| `--mlv-popover-inset`          | `var(--mlv-spacing-1)`            |
| `--mlv-popover-item-bg-hover`  | `var(--mlv-background-neutral-1)` |
| `--mlv-popover-item-padding`   | `var(--mlv-spacing-2)`            |
| `--mlv-popover-item-radius`    | `var(--mlv-radius-m)`             |
| `--mlv-popover-surface-radius` | `var(--mlv-radius-panel)`         |

### Typography

Semantic scales are split into `-size`, `-weight`, `-line-height` and (headings only) `-letter-spacing`. There is no bare `--mlv-typography-body-m` / `--mlv-typography-ui-s` token.

| Token                                        | Light                                                                                                                                          | Notes                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `--mlv-font-family-code`                     | `'Fira Code', 'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace` |                                                                  |
| `--mlv-font-family-display`                  | `var(--mlv-font-family-sans)`                                                                                                                  |                                                                  |
| `--mlv-font-family-mono`                     | `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace`                                |                                                                  |
| `--mlv-font-family-sans`                     | `Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`                                 |                                                                  |
| `--mlv-font-size-2xl`                        | `1.25rem`                                                                                                                                      | 20px                                                             |
| `--mlv-font-size-3xl`                        | `1.25rem`                                                                                                                                      | 20px — mobile base; 24px at lg (intentionally matches 2xl on sm) |
| `--mlv-font-size-4xl`                        | `1.5rem`                                                                                                                                       | 24px — mobile base; 30px at lg                                   |
| `--mlv-font-size-5xl`                        | `1.75rem`                                                                                                                                      | 28px — mobile base; 36px at lg                                   |
| `--mlv-font-size-6xl`                        | `2.25rem`                                                                                                                                      | 36px — mobile base; 48px at lg                                   |
| `--mlv-font-size-l`                          | `1rem`                                                                                                                                         | 16px                                                             |
| `--mlv-font-size-m`                          | `0.875rem`                                                                                                                                     | 14px                                                             |
| `--mlv-font-size-s`                          | `0.75rem`                                                                                                                                      | 12px                                                             |
| `--mlv-font-size-xl`                         | `1.125rem`                                                                                                                                     | 18px                                                             |
| `--mlv-font-size-xs`                         | `0.6875rem`                                                                                                                                    | 11px                                                             |
| `--mlv-font-weight-bold`                     | `700`                                                                                                                                          |                                                                  |
| `--mlv-font-weight-medium`                   | `500`                                                                                                                                          |                                                                  |
| `--mlv-font-weight-normal`                   | `400`                                                                                                                                          |                                                                  |
| `--mlv-font-weight-semibold`                 | `600`                                                                                                                                          |                                                                  |
| `--mlv-letter-spacing-normal`                | `0em`                                                                                                                                          |                                                                  |
| `--mlv-letter-spacing-tight`                 | `-0.025em`                                                                                                                                     |                                                                  |
| `--mlv-letter-spacing-wide`                  | `0.025em`                                                                                                                                      |                                                                  |
| `--mlv-letter-spacing-wider`                 | `0.05em`                                                                                                                                       |                                                                  |
| `--mlv-letter-spacing-widest`                | `0.1em`                                                                                                                                        |                                                                  |
| `--mlv-line-height-loose`                    | `2`                                                                                                                                            |                                                                  |
| `--mlv-line-height-normal`                   | `1.5`                                                                                                                                          |                                                                  |
| `--mlv-line-height-relaxed`                  | `1.625`                                                                                                                                        |                                                                  |
| `--mlv-line-height-snug`                     | `1.375`                                                                                                                                        |                                                                  |
| `--mlv-line-height-tight`                    | `1.25`                                                                                                                                         |                                                                  |
| `--mlv-typography-body-l-line-height`        | `var(--mlv-line-height-relaxed)`                                                                                                               |                                                                  |
| `--mlv-typography-body-l-size`               | `var(--mlv-font-size-l)`                                                                                                                       |                                                                  |
| `--mlv-typography-body-l-weight`             | `var(--mlv-font-weight-normal)`                                                                                                                |                                                                  |
| `--mlv-typography-body-m-line-height`        | `var(--mlv-line-height-normal)`                                                                                                                |                                                                  |
| `--mlv-typography-body-m-size`               | `var(--mlv-font-size-m)`                                                                                                                       |                                                                  |
| `--mlv-typography-body-m-weight`             | `var(--mlv-font-weight-normal)`                                                                                                                |                                                                  |
| `--mlv-typography-body-s-line-height`        | `var(--mlv-line-height-normal)`                                                                                                                |                                                                  |
| `--mlv-typography-body-s-size`               | `var(--mlv-font-size-s)`                                                                                                                       |                                                                  |
| `--mlv-typography-body-s-weight`             | `var(--mlv-font-weight-normal)`                                                                                                                |                                                                  |
| `--mlv-typography-caption-line-height`       | `var(--mlv-line-height-tight)`                                                                                                                 |                                                                  |
| `--mlv-typography-caption-size`              | `var(--mlv-font-size-xs)`                                                                                                                      |                                                                  |
| `--mlv-typography-caption-weight`            | `var(--mlv-font-weight-normal)`                                                                                                                |                                                                  |
| `--mlv-typography-code-family`               | `var(--mlv-font-family-code)`                                                                                                                  |                                                                  |
| `--mlv-typography-code-size`                 | `var(--mlv-font-size-m)`                                                                                                                       |                                                                  |
| `--mlv-typography-code-weight`               | `var(--mlv-font-weight-normal)`                                                                                                                |                                                                  |
| `--mlv-typography-error-line-height`         | `var(--mlv-line-height-normal)`                                                                                                                |                                                                  |
| `--mlv-typography-error-size`                | `var(--mlv-font-size-s)`                                                                                                                       |                                                                  |
| `--mlv-typography-error-weight`              | `var(--mlv-font-weight-normal)`                                                                                                                |                                                                  |
| `--mlv-typography-family-code`               | `var(--mlv-font-family-code)`                                                                                                                  |                                                                  |
| `--mlv-typography-family-heading`            | `var(--mlv-font-family-display)`                                                                                                               |                                                                  |
| `--mlv-typography-family-text`               | `var(--mlv-font-family-sans)`                                                                                                                  |                                                                  |
| `--mlv-typography-heading-h1-letter-spacing` | `var(--mlv-letter-spacing-tight)`                                                                                                              |                                                                  |
| `--mlv-typography-heading-h1-line-height`    | `var(--mlv-line-height-tight)`                                                                                                                 |                                                                  |
| `--mlv-typography-heading-h1-size`           | `var(--mlv-font-size-5xl)`                                                                                                                     |                                                                  |
| `--mlv-typography-heading-h1-weight`         | `var(--mlv-font-weight-bold)`                                                                                                                  |                                                                  |
| `--mlv-typography-heading-h2-letter-spacing` | `var(--mlv-letter-spacing-tight)`                                                                                                              |                                                                  |
| `--mlv-typography-heading-h2-line-height`    | `var(--mlv-line-height-tight)`                                                                                                                 |                                                                  |
| `--mlv-typography-heading-h2-size`           | `var(--mlv-font-size-4xl)`                                                                                                                     |                                                                  |
| `--mlv-typography-heading-h2-weight`         | `var(--mlv-font-weight-bold)`                                                                                                                  |                                                                  |
| `--mlv-typography-heading-h3-letter-spacing` | `var(--mlv-letter-spacing-tight)`                                                                                                              |                                                                  |
| `--mlv-typography-heading-h3-line-height`    | `var(--mlv-line-height-snug)`                                                                                                                  |                                                                  |
| `--mlv-typography-heading-h3-size`           | `var(--mlv-font-size-3xl)`                                                                                                                     |                                                                  |
| `--mlv-typography-heading-h3-weight`         | `var(--mlv-font-weight-semibold)`                                                                                                              |                                                                  |
| `--mlv-typography-heading-h4-letter-spacing` | `var(--mlv-letter-spacing-normal)`                                                                                                             |                                                                  |
| `--mlv-typography-heading-h4-line-height`    | `var(--mlv-line-height-snug)`                                                                                                                  |                                                                  |
| `--mlv-typography-heading-h4-size`           | `var(--mlv-font-size-2xl)`                                                                                                                     |                                                                  |
| `--mlv-typography-heading-h4-weight`         | `var(--mlv-font-weight-semibold)`                                                                                                              |                                                                  |
| `--mlv-typography-heading-h5-letter-spacing` | `var(--mlv-letter-spacing-normal)`                                                                                                             |                                                                  |
| `--mlv-typography-heading-h5-line-height`    | `var(--mlv-line-height-normal)`                                                                                                                |                                                                  |
| `--mlv-typography-heading-h5-size`           | `var(--mlv-font-size-xl)`                                                                                                                      |                                                                  |
| `--mlv-typography-heading-h5-weight`         | `var(--mlv-font-weight-semibold)`                                                                                                              |                                                                  |
| `--mlv-typography-heading-h6-letter-spacing` | `var(--mlv-letter-spacing-normal)`                                                                                                             |                                                                  |
| `--mlv-typography-heading-h6-line-height`    | `var(--mlv-line-height-normal)`                                                                                                                |                                                                  |
| `--mlv-typography-heading-h6-size`           | `var(--mlv-font-size-l)`                                                                                                                       |                                                                  |
| `--mlv-typography-heading-h6-weight`         | `var(--mlv-font-weight-semibold)`                                                                                                              |                                                                  |
| `--mlv-typography-hint-line-height`          | `var(--mlv-line-height-normal)`                                                                                                                |                                                                  |
| `--mlv-typography-hint-size`                 | `var(--mlv-font-size-s)`                                                                                                                       |                                                                  |
| `--mlv-typography-hint-weight`               | `var(--mlv-font-weight-normal)`                                                                                                                |                                                                  |
| `--mlv-typography-label-line-height`         | `var(--mlv-line-height-tight)`                                                                                                                 |                                                                  |
| `--mlv-typography-label-size`                | `var(--mlv-font-size-m)`                                                                                                                       |                                                                  |
| `--mlv-typography-label-weight`              | `var(--mlv-font-weight-medium)`                                                                                                                |                                                                  |
| `--mlv-typography-ui-l-line-height`          | `var(--mlv-line-height-tight)`                                                                                                                 |                                                                  |
| `--mlv-typography-ui-l-size`                 | `var(--mlv-font-size-l)`                                                                                                                       |                                                                  |
| `--mlv-typography-ui-l-weight`               | `var(--mlv-font-weight-medium)`                                                                                                                |                                                                  |
| `--mlv-typography-ui-m-line-height`          | `var(--mlv-line-height-tight)`                                                                                                                 |                                                                  |
| `--mlv-typography-ui-m-size`                 | `var(--mlv-font-size-m)`                                                                                                                       |                                                                  |
| `--mlv-typography-ui-m-weight`               | `var(--mlv-font-weight-medium)`                                                                                                                |                                                                  |
| `--mlv-typography-ui-s-line-height`          | `var(--mlv-line-height-tight)`                                                                                                                 |                                                                  |
| `--mlv-typography-ui-s-size`                 | `var(--mlv-font-size-s)`                                                                                                                       |                                                                  |
| `--mlv-typography-ui-s-weight`               | `var(--mlv-font-weight-medium)`                                                                                                                |                                                                  |

### Spacing

| Token               | Light       | Notes |
| ------------------- | ----------- | ----- |
| `--mlv-spacing-0`   | `0`         |       |
| `--mlv-spacing-0-5` | `0.125rem`  | 2px   |
| `--mlv-spacing-1`   | `0.25rem`   | 4px   |
| `--mlv-spacing-1-5` | `0.375rem`  | 6px   |
| `--mlv-spacing-2`   | `0.5rem`    | 8px   |
| `--mlv-spacing-2-5` | `0.625rem`  | 10px  |
| `--mlv-spacing-3`   | `0.75rem`   | 12px  |
| `--mlv-spacing-3-5` | `0.875rem`  | 14px  |
| `--mlv-spacing-4`   | `1rem`      | 16px  |
| `--mlv-spacing-5`   | `1.25rem`   | 20px  |
| `--mlv-spacing-6`   | `1.5rem`    | 24px  |
| `--mlv-spacing-8`   | `2rem`      | 32px  |
| `--mlv-spacing-10`  | `2.5rem`    | 40px  |
| `--mlv-spacing-12`  | `3rem`      | 48px  |
| `--mlv-spacing-16`  | `4rem`      | 64px  |
| `--mlv-spacing-px`  | `0.0625rem` | 1px   |

### Sizing

`--mlv-padding-*` are `vertical horizontal` shorthand pairs, not single values. `--mlv-icon-in-container-ratio` is the odd member out: a unitless multiplier for a container height (e.g. `calc(var(--mlv-btn-height) * var(--mlv-icon-in-container-ratio))`), not a length of its own.

| Token                           | Light                                         | Notes                                    |
| ------------------------------- | --------------------------------------------- | ---------------------------------------- |
| `--mlv-height-2xl`              | `4.25rem`                                     | 68px — no consumer; do not introduce one |
| `--mlv-height-l`                | `3.25rem`                                     | 52px                                     |
| `--mlv-height-m`                | `2.75rem`                                     | 44px                                     |
| `--mlv-height-s`                | `2.25rem`                                     | 36px                                     |
| `--mlv-height-xl`               | `3.75rem`                                     | 60px                                     |
| `--mlv-height-xs`               | `1.75rem`                                     | 28px                                     |
| `--mlv-icon-in-container-ratio` | `0.45`                                        |                                          |
| `--mlv-padding-2xl`             | `var(--mlv-spacing-3) var(--mlv-spacing-6)`   |                                          |
| `--mlv-padding-l`               | `var(--mlv-spacing-3) var(--mlv-spacing-6)`   |                                          |
| `--mlv-padding-m`               | `var(--mlv-spacing-2) var(--mlv-spacing-4)`   |                                          |
| `--mlv-padding-s`               | `var(--mlv-spacing-1-5) var(--mlv-spacing-3)` |                                          |
| `--mlv-padding-xl`              | `var(--mlv-spacing-3) var(--mlv-spacing-6)`   |                                          |
| `--mlv-padding-xs`              | `var(--mlv-spacing-1) var(--mlv-spacing-2)`   |                                          |

### Motion

`--mlv-transition-*` hold property _lists_, not full `transition` shorthands: `transition: var(--mlv-transition-colors) var(--mlv-duration-fast) var(--mlv-ease-default)`.

| Token                           | Light                                                  | Notes                                         |
| ------------------------------- | ------------------------------------------------------ | --------------------------------------------- |
| `--mlv-duration-fast`           | `100ms`                                                |                                               |
| `--mlv-duration-instant`        | `0ms`                                                  |                                               |
| `--mlv-duration-normal`         | `200ms`                                                |                                               |
| `--mlv-duration-slow`           | `300ms`                                                |                                               |
| `--mlv-duration-slower`         | `400ms`                                                |                                               |
| `--mlv-duration-sluggish`       | `600ms`                                                |                                               |
| `--mlv-ease-bounce`             | `cubic-bezier(0.68, -0.55, 0.27, 1.55)`                | bouncy snap                                   |
| `--mlv-ease-default`            | `cubic-bezier(0.4, 0, 0.2, 1)`                         | material standard                             |
| `--mlv-ease-drawer`             | `cubic-bezier(0.32, 0.72, 0, 1)`                       | iOS drawer curve                              |
| `--mlv-ease-in`                 | `cubic-bezier(0.4, 0, 1, 1)`                           | accelerate — exit                             |
| `--mlv-ease-in-out`             | `var(--mlv-ease-default)`                              | smooth bidirectional — same curve, one source |
| `--mlv-ease-in-out-strong`      | `cubic-bezier(0.77, 0, 0.175, 1)`                      | strong bidirectional — on-screen movement     |
| `--mlv-ease-linear`             | `linear`                                               |                                               |
| `--mlv-ease-out`                | `cubic-bezier(0, 0, 0.2, 1)`                           | decelerate — enter                            |
| `--mlv-ease-out-strong`         | `cubic-bezier(0.23, 1, 0.32, 1)`                       | strong decelerate — UI enters                 |
| `--mlv-ease-spring`             | `cubic-bezier(0.34, 1.56, 0.64, 1)`                    | standard overshoot                            |
| `--mlv-ease-spring-soft`        | `cubic-bezier(0.34, 1.2, 0.64, 1)`                     | subtle overshoot                              |
| `--mlv-ease-spring-strong`      | `cubic-bezier(0.34, 1.9, 0.64, 1)`                     | pronounced overshoot                          |
| `--mlv-spring-damping`          | `14`                                                   |                                               |
| `--mlv-spring-damping-loose`    | `8`                                                    |                                               |
| `--mlv-spring-damping-rigid`    | `22`                                                   |                                               |
| `--mlv-spring-mass`             | `1`                                                    |                                               |
| `--mlv-spring-stiffness`        | `200`                                                  |                                               |
| `--mlv-spring-stiffness-soft`   | `120`                                                  |                                               |
| `--mlv-spring-stiffness-strong` | `400`                                                  |                                               |
| `--mlv-stagger-delay`           | `40ms`                                                 | per-item delay increment                      |
| `--mlv-stagger-delay-fast`      | `20ms`                                                 | tighter stagger for dense lists               |
| `--mlv-stagger-delay-slow`      | `80ms`                                                 | relaxed stagger for hero sections             |
| `--mlv-stagger-index`           | `0`                                                    | override per list item                        |
| `--mlv-transition-all`          | `all`                                                  |                                               |
| `--mlv-transition-colors`       | `color, background-color, border-color, outline-color` |                                               |
| `--mlv-transition-opacity`      | `opacity`                                              |                                               |
| `--mlv-transition-shadow`       | `box-shadow`                                           |                                               |
| `--mlv-transition-transform`    | `transform`                                            |                                               |

### Z-index

| Token              | Light  |
| ------------------ | ------ |
| `--mlv-z-base`     | `0`    |
| `--mlv-z-dropdown` | `100`  |
| `--mlv-z-max`      | `9999` |
| `--mlv-z-modal`    | `400`  |
| `--mlv-z-overlay`  | `300`  |
| `--mlv-z-popover`  | `500`  |
| `--mlv-z-raised`   | `10`   |
| `--mlv-z-sticky`   | `200`  |
| `--mlv-z-toast`    | `600`  |
| `--mlv-z-tooltip`  | `700`  |

### State opacity

| Token                    | Light  |
| ------------------------ | ------ |
| `--mlv-active-overlay`   | `0.12` |
| `--mlv-disabled-opacity` | `0.4`  |
| `--mlv-focus-overlay`    | `0.08` |
| `--mlv-hover-overlay`    | `0.06` |

### Stroke & focus

| Token                       | Light                                                          | High contrast                                                 | Notes |
| --------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- | ----- |
| `--mlv-focus-ring`          | `0 0 0 var(--mlv-stroke-width-medium) var(--mlv-border-focus)` | `0 0 0 var(--mlv-stroke-width-thick) var(--mlv-border-focus)` |       |
| `--mlv-focus-ring-offset`   | `0.125rem`                                                     | —                                                             |       |
| `--mlv-stroke-width`        | `0.0625rem`                                                    | `0.125rem`                                                    | 1px   |
| `--mlv-stroke-width-medium` | `0.125rem`                                                     | `0.1875rem`                                                   | 2px   |
| `--mlv-stroke-width-thick`  | `0.1875rem`                                                    | `0.25rem`                                                     | 3px   |

### Direction

The sign of the inline axis: `1` in LTR, `-1` in RTL, re-declared under every `[dir]` so a mirrored subtree re-signs it for its own descendants. `transform`, `transform-origin` and `box-shadow` have no logical form, so their inline component is multiplied by this — consume it through `mixins.inline-distance()` rather than inlining the `calc()`.

| Token                    | Light |
| ------------------------ | ----- |
| `--mlv-inline-direction` | `1`   |

### Muted tints

Three emphasis levels (`1` subtle → `3` strong) across eight families, each a `bg` / `text` / `border` triplet.

| Token                            | Light                                                           | Dark                                                                                     | High contrast |
| -------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------- |
| `--mlv-muted-accent-bg-1`        | `color-mix(in srgb, var(--mlv-palette-accent-500) 10%, white)`  | `color-mix(in srgb, var(--mlv-palette-accent-500) 15%, var(--mlv-palette-neutral-900))`  | `#e0f8ff`     |
| `--mlv-muted-accent-bg-2`        | `color-mix(in srgb, var(--mlv-palette-accent-500) 18%, white)`  | `color-mix(in srgb, var(--mlv-palette-accent-500) 25%, var(--mlv-palette-neutral-900))`  | `#c0f0ff`     |
| `--mlv-muted-accent-bg-3`        | `color-mix(in srgb, var(--mlv-palette-accent-500) 28%, white)`  | `color-mix(in srgb, var(--mlv-palette-accent-500) 35%, var(--mlv-palette-neutral-900))`  | `#99e0ff`     |
| `--mlv-muted-accent-border-1`    | `color-mix(in srgb, var(--mlv-palette-accent-500) 35%, white)`  | `color-mix(in srgb, var(--mlv-palette-accent-500) 30%, var(--mlv-palette-neutral-900))`  | `#005577`     |
| `--mlv-muted-accent-border-2`    | `color-mix(in srgb, var(--mlv-palette-accent-500) 48%, white)`  | `color-mix(in srgb, var(--mlv-palette-accent-500) 45%, var(--mlv-palette-neutral-900))`  | `#003355`     |
| `--mlv-muted-accent-border-3`    | `color-mix(in srgb, var(--mlv-palette-accent-500) 60%, white)`  | `color-mix(in srgb, var(--mlv-palette-accent-500) 60%, var(--mlv-palette-neutral-900))`  | `#001133`     |
| `--mlv-muted-accent-text-1`      | `var(--mlv-palette-accent-700)`                                 | `var(--mlv-palette-accent-300)`                                                          | `#005577`     |
| `--mlv-muted-accent-text-2`      | `var(--mlv-palette-accent-800)`                                 | `var(--mlv-palette-accent-200)`                                                          | `#003355`     |
| `--mlv-muted-accent-text-3`      | `var(--mlv-palette-accent-900)`                                 | `var(--mlv-palette-accent-100)`                                                          | `#001133`     |
| `--mlv-muted-danger-bg-1`        | `color-mix(in srgb, var(--mlv-palette-danger-500) 10%, white)`  | `color-mix(in srgb, var(--mlv-palette-danger-500) 15%, var(--mlv-palette-neutral-900))`  | `#ffe0e0`     |
| `--mlv-muted-danger-bg-2`        | `color-mix(in srgb, var(--mlv-palette-danger-500) 18%, white)`  | `color-mix(in srgb, var(--mlv-palette-danger-500) 25%, var(--mlv-palette-neutral-900))`  | `#ffc8c8`     |
| `--mlv-muted-danger-bg-3`        | `color-mix(in srgb, var(--mlv-palette-danger-500) 28%, white)`  | `color-mix(in srgb, var(--mlv-palette-danger-500) 35%, var(--mlv-palette-neutral-900))`  | `#ffaaaa`     |
| `--mlv-muted-danger-border-1`    | `color-mix(in srgb, var(--mlv-palette-danger-500) 35%, white)`  | `color-mix(in srgb, var(--mlv-palette-danger-500) 30%, var(--mlv-palette-neutral-900))`  | `#cc0000`     |
| `--mlv-muted-danger-border-2`    | `color-mix(in srgb, var(--mlv-palette-danger-500) 48%, white)`  | `color-mix(in srgb, var(--mlv-palette-danger-500) 45%, var(--mlv-palette-neutral-900))`  | `#880000`     |
| `--mlv-muted-danger-border-3`    | `color-mix(in srgb, var(--mlv-palette-danger-500) 60%, white)`  | `color-mix(in srgb, var(--mlv-palette-danger-500) 60%, var(--mlv-palette-neutral-900))`  | `#550000`     |
| `--mlv-muted-danger-text-1`      | `var(--mlv-palette-danger-700)`                                 | `var(--mlv-palette-danger-300)`                                                          | `#cc0000`     |
| `--mlv-muted-danger-text-2`      | `var(--mlv-palette-danger-800)`                                 | `var(--mlv-palette-danger-200)`                                                          | `#880000`     |
| `--mlv-muted-danger-text-3`      | `var(--mlv-palette-danger-900)`                                 | `var(--mlv-palette-danger-100)`                                                          | `#550000`     |
| `--mlv-muted-default-bg-1`       | `color-mix(in srgb, var(--mlv-palette-neutral-500) 10%, white)` | `color-mix(in srgb, var(--mlv-palette-neutral-500) 15%, var(--mlv-palette-neutral-900))` | `#f5f5f5`     |
| `--mlv-muted-default-bg-2`       | `color-mix(in srgb, var(--mlv-palette-neutral-500) 18%, white)` | `color-mix(in srgb, var(--mlv-palette-neutral-500) 25%, var(--mlv-palette-neutral-900))` | `#e8e8e8`     |
| `--mlv-muted-default-bg-3`       | `color-mix(in srgb, var(--mlv-palette-neutral-500) 28%, white)` | `color-mix(in srgb, var(--mlv-palette-neutral-500) 35%, var(--mlv-palette-neutral-900))` | `#d0d0d0`     |
| `--mlv-muted-default-border-1`   | `color-mix(in srgb, var(--mlv-palette-neutral-500) 35%, white)` | `color-mix(in srgb, var(--mlv-palette-neutral-500) 30%, var(--mlv-palette-neutral-900))` | `#999999`     |
| `--mlv-muted-default-border-2`   | `color-mix(in srgb, var(--mlv-palette-neutral-500) 48%, white)` | `color-mix(in srgb, var(--mlv-palette-neutral-500) 45%, var(--mlv-palette-neutral-900))` | `#666666`     |
| `--mlv-muted-default-border-3`   | `color-mix(in srgb, var(--mlv-palette-neutral-500) 60%, white)` | `color-mix(in srgb, var(--mlv-palette-neutral-500) 60%, var(--mlv-palette-neutral-900))` | `#000000`     |
| `--mlv-muted-default-text-1`     | `var(--mlv-palette-neutral-700)`                                | `var(--mlv-palette-neutral-300)`                                                         | `#333333`     |
| `--mlv-muted-default-text-2`     | `var(--mlv-palette-neutral-800)`                                | `var(--mlv-palette-neutral-200)`                                                         | `#111111`     |
| `--mlv-muted-default-text-3`     | `var(--mlv-palette-neutral-900)`                                | `var(--mlv-palette-neutral-100)`                                                         | `#000000`     |
| `--mlv-muted-info-bg-1`          | `color-mix(in srgb, var(--mlv-palette-info-500) 10%, white)`    | `color-mix(in srgb, var(--mlv-palette-info-500) 15%, var(--mlv-palette-neutral-900))`    | `#e0f0ff`     |
| `--mlv-muted-info-bg-2`          | `color-mix(in srgb, var(--mlv-palette-info-500) 18%, white)`    | `color-mix(in srgb, var(--mlv-palette-info-500) 25%, var(--mlv-palette-neutral-900))`    | `#c0e0ff`     |
| `--mlv-muted-info-bg-3`          | `color-mix(in srgb, var(--mlv-palette-info-500) 28%, white)`    | `color-mix(in srgb, var(--mlv-palette-info-500) 35%, var(--mlv-palette-neutral-900))`    | `#99ccff`     |
| `--mlv-muted-info-border-1`      | `color-mix(in srgb, var(--mlv-palette-info-500) 35%, white)`    | `color-mix(in srgb, var(--mlv-palette-info-500) 30%, var(--mlv-palette-neutral-900))`    | `#003399`     |
| `--mlv-muted-info-border-2`      | `color-mix(in srgb, var(--mlv-palette-info-500) 48%, white)`    | `color-mix(in srgb, var(--mlv-palette-info-500) 45%, var(--mlv-palette-neutral-900))`    | `#002277`     |
| `--mlv-muted-info-border-3`      | `color-mix(in srgb, var(--mlv-palette-info-500) 60%, white)`    | `color-mix(in srgb, var(--mlv-palette-info-500) 60%, var(--mlv-palette-neutral-900))`    | `#001155`     |
| `--mlv-muted-info-text-1`        | `var(--mlv-palette-info-700)`                                   | `var(--mlv-palette-info-300)`                                                            | `#003399`     |
| `--mlv-muted-info-text-2`        | `var(--mlv-palette-info-800)`                                   | `var(--mlv-palette-info-200)`                                                            | `#002277`     |
| `--mlv-muted-info-text-3`        | `var(--mlv-palette-info-900)`                                   | `var(--mlv-palette-info-100)`                                                            | `#001155`     |
| `--mlv-muted-primary-bg-1`       | `color-mix(in srgb, var(--mlv-palette-primary-500) 10%, white)` | `color-mix(in srgb, var(--mlv-palette-primary-500) 15%, var(--mlv-palette-neutral-900))` | `#e0e0ff`     |
| `--mlv-muted-primary-bg-2`       | `color-mix(in srgb, var(--mlv-palette-primary-500) 18%, white)` | `color-mix(in srgb, var(--mlv-palette-primary-500) 25%, var(--mlv-palette-neutral-900))` | `#c8c8ff`     |
| `--mlv-muted-primary-bg-3`       | `color-mix(in srgb, var(--mlv-palette-primary-500) 28%, white)` | `color-mix(in srgb, var(--mlv-palette-primary-500) 35%, var(--mlv-palette-neutral-900))` | `#aaaaff`     |
| `--mlv-muted-primary-border-1`   | `color-mix(in srgb, var(--mlv-palette-primary-500) 35%, white)` | `color-mix(in srgb, var(--mlv-palette-primary-500) 30%, var(--mlv-palette-neutral-900))` | `#000066`     |
| `--mlv-muted-primary-border-2`   | `color-mix(in srgb, var(--mlv-palette-primary-500) 48%, white)` | `color-mix(in srgb, var(--mlv-palette-primary-500) 45%, var(--mlv-palette-neutral-900))` | `#000044`     |
| `--mlv-muted-primary-border-3`   | `color-mix(in srgb, var(--mlv-palette-primary-500) 60%, white)` | `color-mix(in srgb, var(--mlv-palette-primary-500) 60%, var(--mlv-palette-neutral-900))` | `#000000`     |
| `--mlv-muted-primary-text-1`     | `var(--mlv-palette-primary-700)`                                | `var(--mlv-palette-primary-300)`                                                         | `#000066`     |
| `--mlv-muted-primary-text-2`     | `var(--mlv-palette-primary-800)`                                | `var(--mlv-palette-primary-200)`                                                         | `#000044`     |
| `--mlv-muted-primary-text-3`     | `var(--mlv-palette-primary-900)`                                | `var(--mlv-palette-primary-100)`                                                         | `#000000`     |
| `--mlv-muted-secondary-bg-1`     | `var(--mlv-palette-secondary-50)`                               | `color-mix(in srgb, var(--mlv-palette-neutral-500) 15%, var(--mlv-palette-neutral-900))` | `#f0f0f0`     |
| `--mlv-muted-secondary-bg-2`     | `var(--mlv-palette-secondary-100)`                              | `color-mix(in srgb, var(--mlv-palette-neutral-500) 25%, var(--mlv-palette-neutral-900))` | `#e0e0e0`     |
| `--mlv-muted-secondary-bg-3`     | `var(--mlv-palette-secondary-200)`                              | `color-mix(in srgb, var(--mlv-palette-neutral-500) 35%, var(--mlv-palette-neutral-900))` | `#cccccc`     |
| `--mlv-muted-secondary-border-1` | `var(--mlv-palette-secondary-200)`                              | `color-mix(in srgb, var(--mlv-palette-neutral-500) 30%, var(--mlv-palette-neutral-900))` | `#666666`     |
| `--mlv-muted-secondary-border-2` | `var(--mlv-palette-secondary-300)`                              | `color-mix(in srgb, var(--mlv-palette-neutral-500) 45%, var(--mlv-palette-neutral-900))` | `#444444`     |
| `--mlv-muted-secondary-border-3` | `var(--mlv-palette-secondary-400)`                              | `color-mix(in srgb, var(--mlv-palette-neutral-500) 60%, var(--mlv-palette-neutral-900))` | `#000000`     |
| `--mlv-muted-secondary-text-1`   | `var(--mlv-palette-secondary-700)`                              | `var(--mlv-palette-secondary-300)`                                                       | `#111111`     |
| `--mlv-muted-secondary-text-2`   | `var(--mlv-palette-secondary-800)`                              | `var(--mlv-palette-secondary-200)`                                                       | `#000000`     |
| `--mlv-muted-secondary-text-3`   | `var(--mlv-palette-secondary-900)`                              | `var(--mlv-palette-secondary-100)`                                                       | `#000000`     |
| `--mlv-muted-success-bg-1`       | `color-mix(in srgb, var(--mlv-palette-success-500) 10%, white)` | `color-mix(in srgb, var(--mlv-palette-success-500) 15%, var(--mlv-palette-neutral-900))` | `#e0ffe0`     |
| `--mlv-muted-success-bg-2`       | `color-mix(in srgb, var(--mlv-palette-success-500) 18%, white)` | `color-mix(in srgb, var(--mlv-palette-success-500) 25%, var(--mlv-palette-neutral-900))` | `#c0ffc0`     |
| `--mlv-muted-success-bg-3`       | `color-mix(in srgb, var(--mlv-palette-success-500) 28%, white)` | `color-mix(in srgb, var(--mlv-palette-success-500) 35%, var(--mlv-palette-neutral-900))` | `#99ee99`     |
| `--mlv-muted-success-border-1`   | `color-mix(in srgb, var(--mlv-palette-success-500) 35%, white)` | `color-mix(in srgb, var(--mlv-palette-success-500) 30%, var(--mlv-palette-neutral-900))` | `#006600`     |
| `--mlv-muted-success-border-2`   | `color-mix(in srgb, var(--mlv-palette-success-500) 48%, white)` | `color-mix(in srgb, var(--mlv-palette-success-500) 45%, var(--mlv-palette-neutral-900))` | `#004400`     |
| `--mlv-muted-success-border-3`   | `color-mix(in srgb, var(--mlv-palette-success-500) 60%, white)` | `color-mix(in srgb, var(--mlv-palette-success-500) 60%, var(--mlv-palette-neutral-900))` | `#002200`     |
| `--mlv-muted-success-text-1`     | `var(--mlv-palette-success-700)`                                | `var(--mlv-palette-success-300)`                                                         | `#006600`     |
| `--mlv-muted-success-text-2`     | `var(--mlv-palette-success-800)`                                | `var(--mlv-palette-success-200)`                                                         | `#004400`     |
| `--mlv-muted-success-text-3`     | `var(--mlv-palette-success-900)`                                | `var(--mlv-palette-success-100)`                                                         | `#002200`     |
| `--mlv-muted-warning-bg-1`       | `color-mix(in srgb, var(--mlv-palette-warning-500) 10%, white)` | `color-mix(in srgb, var(--mlv-palette-warning-500) 15%, var(--mlv-palette-neutral-900))` | `#fff0cc`     |
| `--mlv-muted-warning-bg-2`       | `color-mix(in srgb, var(--mlv-palette-warning-500) 18%, white)` | `color-mix(in srgb, var(--mlv-palette-warning-500) 25%, var(--mlv-palette-neutral-900))` | `#ffe0aa`     |
| `--mlv-muted-warning-bg-3`       | `color-mix(in srgb, var(--mlv-palette-warning-500) 28%, white)` | `color-mix(in srgb, var(--mlv-palette-warning-500) 35%, var(--mlv-palette-neutral-900))` | `#ffcc77`     |
| `--mlv-muted-warning-border-1`   | `color-mix(in srgb, var(--mlv-palette-warning-500) 35%, white)` | `color-mix(in srgb, var(--mlv-palette-warning-500) 30%, var(--mlv-palette-neutral-900))` | `#804000`     |
| `--mlv-muted-warning-border-2`   | `color-mix(in srgb, var(--mlv-palette-warning-500) 48%, white)` | `color-mix(in srgb, var(--mlv-palette-warning-500) 45%, var(--mlv-palette-neutral-900))` | `#602000`     |
| `--mlv-muted-warning-border-3`   | `color-mix(in srgb, var(--mlv-palette-warning-500) 60%, white)` | `color-mix(in srgb, var(--mlv-palette-warning-500) 60%, var(--mlv-palette-neutral-900))` | `#400000`     |
| `--mlv-muted-warning-text-1`     | `var(--mlv-palette-warning-700)`                                | `var(--mlv-palette-warning-300)`                                                         | `#804000`     |
| `--mlv-muted-warning-text-2`     | `var(--mlv-palette-warning-800)`                                | `var(--mlv-palette-warning-200)`                                                         | `#602000`     |
| `--mlv-muted-warning-text-3`     | `var(--mlv-palette-warning-900)`                                | `var(--mlv-palette-warning-100)`                                                         | `#400000`     |

### Responsive overrides

These tokens change value at viewport breakpoints. Body and UI sizes are fixed;
only the heading-scale font sizes scale up.

| Token                 | Base      | (min-width: 768px) | (min-width: 1200px) |
| --------------------- | --------- | ------------------ | ------------------- |
| `--mlv-font-size-3xl` | `1.25rem` | `1.375rem`         | `1.5rem`            |
| `--mlv-font-size-4xl` | `1.5rem`  | `1.625rem`         | `1.875rem`          |
| `--mlv-font-size-5xl` | `1.75rem` | `2rem`             | `2.25rem`           |
| `--mlv-font-size-6xl` | `2.25rem` | `2.5rem`           | `3rem`              |

## Animation override hooks

These are **not** declared anywhere — the `var()` fallback is the default value.
Set them on a component (or on `:root`) to retune the shared keyframe animations
in `animations.scss`. Referencing one without setting it is intentional and safe.

| Hook                                    | Default                                      |
| --------------------------------------- | -------------------------------------------- |
| `--mlv-dialog-enter-duration`           | `var(--mlv-duration-normal)`                 |
| `--mlv-dialog-enter-easing`             | `var(--mlv-ease-out-strong)`                 |
| `--mlv-dialog-enter-from-opacity`       | `0`                                          |
| `--mlv-dialog-enter-from-scale`         | `0.95`                                       |
| `--mlv-dialog-enter-from-translate-y`   | `20px`                                       |
| `--mlv-dialog-leave-duration`           | `var(--mlv-duration-fast)`                   |
| `--mlv-dialog-leave-easing`             | `var(--mlv-ease-out-strong)`                 |
| `--mlv-dialog-leave-to-opacity`         | `0`                                          |
| `--mlv-dialog-leave-to-scale`           | `0.95`                                       |
| `--mlv-dialog-leave-to-translate-y`     | `20px`                                       |
| `--mlv-drawer-enter-duration`           | `var(--mlv-duration-slow)`                   |
| `--mlv-drawer-enter-easing`             | `var(--mlv-ease-drawer)`                     |
| `--mlv-drawer-hidden-transform`         | _none — the animation requires it to be set_ |
| `--mlv-drawer-leave-duration`           | `var(--mlv-duration-normal)`                 |
| `--mlv-drawer-leave-easing`             | `var(--mlv-ease-drawer)`                     |
| `--mlv-popup-enter-duration`            | `var(--mlv-duration-fast)`                   |
| `--mlv-popup-enter-easing`              | `var(--mlv-ease-out-strong)`                 |
| `--mlv-popup-enter-from-opacity`        | `0`                                          |
| `--mlv-popup-enter-from-scale`          | `0.96`                                       |
| `--mlv-popup-enter-from-translate-y`    | `-0.25rem`                                   |
| `--mlv-popup-leave-duration`            | `var(--mlv-duration-fast)`                   |
| `--mlv-popup-leave-easing`              | `var(--mlv-ease-out-strong)`                 |
| `--mlv-popup-leave-to-opacity`          | `0`                                          |
| `--mlv-popup-leave-to-scale`            | `0.96`                                       |
| `--mlv-popup-leave-to-translate-y`      | `-0.25rem`                                   |
| `--mlv-popup-transform-origin`          | `top center`                                 |
| `--mlv-presence-enter-duration`         | `var(--mlv-duration-normal)`                 |
| `--mlv-presence-enter-easing`           | `var(--mlv-ease-out)`                        |
| `--mlv-presence-enter-from-scale`       | `0.98`                                       |
| `--mlv-presence-enter-from-translate-y` | `0.25rem`                                    |
| `--mlv-presence-leave-duration`         | `var(--mlv-duration-fast)`                   |
| `--mlv-presence-leave-easing`           | `var(--mlv-ease-in)`                         |
| `--mlv-presence-leave-to-scale`         | `0.98`                                       |
| `--mlv-presence-leave-to-translate-y`   | `0.25rem`                                    |
| `--mlv-stagger-enter-offset-y`          | `0.5rem`                                     |
| `--mlv-stagger-enter-scale-from`        | `0.92`                                       |

## Not custom properties

### Breakpoints (Sass variables)

Breakpoints are compile-time Sass variables — there is no `--mlv-breakpoint-*`
custom property. Override them where you `@use` the module:

```scss
@use '../../../../styles/src/lib/breakpoints' as bp with (
  $mlv-breakpoint-md: 900px
);
```

| Variable             | Default  |
| -------------------- | -------- |
| `$mlv-breakpoint-md` | `768px`  |
| `$mlv-breakpoint-lg` | `1200px` |

### Density (Sass mixins)

Density declares no tokens. It is a set of mixins in `density.scss`
(`density-tight`, `density-compact`, `density-comfortable`, `density-spacious`,
`density-airy`, `density-not-comfortable`) that match a `--<level>` BEM modifier
on the element or an ancestor. Components remap their own scoped variables
inside those mixins.

### Component-scoped variables

A component may declare its own `--mlv-<block>-*` variables (`--mlv-btn-bg`,
`--mlv-tab-indicator-width`) to let state, variants and density mutate a value
without touching the global contract. Those are implementation details of the
component that declares them, not design tokens, and are deliberately absent
from this file.

## Verifying token names

```sh
yarn nx run styles:check-tokens
```

Scans every `.scss` / `.css` under `libs/` and `apps/` for `var(--mlv-…)` and
fails on any name that is neither declared here nor declared locally as a
component-scoped variable.
