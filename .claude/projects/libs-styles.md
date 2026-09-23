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

| Target                                       | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn nx run styles:generate-tokens`         | Regenerates `tokens.md` from `libs/styles/src/lib/*.scss`. Run after adding, renaming or removing any token.                                                                                                                                                                                                                                                                                                                                             |
| `yarn nx run styles:verify-tokens`           | Fails when `tokens.md` is stale. Safe to gate on.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `yarn nx run styles:check-tokens`            | Scans every `.scss` / `.css` / `.html` under `libs/` and `apps/` and fails on `var(--mlv-…)` names that exist nowhere.                                                                                                                                                                                                                                                                                                                                   |
| `node scripts/check-mlv-tokens.mjs --strict` | Same, but also reports the pre-existing findings tracked in `token-check-baseline.json`.                                                                                                                                                                                                                                                                                                                                                                 |
| `yarn nx run styles:check-padding-tokens`    | Fails on any `var(--mlv-padding-*)` (or alias of one) that is not the whole `padding:` value. Runs as a `styles:lint` dependency, so CI's `run-many -t lint` gates on it. `--json` / `--quiet` flags.                                                                                                                                                                                                                                                    |
| `yarn nx run styles:test`                    | `node --test` over eight spec files — `scripts/check-padding-tokens.spec.mjs`, `src/lib/theme-contrast.spec.mjs`, `src/lib/tone-contrast.spec.mjs`, `src/lib/theme-scopes.spec.mjs`, `src/lib/mixins.spec.mjs`, `src/lib/fluid-type.spec.mjs`, `src/lib/layers.spec.mjs`, `src/lib/sticky-inline-inset.spec.mjs` (picked up by CI's `run-many -t test`). The target **enumerates its specs**, so a new one must be named in both `command` and `inputs`. |

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

### Solid tone fills (#302)

- Scope: the six labelled fills `--mlv-background-{success,warning,info,danger}-1`
  / `--mlv-background-accent-{1,2}`, each with `-hover` / `-active`.
- `theme-contrast.spec.mjs` asserts (light, dark, HC, HC over dark): every state
  ≥ 4.5:1 under its `--mlv-text-on-*` / `--mlv-text-primary-on-accent-*` label;
  every rest fill ≥ 3:1 on base / subtle / raised (subtle is also the loader /
  progress track); `accent-1-hover` ≥ 3:1 on the page surfaces.
- **Light:** white labels. `success` / `warning` / `info` sit on their **700**
  step, `accent-2` on `accent-700` (the 600 / coral-500 steps put white at
  2.65–4.10:1); `danger` stays on 600. Hover and press **darken** (85% / 70–75%
  black) — a lightening hover took the primary button to 3.32:1.
- **Dark:** `success` / `warning` / `info` / `danger` / `accent-2` sit on their
  **500** step under a **near-black** label (`--mlv-palette-neutral-950`) and
  keep the dark "hover lightens" rule, which only raises that label's contrast.
  No white-label step works here: a white-label fill would have to sit in the
  luminance window 0.158–0.183 (4.5:1 for white _and_ 3:1 on the `#262626`
  track), and info has no step in it.
- **accent-1 keeps white in both themes** — `--mlv-text-primary-on-accent-1` is
  also the neutral tooltip's light-in-every-theme foreground. Dark hover/press
  therefore deepen toward **primary-700**, not black: black at 85% fails the
  radio dot / switch track / stepper ring on `--mlv-background-subtle` (2.55:1).
- Pale tints (`-pale`, `-pale-hover`) stay on the 500 steps in both themes.

### What `tone-contrast.spec.mjs` guards

- Token pairs only help if components paint them. The spec compiles the badge,
  chip, button, loader, progress, status-indicator, timeline, avatar, tokenizer
  and tabs stylesheets (PostCSS AST), resolves what each tone modifier paints,
  and scores it against `theme.scss`: 4.5:1 text, 3:1 marks and focus rings.
- Tone maps must read **semantic tokens only** — no `--mlv-palette-*` step, no
  component-level `color-mix()` hover. A palette read is frozen to one theme and
  bypasses the high-contrast fills: how badge/chip `success`/`info`,
  `button--variant-info` and the loader/progress fills fell under AA while every
  token pair looked fine.
- Workspace walk: no `var(--x, #hex)` literal fallback anywhere in `libs/**/src/**`.
- Colour never varies with density here and no pair uses the large-text
  exemption → one score per tone × theme covers every density.
- Themes scored: light, dark, HC, and **HC over dark** (`highContrastDark`) —
  the shape `MlvThemeService` + `data-theme="high-contrast"` actually produces.
- Loader / progress tracks paint **`--mlv-background-subtle`** (bar
  `background`, circle `stroke`; on the loader, both behind its
  `--mlv-l-track-color` / `trackColor` hook — the bar ignored it before #303);
  the spec pins that. A track is a fill, not a hairline: HC's
  `--mlv-border-subtle` (`#999`) put the HC success / warning / danger fills at
  2.54 / 2.78 / 2.07:1 against it (#303); on HC's `#f5f5f5` the tone fills sit
  at 5.40–10.29:1.
- Light / dark: the same colour the old `--mlv-border-subtle` track had
  (`neutral-100` / `neutral-800`) wherever the library renders a track, since
  no component stylesheet redeclares either token. A consumer's own override
  of `--mlv-border-subtle` no longer reaches the tracks; one of
  `--mlv-background-subtle` now does.
- Not `--mlv-background-neutral-1`, although it is the same colour at the root:
  `mlv-page-shell`'s topbar / sidebar slots remap it to a mix of the chrome's
  own colours (fill vs track 1.08:1 on a brand chrome, 1.64:1 on an HC chrome,
  measured in Chromium). Every score is taken at the root, so the spec compiles
  every `libs/**/src` stylesheet, collects the theme tokens any of them
  redeclares, and fails when a token a fill-vs-track score reads is one of them
  (floor: the scan must see page-shell's `--mlv-background-neutral-1`).
- Only fill-vs-track is scored (#302 precedent). The HC track on its white page
  is 1.09:1 (`#999` was 2.85:1, under 3:1 too), the trade the light track
  already makes (1.04:1) — no single track colour clears 3:1 both ways.
