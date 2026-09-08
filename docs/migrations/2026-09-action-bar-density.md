# `mlv-action-bar` becomes a density scope

**Package:** `@malva-ui/core/action-bar`
**Symbols:** `MlvActionBar`, `MlvActionBarLogo`, `MlvActionBarSpacer`

**No exported symbol, selector, `exportAs`, input, output, injection token, BEM
class or i18n key was renamed or removed.** Nothing to edit for the compiler.
This is a **behaviour-only** major: `[mlvActionBar]` used to ignore density
entirely and now resolves and applies it, so bars in an app that already sets a
density render at a different size with no markup change.

---

## 1. What changed

`MlvActionBar` gained `MlvDensityDirective` as a host directive, provides
`MLV_DENSITY_ELEMENT = 'action-bar'`, and republishes its resolved level as
`MLV_DENSITY_CONTEXT`. Concretely:

| Before                                                                                                      | After                                                                                                        |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| No `MLV_DENSITY_ELEMENT`, so the density directive stamped **no class** and `mlvDensity` on a bar was inert | The bar stamps `mlv-action-bar--<density>` and scales its own `padding`, its control `gap` and the logo ramp |
| The bar ignored `MlvDensityService` / an ancestor `MLV_DENSITY_CONTEXT`                                     | It resolves `mlvDensity` → nearest ancestor `MLV_DENSITY_CONTEXT` → `MlvDensityService`, in that order       |
| Controls inside the bar resolved their own density from the service                                         | They resolve the **bar's** density first, through the context the bar now provides                           |
| Pill padding was a physical four-value `padding` shorthand                                                  | `padding-block` + `padding-inline`, so the asymmetry mirrors in RTL                                          |

`comfortable` — the shipped default — is byte-identical to the previous
rendering in LTR, for both shapes. Every other step is new.

## 2. The density scale

| Step          | Bar padding                 | Control gap                    | Pill padding (block / inline start · end)     | Logo font / gap                |
| ------------- | --------------------------- | ------------------------------ | --------------------------------------------- | ------------------------------ |
| `tight`       | `--mlv-spacing-1` (0.25rem) | `--mlv-spacing-0-5` (0.125rem) | `0-5` / `1-5` · `1` (0.125 / 0.375 · 0.25rem) | `font-size-s` / `spacing-1`    |
| `compact`     | `--mlv-spacing-2` (0.5rem)  | inherits comfortable (0.25rem) | `1` / `2` · `1-5` (0.25 / 0.5 · 0.375rem)     | `font-size-m` / `spacing-1-5`  |
| `comfortable` | `--mlv-spacing-3` (0.75rem) | `--mlv-spacing-1` (0.25rem)    | `1-5` / `3` · `2` (0.375 / 0.75 · 0.5rem)     | `font-size-l` / `spacing-2`    |
| `spacious`    | `--mlv-spacing-4` (1rem)    | `--mlv-spacing-2` (0.5rem)     | `2` / `4` · `3` (0.5 / 1 · 0.75rem)           | `font-size-xl` / `spacing-2-5` |
| `airy`        | `--mlv-spacing-5` (1.25rem) | `--mlv-spacing-3` (0.75rem)    | `3` / `5` · `4` (0.75 / 1.25 · 1rem)          | `font-size-2xl` / `spacing-3`  |

## 3. Who is affected

**Affected — the bar resizes with no markup change:**

1. **A bar that already carried `mlvDensity`.** It was inert; it is now honoured.
   In this repo, `apps/docs/src/app/pages/page/examples/2/index.html` ships
   `<header mlvActionBar … mlvDensity="compact">`, whose padding goes
   `0.75rem` → `0.5rem`.
2. **A bar under a non-comfortable ambient density** — `provideMlvDensity()`, a
   `MlvDensityService` (global or component-scoped), or an ancestor container
   that provides `MLV_DENSITY_CONTEXT` such as `form[mlvForm]` or `mlv-tile`.
   In this repo, `apps/docs/src/app/showcases/pages/support-inbox` provides a
   component-scoped `MlvDensityService` set to `compact` on wide viewports; its
   `<div mlvActionBar>` now renders at compact padding.
