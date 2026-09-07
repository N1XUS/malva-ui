# 2026-08 — Page dock floating backdrop, wrapper-tolerant geometry, and toast clearance

No exported symbol changed name or signature. Everything below is **default
visual behaviour**, so it is logged here rather than in a rename migration.

## 1. `mlv-page-dock[appearance="floating"]` now paints a backdrop

**Before.** `appearance="floating"` produced fully transparent chrome:
`background: transparent; border-top: none; backdrop-filter: none`. The
component's own docstring promised "a gradient-masked backdrop (the
`mlvFloatingContainer` recipe)", but nothing implemented it — computed styles
were `background rgba(0, 0, 0, 0)`, `mask-image none`, `backdrop-filter none`,
so page content scrolled straight into the dock's actions.

**After.** The modifier still drops the dock's own glass surface, and now adds
the real recipe, shared with `[mlvFloatingContainer]` through the new
`libs/cdk/floating-container/src/lib/floating-container.mixins.scss`:

- a `::before` backdrop at `z-index: -1`, bleeding `2.5rem` above the dock,
  filled with `var(--mlv-page-dock-backdrop, var(--mlv-background-base))` and
  masked with `linear-gradient(180deg, transparent, black 2.5rem)`;
- `padding-block-end: max(var(--mlv-spacing-1-5), env(safe-area-inset-bottom))`;
- `isolation: isolate`, so the negative-`z-index` backdrop has a stacking
  context even when the dock is not sticky.

**If you relied on the old behaviour** (a floating dock with genuinely nothing
behind it), set `--mlv-page-dock-backdrop: transparent` on the dock. Consumers
who worked around the missing fade with their own gradient overlay should
remove it — the two will otherwise stack.

## 2. Dock geometry no longer depends on being a direct child

**Before.** `page.scss` matched `.mlv-page__inner > .mlv-page-dock` for the
full-bleed negative margins. Any wrapper — a `<form>`, a `<section>` — silently
dropped them, and consumers had to re-add the margins with global overrides.

**After.** `page-dock.scss` applies
`margin-inline: calc(-1 * var(--mlv-page-inset, 0rem))` and the matching
`margin-bottom` to the dock itself, computed from the **inherited**
`--mlv-page-inset`. The dock keeps its full-bleed geometry at any nesting depth
and collapses to zero margins outside a page.

**Still constrained:** `mlv-page-header` and `mlv-page-summary` must remain
**direct children** of `main[mlvPage]`. Their geometry is sibling-relative and
`MlvPage` measures the same direct children to compute
`--mlv-page-snap-offset`; wrapping either one drops both the full-bleed
treatment and the snap compensation. Remove any global override that duplicated
the dock margins — it now doubles them.

## 3. Dock regions wrap

`.mlv-page-dock__start`, `__center`, and `__end` are `flex-wrap: wrap`. A dock
with four end actions reflows onto a second row on a narrow canvas instead of
overflowing its grid column. `white-space: nowrap` still applies to buttons and
links, so no individual label breaks. Nothing wraps while there is room, so the
wide-viewport layout is unchanged.

`MlvActionBar` gained a matching **`wrap`** input (`BooleanInput`, default
`false`) for a bar projected into a dock region. It is opt-in, so existing
navigation bars keep their single-row geometry.

## 4. Bottom toasts clear a sticky dock

**Before.** Bottom-anchored toasts render in the CDK overlay at a fixed 16px
from the viewport edge, so they covered `.mlv-page-dock--sticky`.

**After.**

- While `sticky`, `MlvPageDock` measures its border-box height with
  `MlvResizeObserverService` and publishes it as `--mlv-page-dock-height` on
  `document.documentElement`. The property is removed when the last sticky dock
  is destroyed or `sticky` goes false, and the tallest contribution wins while
  several docks are mounted.
- `MlvToastContainer` publishes `--mlv-toast-panel-inset-block-start` on `top-*`
  positions and `--mlv-toast-panel-inset-block-end` on `bottom-*` positions;
  `toast-container.scss` turns them into padding on the stack. The block-end
  value is `var(--mlv-toast-inset-block-end, var(--mlv-page-dock-height, 0px))`,
  the block-start value `var(--mlv-toast-inset-block-start, 0px)`.

So bottom toasts lift above a page dock with no wiring. To reserve space for
other fixed chrome, set `--mlv-toast-inset-block-start` /
`--mlv-toast-inset-block-end` on `document.documentElement` (the overlay
container is a body child and never a descendant of the page, so the document
root is the only reliable scope). An explicit value wins over the dock height.

`@malva-ui/core/notification` reuses `MlvToastContainer` and inherits the same
clearance.
