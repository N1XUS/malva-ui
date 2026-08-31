---
# Library: styles

`--mlv-background-neutral-2` is the stronger neutral surface token used for
nested and selected surfaces in light, dark, and high-contrast themes.

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including token, theme, animation, mixin, styling, testing, or public API changes.

## Overview

The `styles` library (`@malva-ui/styles`) is the pure SCSS foundation of the Malva UI design system. It provides no Angular components — only CSS custom property design tokens, theme definitions, muted tint variants, density mixins, animation keyframes, and a base reset mixin. All other Malva UI libraries consume these tokens and mixins to build their component styles.

Not every `--mlv-*` variable found elsewhere in the repo is part of this public theme contract. The authoritative theme token source is `libs/styles/src/lib/theme.scss`. Component-scoped adapter variables such as `--mlv-btn-*`, `--form-ctrl-*`, `--mlv-chip-*`, `--mlv-tab-indicator-*`, `--mlv-l-*`, and similar names are local implementation details that often translate theme tokens into component-specific state or layout decisions.

**Package name:** `@malva-ui/styles`
**Source root:** `libs/styles/src`

---

## Token reference — `libs/styles/tokens.md`

**[`tokens.md`](tokens.md) is the authoritative list of every public `--mlv-*` name**, generated from
the SCSS sources: light / dark / high-contrast values per token, the responsive
overrides, the animation override hooks, and a "commonly mistaken names →
correct token" table. It ships inside the published `@malva-ui/core` package as
`styles/tokens.md` (next to `styles/malva-ui.css`): the `core:build-styles` target
copies it to the git-ignored `libs/core/styles/tokens.md`, which `libs/core/ng-package.json`
lists as an asset — so consumers read it from `node_modules/@malva-ui/core/styles/tokens.md`.

Consult it before writing any `var(--mlv-…)`. `var()` falls back silently, so an
invented name never errors — it renders the fallback and quietly stops following
the theme. Four downstream packages shipped `--mlv-color-surface`,
`--mlv-radius-2`, `--mlv-border-1` and `--mlv-error-text-1` that way.