- Inputs: the target's `libs/**/src/**/*.{css,scss}` glob covers every sheet it reads.

### Theme scopes (#303)

- A custom property's `var()` is substituted **where it is declared**;
  descendants inherit the computed value. An alias declared only by an
  ancestor scope therefore carries that scope's answer into every nested
  `[mlvTheme]` island.
- The four scope selectors weigh the same, so source order decides:
  `[data-theme='high-contrast']` follows `[mlvTheme='dark']` and wins **only for
  what it declares**. `MlvThemeService` always writes `mlvTheme` on `<html>`, so
  HC in practice is `<html mlvTheme="dark" data-theme="high-contrast">`.
- Invariant: **an island computes exactly its own theme, whatever it is nested
  in.** Kept by three rules:
  - HC declares every token dark declares — selected pair, `text-on-selected`,
    `--mlv-shadow-1..5` + semantic shadows (the light set, shared through
    `$mlv-shadow-1..5` SCSS variables), `--mlv-elevation-bg-1..5` (light
    aliases), `--mlv-popover-item-bg-hover`.
  - Dark declares every token HC declares that light owns — stroke widths,
    `--mlv-focus-ring` (light values; a dark island in an HC page inherited
    HC's thick widths and its already-resolved 4px black `--mlv-focus-ring`,
    1.17:1 on the dark canvas).
  - `muted.scss` light block uses the same `:root, :host, [mlvTheme='light']`
    list as `theme.scss` (was `:root` only: light islands kept the page's
    tints, `:host` got none).
- Deliberately `:root`-only: `--mlv-inline-direction` (a host or island must not
  reset an RTL sign).
- Behaviour note: a dark island now resets the stroke widths and
  `--mlv-focus-ring`, as a light island already did. A consumer override of
  `--mlv-stroke-width*` / `--mlv-focus-ring` written on `:root` alone no longer
  reaches `[mlvTheme='dark']` islands, and a dark island inside an HC page
  keeps normal-weight strokes. Global overrides of these tokens must target the
  island selectors too (`:root, [mlvTheme]`).

### What `theme-scopes.spec.mjs` guards

