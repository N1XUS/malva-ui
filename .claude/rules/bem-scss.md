# Rule: BEM SCSS

All component styles in this codebase follow BEM (Block–Element–Modifier) naming. This document defines the conventions, the `--mlv-*` CSS variable system, and the SCSS patterns used across all libraries.

---

## Naming Conventions

### Block — `.mlv-<component-name>`

The block is the root element of a component. **All Malva UI component blocks are prefixed with `.mlv-`.**

The block name must match the component selector:

| Selector            | Block class                                                 |
| ------------------- | ----------------------------------------------------------- |
| `mlv-button`        | `.mlv-button`                                               |
| `mlv-dialog`        | `.mlv-dialog`                                               |
| `button[mlvButton]` | `.mlv-button` (applied via `host: { class: 'mlv-button' }`) |
| `[mlvActionBar]`    | `.mlv-action-bar`                                           |

### Element — `.mlv-<block>__<element>`

An element is a part of a block. Separated by double underscore `__`.

```scss
.mlv-button__text { ... }      // text span inside button
.mlv-dialog__header { ... }    // header region of dialog
.mlv-select__trigger { ... }   // trigger button inside select
.mlv-card__footer { ... }      // footer region of card
```

**Never nest BEM element names:**

- `.mlv-card__header__title` — WRONG
- `.mlv-card__title` — correct

### Modifier — `.mlv-<block>--<modifier>`

A modifier is a variant or state of a block or element. Separated by double dash `--`.

```scss
.mlv-button--primary { ... }           // variant modifier
.mlv-button--size-small { ... }        // compound modifier (type-value)
.mlv-button--disabled { ... }          // state modifier
.mlv-tab-item--active { ... }          // state modifier on block
.mlv-list-item__link--active { ... }   // state modifier on element
```

**Modifiers are always combined with the base class:**

```html
<!-- Correct -->
<button class="mlv-button mlv-button--primary mlv-button--size-large">
  <!-- Wrong — modifier without base class -->
  <button class="mlv-button--primary"></button>
</button>
```

---

## SCSS Block Variable Pattern

Use a `$block` variable at the top of every component SCSS file to avoid repeating the block name and enable safe renaming:

```scss
$block: mlv-button;

.#{$block} {
  // block styles

  &__text { ... }              // .mlv-button__text
  &__icon { ... }              // .mlv-button__icon

  &--primary { ... }           // .mlv-button--primary
  &--disabled { ... }          // .mlv-button--disabled
  &--size-small { ... }        // .mlv-button--size-small
}
```

---

## Component Host Class

Every component must apply its BEM block class via the `host` object:

```ts
@Component({
  host: {
    class: 'mlv-button',   // static block class
    '[class]': '"mlv-button--" + variant()',
    '[class.mlv-button--disabled]': 'disabled()',
  },
})
```

Never apply the block class from the template — it must come from the host.

---

## ViewEncapsulation.None

**Every component** must set `encapsulation: ViewEncapsulation.None`.

```ts
@Component({
  encapsulation: ViewEncapsulation.None,
  // ...
})
```

BEM class names provide style isolation. Angular's emulated encapsulation is not used in this codebase.

---

## CSS Custom Properties — `--mlv-*` Prefix

**All CSS custom properties must be prefixed with `--mlv-`.**

### Design token usage (from `@malva-ui/styles`)

Always reference design tokens from `libs/styles`. Never hard-code raw color values, spacing, or typography.

```scss
.mlv-button {
  // Colors
  background-color: var(--mlv-background-accent-1);
  color: var(--mlv-text-primary-on-accent-1);
  border-color: var(--mlv-border-normal);

  // Typography — note the -size/-weight/-line-height suffix
  font-size: var(--mlv-typography-body-m-size);
  font-family: var(--mlv-typography-family-text);

  // Spacing — `--mlv-padding-*` is a `block inline` PAIR; only ever use it as
  // the whole value of the `padding` shorthand. Per-side / gap / calc → `--mlv-spacing-*`.
  padding: var(--mlv-padding-m);
  gap: var(--mlv-spacing-2);
  padding-inline-start: var(--mlv-spacing-4);
  height: var(--mlv-height-m);
  border-radius: var(--mlv-radius-m);

  // Transitions
  transition-duration: var(--mlv-duration-fast);
  transition-timing-function: var(--mlv-ease-default);

  // Disabled state
  &--disabled {
    opacity: var(--mlv-disabled-opacity);
  }

  // Focus ring — Form A, see "Focus Ring — Forms A/B" below
  &:focus-visible {
    outline: var(--mlv-stroke-width-medium) solid var(--mlv-border-focus);
    outline-offset: var(--mlv-focus-ring-offset);
  }
}
```