| Target                                       | What it does                                                                                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn nx run styles:generate-tokens`         | Regenerates `tokens.md` from `libs/styles/src/lib/*.scss`. Run after adding, renaming or removing any token.                                                                                               |
| `yarn nx run styles:verify-tokens`           | Fails when `tokens.md` is stale. Safe to gate on.                                                                                                                                                          |
| `yarn nx run styles:check-tokens`            | Scans every `.scss` / `.css` / `.html` under `libs/` and `apps/` and fails on `var(--mlv-…)` names that exist nowhere.                                                                                     |
| `node scripts/check-mlv-tokens.mjs --strict` | Same, but also reports the pre-existing findings tracked in `token-check-baseline.json`.                                                                                                                   |
| `yarn nx run styles:check-padding-tokens`    | Fails on any `var(--mlv-padding-*)` (or alias of one) that is not the whole `padding:` value. Runs as a `styles:lint` dependency, so CI's `run-many -t lint` gates on it. `--json` / `--quiet` flags.      |
| `yarn nx run styles:test`                    | `node --test` over `scripts/check-padding-tokens.spec.mjs` **and** `src/lib/theme-contrast.spec.mjs` — the padding-pair checker plus the WCAG contrast guard below (picked up by CI's `run-many -t test`). |

`tokens.md` is a **generated file** — never hand-edit it. Categories, blurbs and
the mistaken-names table live in `scripts/generate-tokens-md.mjs`; a token that
matches no category makes the generator fail rather than silently drop it.

### What `check-tokens` does and does not flag

It flags a `var(--mlv-x)` whose name is declared nowhere **and** whose first
segment is a namespace `libs/styles` owns (`background`, `radius`, `duration`,
`typography`, a palette family, …). Those are the names a typo makes plausible.

It does **not** flag an undeclared `--mlv-<block>-knob` outside those namespaces.
That is the deliberate override-hook pattern: the `var()` fallback is the
default, and declaring the knob on the element that reads it would _break_ the
override, because an element's own declaration beats an inherited one.

`libs/styles/token-check-baseline.json` records the invented names that already
existed when the check landed, so it gates new mistakes today. Fix one, delete
its entry; never add to the list.

### What `check-padding-tokens` flags

`--mlv-padding-{xs,s,m,l,xl,2xl}` are **two-value `block inline` pairs**
(`--mlv-padding-m` → `0.5rem 1rem`). Outside the whole `padding:` value the
browser drops the declaration (`padding-left`, `top`, `calc()`, 3–5 value
shorthands) or splits the pair across sides (`padding-inline`, `gap`,
`margin: pair 0`). `scripts/check-padding-tokens.mjs` reads the pair set from
`theme.scss` (a new `--mlv-padding-*` pair is covered automatically), then
scans `.scss`/`.css` fully and `.html` `style="…"` / `[style.prop]` bindings,
allowing only:

- `padding: var(--mlv-padding-x)` (trailing `!important` / `var()` fallback ok), incl. a `padding:` key in a Sass map;
- `--mlv-<block>-padding: var(--mlv-padding-x)` — the alias is then tracked the same way (transitively);
- the 4th (`$padding`) argument of `mixins.base()`.

Everything else fails with the offending property, why it breaks, and the two
`--mlv-spacing-*` halves to use instead. No baseline — the tree is clean. Rule
and wrong/right table: `.claude/rules/bem-scss.md`.

### What `theme-contrast.spec.mjs` guards

`src/lib/theme-contrast.mjs` resolves `theme.scss` colour tokens to concrete
sRGB — it understands `#rgb`, `#{$scss-var}` interpolation, `var()` with
fallback, and `color-mix(in srgb, <c> <p>%, <c>)` — and scores WCAG 2.1
contrast. The spec then asserts **exact resolved hex values and exact ratios**
for the action / neutral-interactive pairings, in both themes.

It exists because a token regression is otherwise invisible to CI: jsdom
resolves neither `var()` nor `color-mix()`, so axe's `color-contrast` rule is
disabled in this repo's component specs. Reading `theme.scss` directly needs no
browser.

The bar is **4.5:1 + 0.4 headroom** for text (a pairing at 4.51 fails the spec,
so an ordinary future tweak cannot silently land back under AA) and 3:1 for
non-text parts such as `--mlv-border-focus`.

Two rules the guard encodes, both learned from real failures:

- **A foreground has to survive the whole interactive ramp**, not just the rest
  state. `--mlv-text-action` on `--mlv-background-neutral-1` is the rest state of
  `mlv-button[variant="secondary"]`; `-hover` and `-active` are the same label on
  a lighter fill, and they are what the old dark ramp broke worst.
- **Mixing toward white by a fixed percentage is not a fixed perceptual step.**
  sRGB is steep near black, so the dark ramp's 25%/40% white mix multiplied
  luminance 5.5x/10.8x and stranded every foreground — even plain `#ffffff` body
  text at 4.13:1. The dark hover/active steps now land exactly on
  `--mlv-elevation-bg-3` / `-4`, matching the light ramp's rest→state contrast
  (≈1.2x hover, ≈1.45x active).

`--mlv-elevation-bg-5` is deliberately outside the audited surface set: its only
consumer paints it as a switch track (`libs/core/switch`), never behind text.

---

## Public API

| File                                   | Kind             | Description                                                                                                                                                                                                         |
| -------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/styles/src/lib/index.scss`       | SCSS entry point | `@use`s `theme`, `muted` and `layers`, and applies a global `[class*="mlv"]` reset/default font+color rule wrapped in `@layer mlv.base`. Import this once globally.                                                 |
| `libs/styles/src/lib/theme.scss`       | SCSS             | Core design tokens — all three theme modes (light, dark, high-contrast) in one file. Sections 1–10. Includes responsive typography overrides for 3xl–6xl font-size tokens. All rules emit into `@layer mlv.tokens`. |
| `libs/styles/src/lib/muted.scss`       | SCSS             | Muted/semantic tint tokens — 3 emphasis levels × 8 color families. All rules emit into `@layer mlv.tokens`.                                                                                                         |
| `libs/styles/src/lib/layers.scss`      | SCSS             | Single-line CSS cascade-layer order declaration (`@layer mlv.tokens, mlv.base, mlv.components;`). `@use`d first by every global emitter so the statement is written once, ahead of all layered rules.               |
| `libs/styles/src/lib/overlay.scss`     | SCSS             | Dialog backdrop base look (`.mlv-dialog-backdrop`) — DOM the CDK overlay creates, so no component stylesheet owns it. Emits into `@layer mlv.components`.                                                           |
| `libs/styles/src/lib/density.scss`     | SCSS mixin file  | Density system mixins (`density-tight()`, `density-compact()`, `density-comfortable()`, `density-spacious()`, `density-airy()`, `density-not-comfortable()`).                                                       |
| `libs/styles/src/lib/mixins.scss`      | SCSS mixin file  | `base()`, direction-aware `rtl()` / `ltr()` scopes, logical `margin-inline()` / `padding-inline()`, `inline-distance()` / `translate-inline()` for mirrored transforms, motion-query helpers, staggered entry, and `reduced-motion($block)`. |
| `libs/styles/src/lib/animations.scss`  | SCSS             | Keyframe animation definitions (dialog, popup, drawer, accordion) plus the `--enter` / `--leave` classes that play them. `@use`s `layers` and emits into `@layer mlv.components`.                                   |
| `libs/styles/src/lib/breakpoints.scss` | SCSS mixin file  | Mobile-first breakpoint system — configurable thresholds, viewport mixins (`breakpoint-up`, `breakpoint-down`, `breakpoint-only`), and container query mixins (`container`, `container-up`, `container-down`).      |

### Usage in component stylesheets

```scss
// Import tokens (already global in docs app via styles.scss)
@import '../../../libs/styles/src/lib/index';

// Import SCSS mixins (path relative to consuming file)
@use '../../../../styles/src/lib/mixins' as mixins;
@use '../../../../styles/src/lib/density' as density;

$block: mlv-my-component;

@layer mlv.components {
  .#{$block} {
    @include mixins.base(var(--mlv-typography-family-text), var(--mlv-font-size-m), 0, 0);

    --my-comp-height: var(--mlv-height-m);

    @include density.density-compact {
      --my-comp-height: var(--mlv-height-s);
    }
  }
}
```

---

## CSS Cascade Layers (`layers.scss`)

The library's global stylesheets and component styles are wrapped in CSS cascade
layers so consumers can override them **without specificity wars**.

### Layer order

Declared once, in `layers.scss`:

```scss
@layer mlv.tokens, mlv.base, mlv.components;
```

| Layer            | Contents                                                                                                                                                  | Emitted by                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `mlv.tokens`     | All design-token custom-property declarations (`:root`, `:host`, `[mlvTheme='light']`, `[mlvTheme='dark']`, `[data-theme='high-contrast']`, muted tints). | `theme.scss`, `muted.scss` |
| `mlv.base`       | Global element reset/defaults — the `[class*="mlv"]` font/color/box-sizing rule.                                                                          | `index.scss`               |
| `mlv.components` | All library component BEM styles plus `.mlv-dialog-backdrop`.                                                                                              | Component SCSS, `overlay.scss` |

`layers.scss` is `@use`d first by `theme.scss`, `muted.scss` and `index.scss`.
Because Sass emits a module's CSS only once, the `@layer …;` order statement is
written to the compiled output a **single time**, ahead of every layered rule —
regardless of which global stylesheet a consumer loads first.

### Everything the library ships is layered

There is no unlayered escape hatch. `@keyframes` are not ordered by cascade
layers at all (they resolve by name), but every **rule** the library emits sits
in a layer, including the eight enter/leave classes in `animations.scss`
(`.mlv-dialog--enter` / `--leave`, `.mlv-popup--*`, `.mlv-drawer--*`,
`.mlv-presence--*`). Those are component chrome, not generic utilities: leaving
them unlayered would hand them the override slot that belongs to the consumer,
since an unlayered library rule can only be beaten on source order.

`libs/styles/src/lib/layers.spec.mjs` locks both halves of the contract for
`styles/malva-ui.scss` and `apps/docs/src/styles.scss` — the order statement is
emitted before any `@layer` block, and none of those rules escapes a layer.

> A layer's priority is fixed the first time it is named. Any partial that opens
> `@layer mlv.components { … }` must therefore `@use 'layers';` first, or its
> block would silently make `mlv.components` the **lowest**-priority layer.

### Consumer override contract

> **Unlayered styles always win over layered styles, regardless of specificity.**

A consumer app therefore overrides Malva UI tokens or base defaults simply by
declaring them **without** `@layer` — no `!important`, no specificity inflation:

```scss
// Consumer app global stylesheet — beats mlv.tokens automatically.
:root {
  --mlv-background-accent-1: #7c3aed; // rebrand the primary accent
  --mlv-radius-m: 0.75rem;
}

// Beats the mlv.base reset automatically.
[class*='mlv'] {
  font-family: 'Inter', sans-serif;
}
```

To override a specific **component** BEM rule, declare the consumer rule without
`@layer`; the unlayered rule wins over `mlv.components` without specificity
inflation.

> When adding a **new global stylesheet** that emits token or base CSS, `@use 'layers';`
> first and wrap its rules in the appropriate `@layer mlv.<tokens|base|components>` block.

### Cascade layers and the test environment

jsdom cannot parse `@layer` — it discards the whole stylesheet — so every
`getComputedStyle` assertion against a layered stylesheet would silently read
`''`. `scripts/testing/setup-strip-css-layers.js` runs as a `setupFiles` entry in
every project's `vite.config.mts` and flattens layers out of any CSS entering a
`<style>` element; specs that inspect **compiled CSS text** instead flatten it
themselves with `stripCssLayersFromText` from `@malva-ui/internal-testing`. The
shipped CSS keeps its layers — see `.claude/projects/best-practices.md`.

---

## Theme System (`theme.scss`)

### Activation

| Selector                               | Mode            |
| -------------------------------------- | --------------- |
| `:root`, `:host`, `[mlvTheme='light']` | Light (default) |
| `[mlvTheme='dark']`                    | Dark            |
| `[data-theme="high-contrast"]`         | High-contrast   |

Dark mode is opt-in through `[mlvTheme='dark']`; `theme.scss` does not currently expose an automatic `prefers-color-scheme` selector. High-contrast mode overrides a smaller subset of the same token names.

---

### Section 1 — Color Palettes

8 families × 11 stops (`50` → `950`). SCSS variables act as source of truth; CSS custom properties mirror them inside the theme selectors.

| Family      | SCSS prefix                | Description                       |
| ----------- | -------------------------- | --------------------------------- |
| `primary`   | `$mlv-palette-primary-*`   | Cornflower blue `#5770cb` at 500  |
| `secondary` | `$mlv-palette-secondary-*` | Neutral gray `#ebebeb` at 200     |
| `accent`    | `$mlv-palette-accent-*`    | Coral-orange `#fd774d` at 500     |
| `neutral`   | `$mlv-palette-neutral-*`   | Achromatic slate `#737373` at 500 |
| `success`   | `$mlv-palette-success-*`   | Emerald green                     |
| `warning`   | `$mlv-palette-warning-*`   | Amber                             |
| `danger`    | `$mlv-palette-danger-*`    | Rose red                          |
| `info`      | `$mlv-palette-info-*`      | Sky blue                          |

Token pattern: `--mlv-palette-{family}-{stop}` e.g. `--mlv-palette-primary-500`

---

### Section 2 — Semantic Backgrounds

| Group                 | Tokens                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Base surfaces         | `--mlv-background-base`, `-subtle`, `-raised`, `-overlay`, `-sunken`                                                                 |
| Primary accent        | `--mlv-background-accent-1`, `-hover`, `-active`, `-pale`, `-pale-hover`                                                             |
| Secondary accent      | `--mlv-background-accent-2`, `-hover`, `-active`, `-pale`, `-pale-hover`                                                             |
| Selected              | `--mlv-background-selected`, `-hover` — its own state token; a persistent selection never borrows the pressed `-active` fill (SF-R1) |
| Neutral interactive   | `--mlv-background-neutral-1`, `-hover`, `-active`, `--mlv-background-disabled`                                                       |
| Danger                | `--mlv-background-danger-1`, `-hover`, `-active`, `-pale`, `-pale-hover`                                                             |
| Success               | `--mlv-background-success-1`, `-hover`, `-active`, `-pale`, `-pale-hover`; alias `--mlv-background-success-pale`                     |
| Warning               | `--mlv-background-warning-1`, `-hover`, `-active`, `-pale`, `-pale-hover`; alias `--mlv-background-warning-pale`                     |
| Info                  | `--mlv-background-info-1`, `-hover`, `-active`, `-pale`, `-pale-hover`; alias `--mlv-background-info-pale`                           |
| Elevation (dark mode) | `--mlv-elevation-bg-1` … `--mlv-elevation-bg-5`                                                                                      |

All interactive states use `color-mix(in srgb, …)` derivations — no hardcoded hover colors.

---

### Section 3 — Text Colors

| Token                            | Purpose                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `--mlv-text-primary`             | Main body text                                                                                                         |
| `--mlv-text-secondary`           | Supporting text                                                                                                        |
| `--mlv-text-tertiary`            | Placeholder / quiet text                                                                                               |
| `--mlv-text-disabled`            | Disabled text                                                                                                          |
| `--mlv-text-inverse`             | Text on dark/accent surfaces                                                                                           |
| `--mlv-text-action`              | Links, interactive text                                                                                                |
| `--mlv-text-action-hover`        | Link hover                                                                                                             |
| `--mlv-text-primary-on-accent-1` | Text on primary button                                                                                                 |
| `--mlv-text-primary-on-accent-2` | Text on accent-2 button                                                                                                |
| `--mlv-text-on-danger`           | Text on danger solid background                                                                                        |
| `--mlv-text-on-success`          | Text on success solid background                                                                                       |
| `--mlv-text-on-warning`          | Text on warning solid background                                                                                       |
| `--mlv-text-on-info`             | Text on info solid background                                                                                          |
| `--mlv-text-on-selected`         | Text on a persistently-selected surface — pairs with `--mlv-background-selected` (SF-R1); resolves `--mlv-text-action` |
| `--mlv-text-positive`            | Success message text                                                                                                   |
| `--mlv-text-negative`            | Error message text                                                                                                     |
| `--mlv-text-warning`             | Warning message text                                                                                                   |
| `--mlv-text-info`                | Info message text                                                                                                      |
| `--mlv-text-heading`             | H1–H3 headings                                                                                                         |
| `--mlv-text-label`               | Form labels                                                                                                            |
| `--mlv-text-hint`                | Hint / description text                                                                                                |
| `--mlv-text-caption`             | Captions, metadata                                                                                                     |
| `--mlv-text-error`               | Inline validation errors                                                                                               |
| `--mlv-text-placeholder`         | Input placeholders                                                                                                     |

`--mlv-text-action` is `primary-600` in light and `primary-300` softened 15%
toward white in dark. Both stops are contrast-driven, not decorative.
`primary-400` (dark) failed AA (4.45:1 on the dark rest fill) and was lifted
to `primary-300`. Light briefly moved `primary-600` → `primary-700` when
`primary-600` measured 4.07:1 on the pre-SF-R5 pressed-neutral fill
(`#cccccc`); once SF-R5 lightened `--mlv-background-neutral-1-active` to
`#e5e5e5`, `primary-600` cleared AA with margin again (6.00:1 rest / 5.19:1
pressed), and the owner asked for it back — **`primary-600` is the current,
correct value**, not a transitional one. `mlv-button[variant="secondary"]`,
`mlv-segmented`, `mlv-tab-item`, `mlv-link` and `mlv-breadcrumb` all paint
this token. Do not move it without re-running `styles:test`.

`--mlv-border-focus` deliberately stays on `primary-400` in dark: it is a
non-text UI part owing only 3:1, and holding it there keeps the brand hue on the
focus ring while the label lightens.

---

### Section 4 — Border Colors

`--mlv-border-subtle`, `-normal`, `-strong`, `-focus`, `-error`, `-success`, `-warning`, `-info`

---

### Section 5 — Elevation & Shadows

5 shadow levels: `--mlv-shadow-0` … `--mlv-shadow-5`
Dark mode uses higher-opacity shadows. Each `--mlv-elevation-bg-{1..5}` rung has a declared role, not a uniform light/dark split: in light, rung 1 (`flush` — canvas-level, border only) resolves `--mlv-background-base`, while rungs 2–5 (card/dialog/drawer, popup/toast/form-control, drawers/side-overlays, switch-thumb-only) all stay at the `--mlv-background-raised` ceiling and express depth via the shadow alias instead; in dark, each rung is its own stepped grey. `--mlv-elevation-bg-5` is deliberately outside the WCAG-audited surface set — its only consumer paints it as a switch track, never behind text.

---

### Section 6 — Border Radius

| Token               | Value      | Use                                |
| ------------------- | ---------- | ---------------------------------- |
| `--mlv-radius-xs`   | `0.125rem` | Micro elements                     |
| `--mlv-radius-s`    | `0.25rem`  | Micro elements                     |
| `--mlv-radius-m`    | `0.375rem` | Tooltip, popover row radius        |
| `--mlv-radius-l`    | `0.5rem`   | Buttons, inputs, panels (default)  |
| `--mlv-radius-xl`   | `0.75rem`  | Cards                              |
| `--mlv-radius-2xl`  | `1rem`     | Dialogs                            |
| `--mlv-radius-3xl`  | `1.5rem`   | Large panels                       |
| `--mlv-radius-full` | `9999px`   | Pills, circles, badges, tags/chips |

Component aliases (RR-R1/RR-R2 — one role token per component, no per-density/per-size override):

| Alias                  | Resolves to   | Components                                                              |
| ---------------------- | ------------- | ----------------------------------------------------------------------- |
| `--mlv-radius-button`  | `-l` (8px)    | `mlv-button`                                                            |
| `--mlv-radius-input`   | `-l` (8px)    | `mlv-form-control-wrapper` and every text-style control built on it     |
| `--mlv-radius-card`    | `-xl` (12px)  | `mlv-card` — fixed across all three `size` presets, not scaled per size |
| `--mlv-radius-dialog`  | `-2xl` (16px) | `mlv-dialog` at the `md+` breakpoint                                    |
| `--mlv-radius-badge`   | `full`        | `mlv-badge`                                                             |
| `--mlv-radius-tag`     | `full`        | `mlv-chip` (was `-l`, 8px, before the harmonization program)            |
| `--mlv-radius-tooltip` | `-m` (6px)    | `mlv-tooltip`                                                           |
| `--mlv-radius-panel`   | `-l` (8px)    | `mlv-dropdown-panel`, `--mlv-popover-surface-radius`                    |

`--mlv-radius-button`/`-input` used to scale per density (`xs`→`-s`, comfortable→`-l`, compact→`-m`, spacious→`-xl`, airy→`-2xl`); RR-R2 fixed both at `-l` for every density.

---

### Popover list surfaces

One vocabulary for every popover that presents a list of rows. `mlv-select` and
`mlv-combobox` are the reference look; `mlv-dropdown-panel` (so also
`mlv-autocomplete` and `mlv-pagination`), `mlv-menu` and the `mlv-breadcrumb`
overflow all resolve the same tokens.

| Token                          | Resolves to                                   | Use                                        |
| ------------------------------ | --------------------------------------------- | ------------------------------------------ |
| `--mlv-popover-surface-radius` | `--mlv-radius-panel` → `--mlv-radius-l` (8px) | The floating surface's corner radius       |
| `--mlv-popover-inset`          | `--mlv-spacing-1` (4px)                       | Gap between surface edge and the first row |
| `--mlv-popover-item-padding`   | `--mlv-spacing-2` (8px)                       | Row padding, uniform on both axes          |
| `--mlv-popover-item-radius`    | `--mlv-radius-m` (6px)                        | Row corner radius                          |
| `--mlv-popover-item-bg-hover`  | `--mlv-background-neutral-1`                  | Row hover **and** keyboard-active fill     |

These exist because the surfaces are separate ARIA patterns — a listbox of values
versus a menu of commands — that must stay separate components while looking
identical. Left to per-component styling they drifted: two surface radii (8px vs
12px), two row radii, one row padding that expanded to an asymmetric
`4px 8px 8px 16px`, and different greys for hover versus keyboard-active.

Do not point `mlv-list-item` at these tokens. Its own defaults already carry
these values and it is used well outside popovers; the dependency runs the other
way — popovers stop overriding the primitive.

Consume the tokens directly (`padding: var(--mlv-popover-item-padding)`), never
by re-deriving the underlying spacing/radius token.

---

### Section 7 — Typography

**Font families:** `--mlv-font-family-sans`, `-mono`, `-code`, `-display` (`-code` prefers Fira Code and JetBrains Mono, then system monospace fallbacks)
**Semantic aliases:** `--mlv-typography-family-text`, `-heading`, `-code`

**Font sizes:** `--mlv-font-size-xs` (11px) … `--mlv-font-size-6xl` (48px) — 10 steps

**Font weights:** `--mlv-font-weight-normal` (400), `-medium` (500), `-semibold` (600), `-bold` (700)

**Line heights:** `--mlv-line-height-tight` … `-loose`

**Letter spacing:** `--mlv-letter-spacing-tight` … `-widest`

**Semantic text scales:**

- Headings: `--mlv-typography-heading-h{1-6}-{size,weight,line-height,letter-spacing}`
- Body: `--mlv-typography-body-{l,m,s}-{size,weight,line-height}`
- UI controls: `--mlv-typography-ui-{l,m,s}-{size,weight,line-height}`
- Supporting: `--mlv-typography-{label,hint,caption,code,error}-*`

---

### Section 8 — Spacing & Sizing

**Spacing scale:** base steps `--mlv-spacing-0` … `--mlv-spacing-16` plus half-steps `--mlv-spacing-px`, `--mlv-spacing-0-5`, `--mlv-spacing-1-5`, `--mlv-spacing-2-5`, `--mlv-spacing-3-5`

**Component heights:** `--mlv-height-xs` (1.75rem / 28px) · `-s` (2.25rem / 36px) · `-m` (2.75rem) · `-l` (3.25rem) · `-xl` (3.75rem) · `-2xl` (4.25rem, no consumer — do not introduce one)

**Icon-in-container sizing:** `--mlv-icon-in-container-ratio` (`0.45`, CH-R4) — the fraction of the container's height a lone glyph in a shaped container (icon-only button, `mlv-button-close`, tile drag handle) sizes to; a label-adjacent glyph instead sizes in `em` off the text via `--mlv-icon-font-size`, unaffected by this ratio.

**Semantic padding:** `--mlv-padding-xs` · `-s` · `-m` · `-l` · `-xl` · `-2xl` (vertical/horizontal shorthand pairs)

---

### Section 9 — Motion & Animation

**Durations:** `--mlv-duration-instant` (0ms) · `-fast` (100ms) · `-normal` (200ms) · `-slow` (300ms) · `-slower` (400ms) · `-sluggish` (600ms)

**Easing:** `--mlv-ease-default` · `-in` · `-out` · `-in-out` · `-spring` · `-linear`

**Transition property lists:** `--mlv-transition-colors` · `-opacity` · `-transform` · `-shadow` · `-all`

**Z-index:** `--mlv-z-base` (0) · `-raised` (10) · `-dropdown` (100) · `-sticky` (200) · `-overlay` (300) · `-modal` (400) · `-popover` (500) · `-toast` (600) · `-tooltip` (700) · `-max` (9999)

---

### Section 10 — Stroke & Focus

| Token                       | Value                  | Description                 |
| --------------------------- | ---------------------- | --------------------------- |
| `--mlv-stroke-width`        | `0.0625rem`            | 1px — default border        |
| `--mlv-stroke-width-medium` | `0.125rem`             | 2px — focus ring            |
| `--mlv-stroke-width-thick`  | `0.1875rem`            | 3px — high-contrast focus   |
| `--mlv-focus-ring`          | `box-shadow` shorthand | Focus ring via `box-shadow` |
| `--mlv-focus-ring-offset`   | `0.125rem`             | Focus ring offset           |
| `--mlv-disabled-opacity`    | `0.4`                  | Disabled element opacity    |
| `--mlv-hover-overlay`       | `0.06`                 | Hover scrim alpha           |
| `--mlv-active-overlay`      | `0.12`                 | Active scrim alpha          |
| `--mlv-focus-overlay`       | `0.08`                 | Focus scrim alpha           |

> High-contrast mode overrides `--mlv-stroke-width` to `0.125rem`, `-medium` to `0.1875rem`, and `-thick` to `0.25rem` for wider, more visible lines.

---

### Section 11 — Direction

| Token                     | Value        | Description                        |
| ------------------------- | ------------ | ---------------------------------- |
| `--mlv-inline-direction`  | `1` / `-1`   | Sign of the inline axis            |

`1` on `:root` and `[dir='ltr']`, `-1` on `[dir='rtl']`. The `[dir]` rules sit
outside the `:root` block so they apply at any depth — a mirrored subtree inside
an LTR document re-signs the axis for its own descendants.

Exists because `transform` has no logical form. Consume it through
`mixins.inline-distance()` rather than inlining the `calc()`; see
[Direction Mixins](#direction-mixins-mixinsscss).

---

## Muted Tints (`muted.scss`)

3 emphasis levels × 8 color families, each providing a `bg / text / border` triplet. Backgrounds are derived with `color-mix()`.

**Token pattern:** `--mlv-muted-{family}-{bg|text|border}-{1|2|3}`

**Families:** `default` · `primary` · `secondary` · `accent` · `success` · `warning` · `danger` · `info`

```scss
// Usage in component
.mlv-badge--muted {
  background-color: var(--mlv-muted-primary-bg-2);
  color: var(--mlv-muted-primary-text-2);
  border-color: var(--mlv-muted-primary-border-2);
}
```

---

## Density Mixins (`density.scss`)

Five density levels controlled via BEM modifier classes on the element itself or an ancestor. Matching is selector-based, not true DOM-proximity-aware: when multiple density ancestors can match, the later compiled rule wins rather than the nearest ancestor automatically winning.

| Mixin                       | Activated by                                                 |
| --------------------------- | ------------------------------------------------------------ |
| `density-tight()`           | `[class*="--tight"]` ancestor or self                        |
| `density-compact()`         | `[class*="--compact"]` ancestor or self                      |
| `density-comfortable()`     | `[class*="--comfortable"]` ancestor or self (explicit reset) |
| `density-spacious()`        | `[class*="--spacious"]` ancestor or self                     |
| `density-airy()`            | `[class*="--airy"]` ancestor or self                         |
| `density-not-comfortable()` | Any non-default density                                      |

```scss
@use '../../../../styles/src/lib/density' as density;

.mlv-button {
  --mlv-btn-height: var(--mlv-height-m); // comfortable default

  @include density.density-tight {
    --mlv-btn-height: var(--mlv-height-xs);
  }
  @include density.density-compact {
    --mlv-btn-height: var(--mlv-height-s);
  }
  @include density.density-spacious {
    --mlv-btn-height: var(--mlv-height-l);
  }
  @include density.density-airy {
    --mlv-btn-height: var(--mlv-height-xl);
  }
}
```

---

## Base Mixin (`mixins.scss`)

```scss
@mixin base($font-family: var(--mlv-typography-family-text), $font-size: var(--mlv-typography-body-l), $margin: 0, $padding: 0);
```

Sets `box-sizing: border-box` on host and all descendants (`*`), resets margin/padding, and sets font-family/font-size. Use as the first declaration in every component's block selector.

> Note: the current source default is `var(--mlv-typography-body-l)`, but `theme.scss` defines `--mlv-typography-body-l-size`, `-weight`, and `-line-height` rather than a `--mlv-typography-body-l` shorthand token. When using `base()`, prefer passing an explicit font-size token such as `var(--mlv-font-size-m)` or `var(--mlv-font-size-l)` until that source mismatch is normalized.

```scss
@use '../../../../styles/src/lib/mixins' as mixins;

.mlv-my-component {
  @include mixins.base(var(--mlv-typography-family-text), var(--mlv-font-size-m), 0, 0);
}
```

## Direction Mixins (`mixins.scss`)

The direction helpers keep component styles and keyboard behavior aligned with
the document's `dir` attribute. Prefer logical properties for symmetric inline
spacing, and use `rtl()` / `ltr()` only when a visual rule genuinely differs
between directions.

```scss
@use '../../../../styles/src/lib/mixins' as mixins;

.mlv-my-component {
  @include mixins.padding-inline(var(--mlv-spacing-2), var(--mlv-spacing-3));

  @include mixins.rtl {
    transform: scaleX(-1);
  }
}
```

`rtl()` and `ltr()` scope to `[dir='rtl'] &` and `[dir='ltr'] &` respectively;
`margin-inline($start, $end: $start)` and `padding-inline($start, $end: $start)`
emit the corresponding logical start/end declarations.

### Prefer native logical properties

For anything with a logical equivalent, write the logical property directly —
the browser mirrors it and no mixin is involved:

| Physical | Logical |
| -------- | ------- |
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` |
| `padding-left` / `padding-right` | `padding-inline-start` / `padding-inline-end` |
| `left` / `right` | `inset-inline-start` / `inset-inline-end` |
| `border-left` / `border-right` | `border-inline-start` / `border-inline-end` |
| `border-top-left-radius` (and the other three corners) | `border-start-start-radius` (`-start-end-`, `-end-start-`, `-end-end-`) |
| `text-align: left` / `right` | `text-align: start` / `end` |

Two cases deliberately stay **physical**:

- **JS-fed coordinates measured with `offsetLeft`/`offsetTop`.** `offsetLeft`
  is a physical measurement in both directions, so the CSS that consumes it
  must be physical too — `left: var(--mlv-tab-indicator-left)` and
  `left: var(--mlv-segmented-indicator-left)`. Making these logical would
  mirror an already-correct value. The component instead re-measures on a
  direction flip (see `MlvRtlService.elementDirection()`).
- **Centering pairs** — `left: 50%` with `transform: translateX(-50%)` is
  already direction-agnostic; converting the inset alone would break it.

### `inline-distance($distance)` / `translate-inline($distance)`

`transform` has no logical form. Rather than duplicating a whole transform list
under `rtl()`, multiply the inline component by `--mlv-inline-direction`
(`+1` in LTR, `-1` in RTL — declared in `theme.scss` on `:root` and re-declared
on `[dir='ltr']` / `[dir='rtl']`, so it follows a **scoped** `[dir]` at any
depth):

```scss
.mlv-my-component {
  // composes with the rest of the transform list
  transform: translateX(mixins.inline-distance(-0.25rem)) scale(0.98);
}

.mlv-my-drawer {
  // sugar for a lone inline translation
  @include mixins.translate-inline(-100%);
}
```

Used by the sidebar (collapse slide, label nudge, status-dot offset) and the
switch thumb travel.

---

## Theme Token Consumption Across Libraries

This section is based on a cross-check of all `--mlv-*` usages under `libs/` outside `libs/styles/`, filtered against the token names actually defined in `libs/styles/src/lib/theme.scss`.

- **Theme-defined tokens available in `theme.scss`:** 334
- **Theme-defined tokens actively consumed outside `libs/styles`:** 125
- **Methodology:** only theme-defined tokens are counted here. Component-local adapter variables are excluded from the token inventory even when they wrap theme tokens.

### Architectural Usage by CSS Property Family

| Property family                                                                | Theme token role                                                                            | Architecture-wide purpose                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color`                                                                        | `--mlv-text-*`, plus a small number of palette/on-accent tokens                             | The text layer is the main semantic contract for readability. These tokens define content hierarchy, secondary and muted copy, interactive text, and guaranteed contrast on filled surfaces. Across the system they separate primary content, supporting text, disabled states, and semantic feedback text without components hardcoding color values.                 |
| `background`, `background-color`                                               | `--mlv-background-*`, `--mlv-elevation-bg-*`                                                | Background tokens express the surface model of the design system. They distinguish base app surfaces from raised containers, overlays, and semantic fills for selected, emphasized, or status-bearing UI. Components rely on these tokens to communicate depth and action priority consistently across containers, overlays, and controls.                             |
| `border`, `border-*`, `outline`                                                | `--mlv-border-*`                                                                            | Border tokens provide the structural edge language of the system: quiet dividers, normal container boundaries, stronger emphasis, validation states, and focus affordances. At the architecture level, these tokens carry separation and affordance rather than decoration, which keeps cards, drawers, tables, form wrappers, tabs, and focus rings visually aligned. |
| `box-shadow`                                                                   | `--mlv-shadow-*`                                                                            | Shadow tokens implement depth escalation. They are primarily used to distinguish neutral containers from floating or elevated UI and to strengthen hover or active elevation where appropriate. This keeps depth cues consistent between cards, action bars, overlays, notifications, drawers, toasts, and other raised surfaces.                                      |
| `padding`, `gap`, spacing-related properties                                   | `--mlv-spacing-*`, `--mlv-padding-*`                                                        | Spacing tokens define the shared internal rhythm of the component library. They control control density, label/content separation, panel padding, and inline element spacing so that forms, lists, overlays, feedback components, and composite layouts feel part of one system rather than individually tuned widgets.                                                |
| `font-size`, `font-weight`, `line-height`, `letter-spacing`, `font-family`     | `--mlv-font-*`, `--mlv-typography-*`, `--mlv-line-height-*`, `--mlv-letter-spacing-*`       | Typography tokens provide semantic text sizing and emphasis rules. The architectural role is to keep headings, labels, metadata, body copy, and UI affordances on a shared scale. In practice, libraries lean most heavily on primitive font sizes and heading tokens today, while a subset still needs migration away from older shorthand names.                     |
| `border-radius`                                                                | `--mlv-radius-*`                                                                            | Radius tokens define the shape language of the system, from compact inputs to large containers and fully pill-shaped controls. They keep shape semantics predictable: small radii for interactive chrome, larger radii for surfaces, and full radii for badges, chips, and circular elements.                                                                          |
| `transition`, `transition-duration`, `transition-timing-function`, `animation` | `--mlv-duration-*`, `--mlv-ease-*`                                                          | Motion tokens standardize how quickly UI responds and how it eases between states. Their system role is to make state changes, entrances, exits, hover responses, and density changes feel coordinated across the library instead of each component inventing its own timing language.                                                                                 |
| `opacity`                                                                      | `--mlv-disabled-opacity`                                                                    | Opacity tokens communicate disabled or temporarily unavailable UI in a consistent way. This is the shared semantic for de-emphasis rather than an ad hoc per-component visual tweak.                                                                                                                                                                                   |
| size adapters (`height`, `width`, control sizing)                              | `--mlv-height-*` and related scale tokens, usually consumed through local adapter variables | Height tokens function as the base sizing scale for controls and compact surfaces. Most libraries do not bind them directly on the final element; instead they map them into component-local adapter variables first. Architecturally, that makes the theme scale stable while letting each component translate the shared size scale into its own layout mechanics.   |

### Direct Usage Hotspots

When looking only at direct property assignments, the most common property families are:

| Property                          | Direct usages | Architectural reading                                                                            |
| --------------------------------- | ------------: | ------------------------------------------------------------------------------------------------ |
| `color`                           |            91 | The theme is used most heavily to drive semantic text hierarchy and readable interactive states. |
| `transition`                      |            35 | Motion consistency is a shared concern across many interactive libraries.                        |
| `padding`                         |            27 | Internal spacing is standardized at the theme level rather than component-by-component.          |
| `font-size`                       |            24 | Typography scale is reused broadly, especially for UI labels and headings.                       |
| `border-radius`                   |            23 | Shape language is widely centralized in the theme.                                               |
| `background-color` + `background` |            40 | Surface tiering and action emphasis are one of the main responsibilities of theme tokens.        |
| `box-shadow`                      |            19 | Elevation is consistently tokenized instead of hardcoded.                                        |
| `gap`                             |            19 | Layout rhythm between inline or stacked child elements is standardized.                          |
| `animation`                       |            18 | Enter/leave and feedback motion mostly inherits the shared timing model.                         |

### Theme Adapter Pattern

A recurring implementation pattern across the libraries is:

1. Start from a stable theme token such as a spacing, height, radius, color, or duration token.
2. Map it into a component-scoped adapter variable such as `--mlv-btn-height`, `--form-ctrl-height`, or `--mlv-chip-bg`.
3. Let component state, density, or variants mutate the local adapter while keeping the theme token untouched.

This pattern is intentional. It lets the design system keep a stable global contract while giving individual libraries room to express state changes, size variants, or local layout rules without inventing new global theme tokens.

### Legacy and Non-Theme Names Still Present

The repo still contains older `--mlv-*` names outside `theme.scss`. These should **not** be documented as theme tokens:

- Motion shorthands such as `--mlv-duration-s`, `--mlv-duration-m`, and `--mlv-easing`
- Old typography shorthands such as `--mlv-typography-body-s`, `--mlv-typography-body-m`, `--mlv-typography-body-l`, `--mlv-typography-ui-xs`, and `--mlv-typography-ui-2xs`
- Older semantic names such as `--mlv-status-*`, `--mlv-shadow-small`, `--mlv-shadow-medium`, `--mlv-shadow-popup`, `--mlv-background-elevation-*`, `--mlv-color-secondary`, and `--mlv-color-on-surface`
- Component-only variables such as button, chip, badge, loader, slider, popup, tab-indicator, and form-control adapter tokens

Treat those names as migration candidates or local implementation details, not as part of `@malva-ui/styles` public theme API.

---

## Breakpoints (`breakpoints.scss`)

**File:** `libs/styles/src/lib/breakpoints.scss`

Mobile-first responsive breakpoint system. All mixins and variables are configurable at app level via `@use ... with (...)`.

### Configurable Variables

| Variable             | Default  | Description                         |
| -------------------- | -------- | ----------------------------------- |
| `$mlv-breakpoint-md` | `768px`  | Min-width for the tablet (md) tier  |
| `$mlv-breakpoint-lg` | `1200px` | Min-width for the desktop (lg) tier |

Override at app level:

```scss
@use '../../../../styles/src/lib/breakpoints' as bp with (
  $mlv-breakpoint-md: 900px,
  $mlv-breakpoint-lg: 1440px
);
```

### Viewport Mixins

#### `breakpoint-up($name)`

Applies styles at the given breakpoint and above (min-width). For `sm`, no media query is emitted — styles apply unconditionally.

```scss
.my-component {
  padding: 1rem;
  @include bp.breakpoint-up(md) {
    padding: 1.5rem;
  }
  @include bp.breakpoint-up(lg) {
    padding: 2rem;
  }
}
```

#### `breakpoint-down($name)`

Applies styles below the given breakpoint (max-width: `bp - 0.02px`). Cannot be called with `sm`.

```scss
.my-component__mobile-only {
  @include bp.breakpoint-down(md) {
    display: block;
  }
}
```

#### `breakpoint-only($name)`

Applies styles only within the given breakpoint range:

- `sm`: 0 to md - 0.02px
- `md`: md to lg - 0.02px
- `lg`: lg and above (no max)

```scss
.my-component {
  @include bp.breakpoint-only(md) {
    font-size: 1.125rem;
  }
}
```

### Container Query Mixins

#### `container($name)`

Marks an element as a container query context (`container-type: inline-size`).

```scss
.mlv-pagination {
  @include bp.container(pagination);
}
```

#### `container-up($width, $name?)`

Applies styles when the container is at least `$width` wide.

```scss
@include bp.container-up(500px, pagination) { ... }
@include bp.container-up(40rem) { ... }  // unnamed container
```

#### `container-down($width, $name?)`

Applies styles when the container is narrower than `$width`.

```scss
@include bp.container-down(400px, pagination) { ... }
```

---

## Responsive Typography (`theme.scss`)

Font-size tokens are split into two groups:

**Fixed across all viewports** — `xs`, `s`, `m`, `l`, `xl`, `2xl`

**Responsive (scale up at md and lg)** — `3xl`, `4xl`, `5xl`, `6xl`

| Token                 | sm (mobile base) | md (≥768px)       | lg (≥1200px)      |
| --------------------- | ---------------- | ----------------- | ----------------- |
| `--mlv-font-size-3xl` | `1.25rem` (20px) | `1.375rem` (22px) | `1.5rem` (24px)   |
| `--mlv-font-size-4xl` | `1.5rem` (24px)  | `1.625rem` (26px) | `1.875rem` (30px) |
| `--mlv-font-size-5xl` | `1.75rem` (28px) | `2rem` (32px)     | `2.25rem` (36px)  |
| `--mlv-font-size-6xl` | `2.25rem` (36px) | `2.5rem` (40px)   | `3rem` (48px)     |

The `--mlv-typography-heading-h1/h2/h3` tokens reference `5xl`, `4xl`, and `3xl` respectively, so heading sizes automatically scale at the breakpoints above. Body and UI control sizes (`xs`–`2xl`) stay fixed.

---

## Animations (`animations.scss`)

Keyframe definitions for overlay components, plus the classes that play them.
Imported by `libs/core/styles/malva-ui.scss` and `apps/docs/src/styles.scss`,
in both cases ahead of `index` — which is why this partial `@use`s `layers`
itself before opening `@layer mlv.components`.

Every class rule is gated behind `@media (prefers-reduced-motion: no-preference)`;
the reduce path is each component's own `mixins.reduced-motion()` include.

| Component | Enter class          | Leave class          | Duration tokens                                               |
| --------- | -------------------- | -------------------- | ------------------------------------------------------------- |
| Dialog    | `.mlv-dialog--enter` | `.mlv-dialog--leave` | `--mlv-dialog-enter-duration` / `--mlv-dialog-leave-duration` |
| Popup     | `.mlv-popup--enter`  | `.mlv-popup--leave`  | `--mlv-popup-enter-duration` / `--mlv-popup-leave-duration`   |
| Drawer    | `.mlv-drawer--enter` | `.mlv-drawer--leave` | `--mlv-drawer-enter-duration` / `--mlv-drawer-leave-duration` |
| Accordion | —                    | —                    | Raw keyframes `mlv-accordion--enter` / `mlv-accordion--leave` |

---

## Dependencies

None. Pure SCSS — no Angular framework dependencies, no npm runtime dependencies, no external packages.

---

## File Structure

```
libs/styles/
  tokens.md                    — GENERATED token reference (styles:generate-tokens)
  token-check-baseline.json    — invented --mlv-* names predating styles:check-tokens
  src/
    index.ts          — (empty, no Angular exports)
    lib/
      index.scss      — entry point: @use 'theme'; @use 'muted';
      theme.scss      — core tokens: palettes, backgrounds, text, borders,
                        elevation, radius, typography, spacing, motion,
                        stroke/focus — all 3 theme modes; @uses breakpoints
                        for responsive 3xl–6xl font-size overrides
      theme-contrast.mjs      — resolves theme.scss colours (var / color-mix /
                                SCSS interpolation) and scores WCAG contrast
      theme-contrast.spec.mjs — WCAG AA guard over the action + neutral
                                interactive pairings, both themes (styles:test)
      muted.scss      — muted tint triplets (bg/text/border × 3 levels × 8 families)
      density.scss    — density SCSS mixins (tight/compact/comfortable/spacious/airy)
      mixins.scss     — base() reset/font mixin
      animations.scss — overlay keyframe animations
      breakpoints.scss — mobile-first breakpoint variables and viewport/container mixins
```