- `src/lib/theme-scopes.mjs` models the cascade over the compiled
  `malva-ui.scss`: `loadTokenRules(css)` collects every custom property in each
  scope rule, `computeChain(rules, chain)` computes an element chain with
  `var()` substituted at the declaring element, `differingTokens()` diffs two
  maps.
- It refuses what it cannot model — an unknown selector inside
  `@layer mlv.tokens`, a scope selector outside it or inside `@media` /
  `@supports` / `@container`, `!important` on a token, an `@property`-registered
  token — so a new construct cannot silently fall out of the check.
- CSS invalidity: every member of a reference cycle and a `var()` of an unset
  name with no fallback compute to the guaranteed-invalid value (`undefined`),
  which readers skip for their fallback. Cycles are found lazily, as Chrome 153
  does, not as CSS Variables Level 1 words it: declaration order, a fallback's
  `var()` followed only when the fallback is taken, substitution continuing past
  a failed `var()`. A cycle member is invalid whatever its fallback; a reader
  outside it (`--c: var(--b, blue)`) takes its fallback only when resolved after
  the cycle has closed — declared first, it is still being substituted when a
  member's later `var()` reaches it, and is caught. So declaration order decides
  membership, through continued substitution. A name a later rule redeclares
  keeps its first position. Checked against Chrome 153: 39 declarations / 15
  arrangements, plus 15 values / 5 two-rule arrangements for cross-rule order,
  all agree. No cycle occurs in the published sheet.
- Not modelled: `:host` is an element flag, not a shadow tree (no
  outer-context precedence, no consumer rules); values compare as normalised
  text, which errs towards a spurious failure.
- Asserts: HC declares every name dark declares (a value comparison alone
  passes a missing declaration whose dark value happens to match, e.g.
  `--mlv-shadow-flat`); no token computes invalid in a pure theme; `light + HC`
  and `dark + HC` pages equal pure HC; 12 page × island pairs (pages light /
  dark / HC / light+HC / dark+HC × islands light / dark / HC, minus the three
  same-theme pairs, which are trivially equal) each equal the pure island
  theme; a three-deep `dark > HC > light` chain equals pure light; a
  `:host` alone equals pure light except `--mlv-inline-direction`. Pairs
  suffice: an island that recomputes every theme-varying token is independent
  of its ancestors, so deeper nesting follows by induction.

---

## Public API