3. **Controls projected into a bar that sets `mlvDensity`.** They previously
   read the service and now read the bar. A control with its own explicit
   `mlvDensity` is unchanged — an explicit input still wins.
4. **RTL consumers of `shape="pill"`.** The wide padding side was pinned to the
   physical left; it now follows the leading edge. Measured in Chromium, the
   comfortable pill is `6/8/6/12` (top/right/bottom/left) in LTR and `6/12/6/8`
   in RTL, where it used to be `6/8/6/12` in both. This is a fix, not a
   regression — `.claude/rules/rtl.md` requires the logical form — but it is a
   visible change.

**Not affected:**

- A bar in an app that never sets a density: the service default is
  `comfortable`, which renders exactly as before.
- Anything that reads the bar's TypeScript API, its BEM classes, its exported
  types, or its existing `--mlv-action-bar-*` custom properties.

## 4. The mechanical edit

None is required, and for most consumers none is wanted — a bar that follows the
app's density is the point of the change. Pin a bar that must not move:

```html
<!-- Before: rendered comfortable because the bar ignored density. -->
<header mlvActionBar>…</header>

<!-- After: same rendering under any ambient density. -->
<header mlvActionBar mlvDensity="comfortable">…</header>
```

An explicit `mlvDensity` beats both the ancestor context and the service, so
this is stable regardless of what the app does around it.

## 5. Adjacent, non-breaking

- **New input `animated`** (`BooleanInput`, default `true`). The bar's
  `animate.enter` / `animate.leave` classes were unconditional, and Angular
  applies them whenever the element enters the DOM — including the first render
  of a view the router rebuilds, not only an `@if` toggle. A bar that is
  permanent chrome therefore replayed its fade-and-slide on every navigation,
  and a page rendering several of them replayed all of them at once. The default
  is unchanged, so nothing moves for an existing consumer; pass
  `[animated]="false"` on a bar that is furniture rather than a surface that
  just appeared.

  It is a **CSS** opt-out, not a binding: a non-bracketed `host` key is an
  attribute, which Angular's `parseHostBindings` stores as `literal(value)`, so
  the class list cannot be gated from TypeScript. `animated="false"` stamps the
  new `.mlv-action-bar--no-animation` modifier, whose `animation: none` cancels
  both keyframe sets and whose `transition: none` cancels the fallback Angular
  reaches for next: with no animation running it reads the computed
  `transition-duration`, and the bar declares a 0.1s colour transition, so
  keyframes alone would leave the enter class (and its two listeners) on the
  host for good and hold a leaving bar for `duration + 50ms`. With both at zero
  Angular finds nothing to wait for and clears the enter class on the next
  frame. The modifier is emitted last in the file on purpose — it and the `--pos-bottom` animation rules are
  both (0,2,0), and a bottom-anchored bar carries all three classes at once.

- **New:** `--mlv-action-bar-logo-gap` and `--mlv-action-bar-logo-font-size`,
  declared on the bar per density step and read by `.mlv-action-bar__logo`. The
  logo cannot resolve density itself — it carries no density modifier, so the
  density mixins' ancestor branch would reach it from _any_ density-modified
  ancestor rather than from the bar.
- **`[mlvActionBarLogo]`** gained a density-invariant `min-block-size` /
  `min-inline-size` of `1.5rem`, holding WCAG 2.2 SC 2.5.8 for a text-only logo
  at `tight`. It does not change the bar's height.
- **`[mlvActionBarSpacer]`** moved its rule from an inline `styles: []` array to
  `action-bar-spacer.scss`, so it now ships inside `@layer mlv.components` like
  every other rule the library emits. A consumer override written in that layer
  previously lost to it and now wins.
- `.mlv-action-bar--pos-top` / `--pos-bottom` express their symmetric insets as
  `inset-inline: 0` instead of `left: 0; right: 0`. No rendered difference in
  either direction.