### Focus Ring — Forms A/B (SF-R3)

Every `:focus-visible` ring in the library is one of exactly two forms — never
a hand-built width/offset literal, and never `--mlv-stroke-width` (1px, the
default _border_ weight — not a focus-ring width).

**Form A — outline (default).**

```scss
&:focus-visible {
  outline: var(--mlv-stroke-width-medium) solid var(--mlv-border-focus);
  outline-offset: var(--mlv-focus-ring-offset);
}
```

**Form B — inset outline**, when the element's own container clips
(`overflow: hidden`) or the ring would collide with a neighbour:

```scss
&:focus-visible {
  outline: var(--mlv-stroke-width-medium) solid var(--mlv-border-focus);
  outline-offset: calc(var(--mlv-focus-ring-offset) * -1);
}
```

`box-shadow` is permitted **only** where the element cannot paint an outline
at all (e.g. a pseudo-element track handle) — then it must be
`box-shadow: var(--mlv-focus-ring);`, never a hand-built `0 0 0 Nrem` list.

`outline: none` is permitted **only** when the same rule (or a rule on a
designated proxy element) restores Form A or Form B — never as a silent
dead end.

### The `-active` law (SF-R1)

`--mlv-background-*-active` / `--mlv-*-bg-active` means **the pointer is down
right now** — nothing else. No persistent state (selected, checked, pressed
toggle, active nav item) may resolve an `-active` token. Persistent selection
uses its own token pair instead: `--mlv-background-selected` /
`--mlv-background-selected-hover` + `--mlv-text-on-selected`.

### Component-scoped custom properties

Use `--mlv-<block>-<property>` for component-internal theming variables. This allows parent overrides without touching internals:

```scss
.mlv-button {
  // Declare component variables with defaults
  --mlv-btn-bg: var(--mlv-background-accent-1);
  --mlv-btn-bg-hover: var(--mlv-background-accent-1-hover);
  --mlv-btn-text-color: var(--mlv-text-primary-on-accent-1);

  background-color: var(--mlv-btn-bg);
  color: var(--mlv-btn-text-color);

  &:hover {
    // Override component variable, not design token directly
    --mlv-btn-bg: var(--mlv-btn-bg-hover);
  }

  &--secondary {
    --mlv-btn-bg: var(--mlv-background-neutral-1);
    --mlv-btn-text-color: var(--mlv-text-action);
  }
}
```

---

## SCSS Import Pattern

Always use `@use` (never `@import`, which is deprecated). Reference by relative file path — TypeScript path aliases do not work in SCSS.

```scss
// Component stylesheet
@use '../../../../styles/src/lib/mixins' as mixins;
@use 'sass:map';

$block: mlv-my-component;

.#{$block} {
  @include mixins.base(var(--mlv-typography-family-text), var(--mlv-typography-body-m-size), 0, var(--mlv-padding-m));
  // ...
}
```

The `mixins.base()` mixin sets `box-sizing: border-box`, resets `margin`/`padding`, and sets `font-family`/`font-size`. Include it on the block selector as the first declaration.

### `density.*` mixins only work on selectors that do not start at the density block

`density.*` mixins prefix the whole selector with an **ancestor** `[class*='--x']`; do not include them under a descendant selector that starts at the density-carrying block itself (e.g. `.mlv-form … > legend`) — the block's own modifier can never match. Write `&[class*='--x'] …` selectors explicitly there.

```scss
.mlv-form {
  // WRONG — emits `[class*='--compact'] .mlv-form fieldset > legend`, so the
  // form's own `mlv-form--compact` (an ancestor is required) never matches.
  fieldset > legend {
    @include density.density-compact {
      font-size: var(--mlv-typography-body-m-size);
    }
  }

  // RIGHT
  &[class*='--compact'] fieldset > legend {
    font-size: var(--mlv-typography-body-m-size);
  }
}
```

---

## Logical Properties (RTL)

Every inline-axis declaration is **logical** so one rule serves LTR and RTL. Physical `left` / `right` forms are forbidden unless the value is a physical coordinate (see the exceptions in `.claude/rules/rtl.md`), and then the line carries a `// physical: <reason>` comment.