| File                                   | Kind             | Description                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/styles/src/lib/index.scss`       | SCSS entry point | `@use`s `theme`, `muted` and `layers`, and applies a global `[class*="mlv"]` reset/default font+color rule wrapped in `@layer mlv.base`. Import this once globally.                                                                                                                                |
| `libs/styles/src/lib/theme.scss`       | SCSS             | Core design tokens — all three theme modes (light, dark, high-contrast) in one file. Sections 1–11. The heading scale is fluid (`mixins.fluid()`), so the file emits **no `@media` block at all**. All rules emit into `@layer mlv.tokens`.                                                        |
| `libs/styles/src/lib/muted.scss`       | SCSS             | Muted/semantic tint tokens — 3 emphasis levels × 8 color families. All rules emit into `@layer mlv.tokens`.                                                                                                                                                                                        |
| `libs/styles/src/lib/layers.scss`      | SCSS             | Single-line CSS cascade-layer order declaration (`@layer mlv.tokens, mlv.base, mlv.components;`). `@use`d first by every global emitter so the statement is written once, ahead of all layered rules.                                                                                              |
| `libs/styles/src/lib/overlay.scss`     | SCSS             | Dialog backdrop base look (`.mlv-dialog-backdrop`) — DOM the CDK overlay creates, so no component stylesheet owns it. Emits into `@layer mlv.components`.                                                                                                                                          |
| `libs/styles/src/lib/density.scss`     | SCSS mixin file  | Density system mixins (`density-tight()`, `density-compact()`, `density-comfortable()`, `density-spacious()`, `density-airy()`, `density-not-comfortable()`).                                                                                                                                      |
| `libs/styles/src/lib/mixins.scss`      | SCSS mixin file  | `base()`, the `fluid()` clamp builder behind the heading scale, direction-aware `rtl()` / `ltr()` scopes, logical `margin-inline()` / `padding-inline()`, `inline-distance()` / `translate-inline()` for mirrored transforms, motion-query helpers, staggered entry, and `reduced-motion($block)`. |
| `libs/styles/src/lib/animations.scss`  | SCSS             | Keyframe animation definitions (dialog, popup, drawer, accordion) plus the `--enter` / `--leave` classes that play them. `@use`s `layers` and emits into `@layer mlv.components`.                                                                                                                  |
| `libs/styles/src/lib/breakpoints.scss` | SCSS mixin file  | Mobile-first breakpoint system — configurable thresholds, viewport mixins (`breakpoint-up`, `breakpoint-down`, `breakpoint-only`), container query mixins (`container`, `container-up`, `container-down`), and `$mlv-viewport-min`, the fluid band's lower anchor (not a breakpoint).              |

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

| Layer            | Contents                                                                                                                                                  | Emitted by                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `mlv.tokens`     | All design-token custom-property declarations (`:root`, `:host`, `[mlvTheme='light']`, `[mlvTheme='dark']`, `[data-theme='high-contrast']`, muted tints). | `theme.scss`, `muted.scss`     |
| `mlv.base`       | Global element reset/defaults — the `[class*="mlv"]` font/color/box-sizing rule.                                                                          | `index.scss`                   |
| `mlv.components` | All library component BEM styles plus `.mlv-dialog-backdrop`.                                                                                             | Component SCSS, `overlay.scss` |

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

Dark mode is opt-in through `[mlvTheme='dark']`; `theme.scss` does not currently expose an automatic `prefers-color-scheme` selector. High-contrast mode overrides a smaller subset of the same token names — but **every token the dark theme declares**, because it is applied beside `mlvTheme` and falls through to the dark value for anything it omits. Each selector also works as a nested island; see _Theme scopes (#303)_ above.

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
| Application frame     | `--mlv-background-chrome` — the shell's topbar and sidebars; the raised surface in light, one rung below the canvas in dark          |
| Chrome bars           | `--mlv-background-bar`, `-overlapped` — a sticky bar at rest, and the one rung it steps up while over scrolling content              |
| Elevation (dark mode) | `--mlv-elevation-bg-1` … `--mlv-elevation-bg-5`                                                                                      |

`--mlv-background-chrome` replaced a raw `--mlv-palette-neutral-900` literal in
`page-shell.scss`, which followed no theme: near-maximum contrast in light, and
**byte-identical to the canvas in dark**, where the frame disappeared. Light
resolves `--mlv-background-raised` (white), so only the hairlines separate the
frame from the page it wraps; dark steps the other way, to `neutral-950` under
a `neutral-900` canvas, because there a lighter frame would float; high
contrast declares `#000000`.

