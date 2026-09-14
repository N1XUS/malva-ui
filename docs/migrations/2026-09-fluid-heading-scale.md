# 2026-09 — Fluid heading scale

Applies to `@malva-ui/styles`, and through it to every heading in
`@malva-ui/core` — `[mlvTitle]`, `mlv-page-header`, `mlv-card`, `mlv-dialog`,
`mlv-drawer-header`, `mlv-empty-state`, and any consumer stylesheet that reads
one of the seven tokens below.

**Breaking, behaviour only.** Nothing is renamed, removed or retyped, no token
disappears, and every name a consumer can write still resolves. What changes is
the **value** seven public tokens hold at a given viewport width — which
`VERSIONING.md` counts as breaking on its own, because `--mlv-*` names listed in
`libs/styles/tokens.md` are public API and a documented value is part of it.

The heading scale was already responsive: `3xl`–`6xl` stepped at `md` (768px)
and `lg` (1200px). This replaces those steps with one `clamp()` per token, so a
heading interpolates across the band instead of snapping as a window crosses a
breakpoint — and extends the treatment to h4/h5/h6, which were genuinely fixed
at every width.

`theme.scss` now emits **no `@media` block at all**; the four display tokens
were the only members of `tokens.md`'s "Responsive overrides" section, so that
section is gone with them.

## What changed

The band is `$mlv-viewport-min` (320px, new) → `$mlv-breakpoint-lg` (1200px).
Below and above it the value is pinned, so the two endpoints are the ones the
stepped scale already had.

| Token                              | Old @320 | Old @768 | Old @1200 | New @320 | New @768 | New @1200 |
| ---------------------------------- | -------- | -------- | --------- | -------- | -------- | --------- |
| `--mlv-font-size-3xl`              | 20px     | 22px     | 24px      | 20px     | 22.04px  | 24px      |
| `--mlv-font-size-4xl`              | 24px     | 26px     | 30px      | 24px     | 27.05px  | 30px      |
| `--mlv-font-size-5xl`              | 28px     | 32px     | 36px      | 28px     | 32.07px  | 36px      |
| `--mlv-font-size-6xl`              | 36px     | 40px     | 48px      | 36px     | 42.11px  | 48px      |
| `--mlv-typography-heading-h4-size` | 20px     | 20px     | 20px      | 18px     | 19.02px  | 20px      |
| `--mlv-typography-heading-h5-size` | 18px     | 18px     | 18px      | 16px     | 17.02px  | 18px      |
| `--mlv-typography-heading-h6-size` | 16px     | 16px     | 16px      | 15px     | 15.51px  | 16px      |

`--mlv-typography-heading-h{1,2,3}-size` still resolve `--mlv-font-size-{5,4,3}xl`
and inherit the ramp from them, so nothing about how those three are wired
changed.

Two consequences worth reading twice:

- **The four display tokens keep both endpoints and move only in between.** The
  largest deviation from an old value is at the retired `md` step — `6xl` at
  768px is 42.11px where it used to be 40px (~5%). A layout tuned to a specific
  size at a specific width between 320 and 1200 will find a slightly different
  one; a layout tuned at either end will not.
- **h4/h5/h6 are strictly smaller below 1200px and unchanged at and above it.**
  They top out at exactly the value they used to hold at every width, so a
  desktop is byte-identical and only a narrow canvas shrinks. A phone gets an
  h4 at 18px where it used to get 20px.

### h4/h5/h6 ramp on their own token, not on the shared step

They used to resolve `--mlv-font-size-{2xl,xl,l}`. Those three steps are shared
with the body and UI roles, and `--mlv-height-*` is fixed rem — a fluid font
inside a fixed-height control clips instead of scaling. So the ramp is declared
on the semantic heading token, and `--mlv-font-size-{2xl,xl,l}` are **unchanged
and still fixed**, along with every body and UI role built on them.

The visible edge of that decision: `--mlv-typography-heading-h4-size` no longer
equals `--mlv-font-size-2xl` below 1200px. A stylesheet that treated the two as
interchangeable — writing `var(--mlv-font-size-2xl)` where it meant "the h4
size" — now diverges on a narrow viewport. Read the heading token when you mean
the heading role.

### `3xl` no longer coincides with `2xl` at the narrow end

It used to, on purpose: both were 20px below `md`, so h3 and h4 rendered
identically on a phone. They are separated at every width now. `mlv-page-header`
depends on that separation — its collapse crossfades one grid cell between two
title roles, so the gap between the roles _is_ the collapse distance, and roles
that converge at the narrow end reproduce the zero-collapse defect from the
other side. `fluid-type.spec.mjs` pins ≥6px for `size="m"` (h2→h4) and ≥3px for
`size="s"` (h4→h6) across the whole band.

## Consumer action

**Usually nothing.** Every token still resolves, and both ends of the band are
where they were.

- **A layout tuned to an exact heading pixel size between 320px and 1200px** —
  re-check it, or pin the token: `--mlv-font-size-6xl: 2.5rem;` in an unlayered
  consumer rule restores the old `md` step (library tokens live in
  `@layer mlv.tokens`, so an unlayered declaration wins with no specificity
  fight).
- **A stylesheet that read `--mlv-font-size-{2xl,xl,l}` as a stand-in for the
  h4/h5/h6 size** — switch it to `--mlv-typography-heading-h{4,5,6}-size`.
- **An app that overrode `$mlv-breakpoint-lg`** — that variable is now also the
  **top of every fluid ramp**, so moving it moves where headings stop growing.
  That is deliberate: an app whose desktop tier starts at 1440px wants the ramp
  to reach full size there, not 240px earlier.
- **A test asserting a heading's computed `font-size`** — it now reads a
  `clamp()` result that depends on the viewport width, not a step. Assert at
  320px or at 1200px, where the value is pinned and exact.

Nothing to do for `@media` overrides of these tokens written by a consumer:
those still work, and still beat the ramp inside their own query.

## New public surface

| Name                            | Where                                  | What                                                                                                                                    |
| ------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `$mlv-viewport-min`             | `libs/styles/src/lib/breakpoints.scss` | `320px !default` — the fluid band's lower anchor. **Not a breakpoint**: nothing queries it and it is absent from the internal tier map. |
| `fluid($min, $max, $from, $to)` | `libs/styles/src/lib/mixins.scss`      | The `clamp()` builder. px endpoints, band defaulting to `$mlv-viewport-min` → `$mlv-breakpoint-lg`.                                     |

Both are SCSS, which `VERSIONING.md` places **outside** the published surface —
only the compiled `malva-ui.css` ships — so neither is a compatibility promise
to an npm consumer. They are listed here because an in-repo or source-consuming
app can reach them.

`fluid()` keeps a `rem` component in the middle term deliberately: a font-size
expressed in bare `vw` ignores browser zoom and the root font size, failing WCAG
1.4.4 (Resize Text). Its two coefficients are rounded to four decimals, which
moves the value at the anchors themselves by well under a hundredth of a pixel;
outside the band `clamp()` bounds the interpolation, so the endpoints are exact
regardless.