| Physical (forbidden)                                   | Logical (required)                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `margin-left` / `margin-right`                         | `margin-inline-start` / `margin-inline-end`                            |
| `padding-left` / `padding-right`                       | `padding-inline-start` / `padding-inline-end`                          |
| `left` / `right`                                       | `inset-inline-start` / `inset-inline-end` (both: `inset-inline`)       |
| `border-left` / `border-right`                         | `border-inline-start` / `border-inline-end`                            |
| `border-top-left-radius` (and the other three corners) | `border-start-start-radius`, `-start-end-`, `-end-start-`, `-end-end-` |
| `text-align: left` / `right`                           | `text-align: start` / `end`                                            |
| `float: left` / `right`                                | `float: inline-start` / `inline-end`                                   |

`transform`, `transform-origin` and `box-shadow` offsets have no logical keywords — multiply the inline component by `--mlv-inline-direction` through the mixins instead of duplicating rules under `[dir='rtl']`:

```scss
@use '../../../../styles/src/lib/mixins' as mixins;

.mlv-x {
  transform: translateX(mixins.inline-distance(-0.25rem)) scale(0.98); // composes
  @include mixins.translate-inline(-100%); // sugar for a lone inline translation
}

.mlv-x__chevron {
  transform: scaleX(var(--mlv-inline-direction)); // mirror a directional glyph
}
```

`@include mixins.rtl { … }` / `mixins.ltr { … }` are for a visual rule that genuinely differs per direction and cannot be expressed by a sign flip — never for spacing.

---

## Rem Values (Not Pixels)

Use `rem` for all size-related values. This ensures scalability and accessibility (respects user font-size settings):

```scss
// Correct
padding: 0.5rem;
gap: 0.25rem;
outline-offset: 0.125rem;
border-radius: 0.625rem;

// Wrong
padding: 8px;
gap: 4px;
outline-offset: 2px;
```

Exception: pixel-perfect values where the design token already encodes the rem value (use the token directly).

---

## Available Design Token Categories

> **Source of truth:** `libs/styles/src/lib/theme.scss`. Only reference tokens that actually exist in that file. If a token isn't declared there, it won't resolve — do NOT invent tokens by analogy.