`--mlv-background-bar` / `-overlapped` are the whole separation model for
`mlv-action-bar`, `mlv-page-header`, `mlv-page-summary` and `mlv-page-dock`:
a hairline says where the bar ends, and the fill steps one rung when the bar is
over content. They replaced a translucent `elevation-bg-3` fill behind
`backdrop-filter: blur(1.25rem)` under a scroll-deepening shadow — four signals
saying one thing, in four copies. Both are `var()` references, so **both are
re-declared inside the `dark-tokens` mixin** rather than inherited: a `var()`
value resolves in the scope it is declared in, and a scoped `[mlvTheme='dark']`
island would otherwise paint the light theme's answers.

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
| `--mlv-text-primary-on-accent-1` | Text on primary button — white in every theme                                                                          |
| `--mlv-text-primary-on-accent-2` | Text on accent-2 button — white in light, near-black (`neutral-950`) in dark (#302)                                    |
| `--mlv-text-on-danger`           | Text on danger solid background — white in light, near-black in dark (#302)                                            |
| `--mlv-text-on-success`          | Text on success solid background — white in light, near-black in dark (#302)                                           |
| `--mlv-text-on-warning`          | Text on warning solid background — white in light, near-black in dark (#302)                                           |
| `--mlv-text-on-info`             | Text on info solid background — white in light, near-black in dark (#302)                                              |
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
| `--mlv-text-on-chrome`           | Text on `--mlv-background-chrome` — the shell frame's default foreground                                               |

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
Dark mode uses higher-opacity shadows. Each `--mlv-elevation-bg-{1..5}` rung has a declared role, not a uniform light/dark split: in light, rung 1 (`flush` — canvas-level, border only) resolves `--mlv-background-base`, while rungs 2–5 (card/dialog/drawer, popup/toast/form-control, drawers/side-overlays, switch-thumb-only) all stay at the `--mlv-background-raised` ceiling and express depth via the shadow alias instead; in dark, each rung is its own stepped grey. High contrast redeclares the light set (shadows through the shared `$mlv-shadow-1..5` SCSS variables, rungs as the light aliases) — otherwise HC over dark painted dark rungs under HC's black text (tokenizer caption 1.38:1, #303). `--mlv-elevation-bg-5` is deliberately outside the WCAG-audited surface set — its only consumer paints it as a switch track, never behind text.

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

> High-contrast mode overrides `--mlv-stroke-width` to `0.125rem`, `-medium` to `0.1875rem`, and `-thick` to `0.25rem` for wider, more visible lines, and `--mlv-focus-ring` to the thick width. The dark theme redeclares the light values of all four, so a dark island inside an HC page gets the normal ring rather than HC's black 4px one.

---

### Section 11 — Direction

| Token                    | Value      | Description             |
| ------------------------ | ---------- | ----------------------- |
| `--mlv-inline-direction` | `1` / `-1` | Sign of the inline axis |

`1` on `:root` and `[dir='ltr']`, `-1` on `[dir='rtl']`. The `[dir]` rules sit
outside the `:root` block so they apply at any depth — a mirrored subtree inside
an LTR document re-signs the axis for its own descendants.

Exists because `transform` has no logical form. Consume it through
`mixins.inline-distance()` rather than inlining the `calc()`; see
[Direction Mixins](#direction-mixins-mixinsscss).

---

## Muted Tints (`muted.scss`)

3 emphasis levels × 8 color families, each providing a `bg / text / border` triplet. Backgrounds are derived with `color-mix()`. Light tints are declared on `:root, :host, [mlvTheme='light']` — the same list as `theme.scss` — so a light island restores them (#303).

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

## `fluid($min, $max, $from, $to)` (`mixins.scss`)

Builds the `clamp()` behind the heading scale. Endpoints are **px** — the ramp
has to be computable — and the band defaults to
`$mlv-viewport-min` → `$mlv-breakpoint-lg`:

```scss
--mlv-font-size-5xl: #{mixins.fluid(28px, 36px)};
// clamp(1.75rem, 1.5682rem + 0.9091vw, 2.25rem)
```

- **The middle term always keeps a `rem` component.** A font-size in bare `vw`
  ignores browser zoom and the root font size — WCAG 1.4.4 (Resize Text). The
  `rem` half is the whole value at the bottom of the band and the bulk of it at
  the top; `fluid-type.spec.mjs` asserts the `vw` term stays under 35% of the
  value at 1200px.
- **Both coefficients are rounded to four decimals**, which moves the value at
  the anchors themselves by well under a hundredth of a pixel. Outside the band
  the endpoints are exact regardless, because `clamp()` bounds the
  interpolation there.
- It `@error`s on non-px endpoints and on `$from >= $to` rather than emitting a
  ramp that cannot be right.

---

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

| Physical                                               | Logical                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `margin-left` / `margin-right`                         | `margin-inline-start` / `margin-inline-end`                             |
| `padding-left` / `padding-right`                       | `padding-inline-start` / `padding-inline-end`                           |
| `left` / `right`                                       | `inset-inline-start` / `inset-inline-end`                               |
| `border-left` / `border-right`                         | `border-inline-start` / `border-inline-end`                             |
| `border-top-left-radius` (and the other three corners) | `border-start-start-radius` (`-start-end-`, `-end-start-`, `-end-end-`) |
| `text-align: left` / `right`                           | `text-align: start` / `end`                                             |

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

| Variable             | Default  | Description                                                |
| -------------------- | -------- | ---------------------------------------------------------- |
| `$mlv-breakpoint-md` | `768px`  | Min-width for the tablet (md) tier                         |
| `$mlv-breakpoint-lg` | `1200px` | Min-width for the desktop (lg) tier                        |
| `$mlv-viewport-min`  | `320px`  | Lower anchor of the fluid type band — **not** a breakpoint |

`$mlv-viewport-min` names the narrowest viewport the library designs for rather
than a layout switch: nothing queries it, and it is absent from the internal
`$_breakpoints` map, so `breakpoint-up(viewport-min)` is an error and not a
tier. It is the `$from` default of `mixins.fluid()`, with `$mlv-breakpoint-lg`
as `$to` — so an app that moves `lg` moves the top of every fluid ramp with it.

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

## Fluid Typography (`theme.scss`)

Every heading role interpolates across one band — `$mlv-viewport-min` (320px) to
`$mlv-breakpoint-lg` (1200px) — instead of stepping at `md` / `lg`. `theme.scss`
emits **no `@media` block**, and `fluid-type.spec.mjs` asserts that.

**Fluid** — the four display steps, plus the three heading roles that used to
resolve fixed ones:

| Token                              | 320px | 1200px | Read by                         |
| ---------------------------------- | ----- | ------ | ------------------------------- |
| `--mlv-font-size-3xl`              | 20px  | 24px   | h3, `mlv-card` title            |
| `--mlv-font-size-4xl`              | 24px  | 30px   | h2, `mlv-card` title (`size=l`) |
| `--mlv-font-size-5xl`              | 28px  | 36px   | h1                              |
| `--mlv-font-size-6xl`              | 36px  | 48px   | display copy                    |
| `--mlv-typography-heading-h4-size` | 18px  | 20px   | h4                              |
| `--mlv-typography-heading-h5-size` | 16px  | 18px   | h5                              |
| `--mlv-typography-heading-h6-size` | 15px  | 16px   | h6                              |

**Fixed at every width** — `xs`, `s`, `m`, `l`, `xl`, `2xl`, and every body / UI
role built on them.

Four things this shape is deliberate about:

- **The endpoints are the stepped scale's.** A phone still gets the old mobile
  value and a wide desktop the old `lg` one; only the middle changed, from the
  last step passed to a size that fits the canvas. The largest deviation from an
  old **`md`** step is ~2px (`6xl`: 42.1 vs 40).
- **h4/h5/h6 ramp on the semantic heading token, not on `--mlv-font-size-{2xl,xl,l}`.**
  Those three steps are shared with the body and UI roles, and `--mlv-height-*`
  is fixed rem — a fluid font inside a fixed-height control clips instead of
  scaling. Each role tops out at exactly the value its old shared token holds, so
  a wide desktop is unchanged and only a narrow canvas shrinks.
- **h1/h2/h3 still read `--mlv-font-size-{5,4,3}xl`** and inherit the ramp, so a
  consumer reading the raw step gets the same fluid value the role does.
- **`3xl` no longer coincides with `2xl` at the narrow end**, which it used to do
  on purpose. h3 and h4 are separated at every width now — and `mlv-page-header`
  needs that: its crossfade scrubs one grid cell between two title roles, so the
  **gap between the roles is the collapse distance**. The spec pins ≥6px for
  `size="m"` (h2→h4) and ≥3px for `size="s"` (h4→h6) across the band.

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
                        stroke/focus, direction — all 3 theme modes; @uses
                        mixins for the fluid heading scale (no @media at all)
      theme-contrast.mjs      — resolves theme.scss colours (var / color-mix /
                                SCSS interpolation) and scores WCAG contrast
      theme-contrast.spec.mjs — WCAG AA guard over the action + neutral
                                interactive pairings, both themes (styles:test)
      theme-scopes.mjs        — cascade model over the compiled stylesheet:
                                var() substituted where it is declared
      theme-scopes.spec.mjs   — every theme island computes its own theme,
                                whatever it is nested in (styles:test)
      muted.scss      — muted tint triplets (bg/text/border × 3 levels × 8 families)
      density.scss    — density SCSS mixins (tight/compact/comfortable/spacious/airy)
      mixins.scss     — base() reset/font mixin, fluid() clamp builder,
                        direction and motion helpers
      mixins.spec.mjs — direction + fluid() mixin output (styles:test)
      fluid-type.spec.mjs — the heading scale's fluid contract, read off the
                        compiled theme.scss (styles:test)
      animations.scss — overlay keyframe animations
      breakpoints.scss — mobile-first breakpoint variables, viewport/container
                        mixins, and $mlv-viewport-min (the fluid band's floor)
```