| Category                                       | Pattern                                                                                                                                                        | Real tokens to use                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Backgrounds — neutral                          | `--mlv-background-{base,subtle,raised,overlay,sunken,neutral-1,neutral-1-hover,neutral-1-active}`                                                              | `--mlv-background-base`, `--mlv-background-raised`, `--mlv-background-neutral-1`                    |
| Backgrounds — accent                           | `--mlv-background-accent-{1,2}[-hover\|-active\|-pale\|-pale-hover]`                                                                                           | `--mlv-background-accent-1`, `--mlv-background-accent-1-hover`, `--mlv-background-accent-1-pale`    |
| Backgrounds — semantic                         | `--mlv-background-{success,danger,warning,info}-1[-hover\|-active\|-pale\|-pale-hover]`, plus `--mlv-background-{success,warning,info}-pale` aliases           | `--mlv-background-success-1`, `--mlv-background-warning-1-pale`, `--mlv-background-info-pale`       |
| Text — neutral                                 | `--mlv-text-{primary,secondary,tertiary,disabled,inverse,action,action-hover,primary-on-accent-1,primary-on-accent-2,on-danger,on-success,on-warning,on-info}` | `--mlv-text-primary`, `--mlv-text-secondary`, `--mlv-text-action`, `--mlv-text-primary-on-accent-1` |
| Text — semantic                                | `--mlv-text-{positive,negative,warning,info}`                                                                                                                  | `--mlv-text-positive`, `--mlv-text-negative`, `--mlv-text-warning`, `--mlv-text-info`               |
| Borders                                        | `--mlv-border-{normal,subtle,focus,info,success,warning,error}`                                                                                                | `--mlv-border-normal`, `--mlv-border-focus`                                                         |
| Shadows — raw                                  | `--mlv-shadow-{0..5}`                                                                                                                                          | `--mlv-shadow-1`, `--mlv-shadow-3`                                                                  |
| Shadows — semantic                             | `--mlv-shadow-{flat,raised,floating,overlay,modal}`                                                                                                            | `--mlv-shadow-raised`, `--mlv-shadow-floating`, `--mlv-shadow-modal`                                |
| Typography — size                              | `--mlv-typography-body-{s,m,l}-size`, `--mlv-typography-heading-h{1..6}-size`                                                                                  | `--mlv-typography-body-m-size`, `--mlv-typography-heading-h4-size`                                  |
| Typography — weight/line-height/letter-spacing | `--mlv-typography-body-{s,m,l}-{weight,line-height}`, `--mlv-typography-heading-h{1..6}-{weight,line-height,letter-spacing}`                                   | `--mlv-typography-body-m-weight`, `--mlv-typography-heading-h2-line-height`                         |
| Font family                                    | `--mlv-typography-family-{text,heading,code}`                                                                                                                  | `--mlv-typography-family-text`                                                                      |
| Radius — raw                                   | `--mlv-radius-{xs,s,m,l,xl,2xl,3xl,full}`                                                                                                                      | `--mlv-radius-m`, `--mlv-radius-full`                                                               |
| Radius — semantic                              | `--mlv-radius-{button,input,card,dialog,badge,tag,tooltip,panel}`                                                                                              | `--mlv-radius-card`, `--mlv-radius-badge`                                                           |
| Height                                         | `--mlv-height-{xs,s,m,l,xl}`                                                                                                                                   | `--mlv-height-m`                                                                                    |
| Spacing (single length)                        | `--mlv-spacing-{px,0-5,1,1-5,2,2-5,3,3-5,4,5,6,8,10,12,16}`                                                                                                    | `--mlv-spacing-2` (0.5rem), `--mlv-spacing-4` (1rem)                                                |
| Padding (**`block inline` pair**)              | `--mlv-padding-{xs,s,m,l,xl,2xl}`                                                                                                                              | `--mlv-padding-m` = `--mlv-spacing-2 --mlv-spacing-4`                                               |
| Duration                                       | `--mlv-duration-{instant,fast,normal,slow,slower,sluggish}`                                                                                                    | `--mlv-duration-fast` (100ms), `--mlv-duration-normal` (200ms)                                      |
| Easing                                         | `--mlv-ease-{default,in,out,in-out,linear,spring,spring-soft,spring-strong,out-strong,in-out-strong,drawer,bounce}`                                            | `--mlv-ease-default`, `--mlv-ease-spring`                                                           |
| Transitions — prebuilt                         | `--mlv-transition-{colors,opacity,...}`                                                                                                                        | `--mlv-transition-colors`                                                                           |
| Stroke                                         | `--mlv-stroke-width`                                                                                                                                           | —                                                                                                   |
| Disabled                                       | `--mlv-disabled-opacity`                                                                                                                                       | —                                                                                                   |
| Direction                                      | `--mlv-inline-direction` (`1` LTR / `-1` RTL, re-signed under any `[dir]`)                                                                                     | consume via `mixins.inline-distance()` / `translate-inline()` — see `.claude/rules/rtl.md`          |

### Do NOT use (these tokens do not exist)

- `--mlv-status-info`, `--mlv-status-positive`, `--mlv-status-negative`, `--mlv-status-warning` — use `--mlv-background-{info,success,danger,warning}-1` for fill, or `--mlv-text-{info,positive,negative,warning}` for foreground text
- `--mlv-status-*-pale` — use `--mlv-background-{success,warning,info}-pale` or `--mlv-background-{success,danger,warning,info}-1-pale`
- `--mlv-duration-s`, `--mlv-duration-l` — use `--mlv-duration-fast` / `--mlv-duration-slow`
- `--mlv-easing` (bare alias) — use `--mlv-ease-default`
- `--mlv-shadow-small`, `--mlv-shadow-medium`, `--mlv-shadow-large` — use the numbered (`--mlv-shadow-1..5`) or semantic (`--mlv-shadow-raised/floating/overlay/modal`) forms
- `--mlv-radius-xxl` — use `--mlv-radius-3xl` or `--mlv-radius-full`
- `--mlv-typography-body-m`, `--mlv-typography-body-s` (bare, without `-size` suffix) — use `--mlv-typography-body-m-size` etc. Typography tokens are split into `-size`, `-weight`, `-line-height`.
- `--mlv-inline-start`, `--mlv-inline-end` — do not exist. The only direction token is `--mlv-inline-direction` (a `1`/`-1` sign, not a length).

### `--mlv-padding-*` is a two-value pair — never use it as a single length

Every `--mlv-padding-{xs,s,m,l,xl,2xl}` expands to **two** lengths (`block inline`, e.g. `--mlv-padding-m` → `0.5rem 1rem`). It is only valid as the **entire** value of the `padding` shorthand (or a component alias that is itself only ever fed to `padding:`). Anywhere else the browser either drops the declaration (invalid at computed-value time → `unset`) or silently splits the pair across axes/sides:

| Wrong                                                   | What actually happens                      | Right                                                |
| ------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| `padding-left: var(--mlv-padding-m)`                    | invalid → `0`                              | `padding-left: var(--mlv-spacing-4)`                 |
| `padding-inline: var(--mlv-padding-l)`                  | start `0.75rem`, end `1.5rem` (asymmetric) | `padding-inline: var(--mlv-spacing-6)`               |
| `padding: var(--mlv-padding-xs) var(--mlv-padding-m)`   | 4 values → four different sides            | `padding: var(--mlv-spacing-1) var(--mlv-spacing-4)` |
| `padding: 0 var(--mlv-padding-l) 1rem 4rem`             | 5 values → invalid → `0`                   | `padding: 0 var(--mlv-spacing-6) 1rem 4rem`          |
| `gap: var(--mlv-padding-s)`                             | row-gap `0.375rem`, column-gap `0.75rem`   | `gap: var(--mlv-spacing-3)`                          |
| `top` / `margin-*` / `calc(var(--mlv-padding-m) * 1.5)` | invalid → dropped                          | the matching `--mlv-spacing-*` half                  |

Pick the half you need: block half = first value, inline half = second (`xs` → `1`/`2`, `s` → `1-5`/`3`, `m` → `2`/`4`, `l`/`xl`/`2xl` → `3`/`6`).

Enforced by `yarn nx run styles:check-padding-tokens` (`scripts/check-padding-tokens.mjs`; runs automatically as a `styles:lint` dependency, so CI fails on any misuse). It also tracks aliases — a `--mlv-<block>-padding: var(--mlv-padding-m)` custom property may itself only be fed to `padding:` — and allows the pair as the 4th (`$padding`) argument of `mixins.base()`.

Refer to `libs/styles/src/lib/theme.scss` for the complete token list with light/dark values.

---

## SCSS Map Pattern for Variants/Sizes

For components with many variants, use SCSS maps with `@each` to avoid repetition:

```scss
@use 'sass:map';

$block: mlv-button;

$variants: (
  'primary': (
    'bg': var(--mlv-background-accent-1),
    'bg-hover': var(--mlv-background-accent-1-hover),
    'color': var(--mlv-text-primary-on-accent-1),
  ),
  'secondary': (
    'bg': var(--mlv-background-neutral-1),
    'bg-hover': var(--mlv-background-neutral-1-hover),
    'color': var(--mlv-text-action),
  ),
);

.#{$block} {
  @each $name, $props in $variants {
    &--variant-#{$name} {
      --mlv-btn-bg: #{map.get($props, 'bg')};
      --mlv-btn-bg-hover: #{map.get($props, 'bg-hover')};
      --mlv-btn-text-color: #{map.get($props, 'color')};
    }
  }
}
```

---

## Animation Classes

Use the global animation utility classes from `libs/styles/src/lib/animations.scss` for standard transitions. Never redefine existing keyframes:

```scss
// Apply enter/leave classes to the component
&--entering {
  animation: var(--mlv-dialog-enter-duration, 200ms) ease-out dialog-enter;
}
&--leaving {
  animation: var(--mlv-dialog-leave-duration, 150ms) ease-in dialog-leave;
}
```

---

## Complete Minimal Example

```scss
@use '../../../../styles/src/lib/mixins' as mixins;
@use 'sass:map';

$block: mlv-tag;

$variants: (
  'default': (
    'bg': var(--mlv-background-neutral-1),
    'color': var(--mlv-text-primary),
  ),
  'success': (
    'bg': var(--mlv-background-success-pale),
    'color': var(--mlv-text-positive),
  ),
  'error': (
    'bg': var(--mlv-background-danger-1-pale),
    'color': var(--mlv-text-negative),
  ),
);

.#{$block} {
  @include mixins.base(var(--mlv-typography-family-text), var(--mlv-typography-body-s-size), 0, 0.25rem 0.5rem);

  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: var(--mlv-radius-full);
  background-color: var(--mlv-tag-bg, var(--mlv-background-neutral-1));
  color: var(--mlv-tag-color, var(--mlv-text-primary));
  transition: opacity var(--mlv-duration-fast) var(--mlv-ease-default);

  &__label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0.7;

    &:hover {
      opacity: 1;
    }
  }

  &--disabled {
    opacity: var(--mlv-disabled-opacity);
    pointer-events: none;
  }

  @each $name, $props in $variants {
    &--#{$name} {
      --mlv-tag-bg: #{map.get($props, 'bg')};
      --mlv-tag-color: #{map.get($props, 'color')};
    }
  }
}
```
