# `mlv-page` rebuild — geometry, composition, chrome

**Date:** 2026-09-08
**Packages:** `@malva-ui/core/page`, `@malva-ui/core/tabs`, `@malva-ui/core/action-bar`, `@malva-ui/i18n`, `@malva-ui/styles`

This is the second half of the `mlv-page` rebuild. The first half — the measured
geometry contract, the deletion of the pin, the scroll-scrubbed snap timeline,
element-projected header regions, and the named scroller — landed in the five
commits ahead of this one and is summarised below where a consumer has to act.
Everything under **Breaking** needs an edit at a call site; everything under
**Behaviour** changes what you see without changing what you write.

---

## Breaking

### `MlvPageSummaryItem` is an attribute component on a `<div>`

```html
<!-- before -->
<mlv-page-summary-item label="Price">329 USD</mlv-page-summary-item>

<!-- after -->
<div mlvPageSummaryItem label="Price">329 USD</div>
```

Selector `mlv-page-summary-item` → `div[mlvPageSummaryItem]`. Same class name,
same export, same `label` input, no alias — `<mlv-page-summary-item>` matches
nothing and fails template type-checking.

The strip is a **description list** now: `mlv-page-summary` renders a `<dl>` and
each item renders `<dt class="mlv-page-summary-item__label">` /
`<dd class="mlv-page-summary-item__value">`. A `<dl>`'s content model admits
only `<dt>`/`<dd>` groups, `<div>`, `<script>` and `<template>` between the list
and its terms, so a custom element there fails axe's own `definition-list` and
`dlitem` rules — the wrapper has to be a real `<div>`, which is why the selector
moved rather than the markup being nested one level deeper.

The BEM names `.mlv-page-summary-item`, `__label` and `__value` are unchanged,
and so is `data-slot="page-summary-item"`.

### `mlv-page-summary` gained a `__facts` element

`.mlv-page-summary__items` keeps the padding; the `<dl>` inside it is
`.mlv-page-summary__facts` and carries the row/column gaps, the `overflow` clip
and the accessible name. CSS written against `__items` for the flex row (gap,
`flex-wrap`, `align-items`) has to move to `__facts`.

The `aria-label` moved with it — an assertion reading
`.mlv-page-summary__items[aria-label]` now finds nothing.

### `summaryLabel` and `expandLabel` are `string | undefined`

`MlvPageSummary.summaryLabel` and `MlvPageHeader.expandLabel` were
`input('Page summary')` / `input('Expand header')`. Both are now
`input<string | undefined>(undefined)` and fall back to the **new `page` slice**
of the language pack. Passing a string still wins; reading the input back now
yields `undefined` rather than the English default.

### `@malva-ui/i18n` gained a `page` slice

`MlvLanguage` has a new required `page: MlvPageI18n` member with two keys,
`pageSummary` and `expandHeader`. A hand-written `MlvLanguage` object (rather
than one of the shipped `@malva-ui/i18n/<locale>` packs) fails to compile until
it declares them. New exports: `MLV_PAGE_I18N`, `MlvPageI18n`,
`MLV_PAGE_I18N_CONTEXT`.

### `mlv-tab-group` panels can live outside the group

New input `panels: 'inline' | 'external'` (default `'inline'`, unchanged
behaviour) and new component `MlvTabPanel` (`[mlvTabPanel]`,
`@malva-ui/core/tabs`). Nothing breaks by omission — but the pattern this
replaces was a stub `mlvTabContent` per tab, rendered only so `aria-controls`
resolved to _something_. If you did that to put a tab strip in page chrome and
its content in the page body, delete the stubs and switch to
`panels="external"` plus one `[mlvTabPanel]`:

```html
<mlv-page-header>
  <div mlvPageTabs>
    <mlv-tab-group #tabs panels="external" [(activeTab)]="tab">
      <mlv-tab value="overview" label="Overview" />
      <mlv-tab value="activity" label="Activity" />
    </mlv-tab-group>
  </div>
</mlv-page-header>

<mlv-page-content>
  <section mlvTabPanel [group]="tabs">…</section>
</mlv-page-content>
```

`MlvTabGroup.activeTabId` is the public signal the external panel points its
`aria-labelledby` at. In `external` mode the strip emits no `aria-controls`,
because a reference that resolves to an empty element is not a panel
relationship.

### `MlvActionBarSpacer` is deleted — use `<mlv-spacer />`

```html
<!-- before -->
<div mlvActionBarSpacer></div>

<!-- after -->
<mlv-spacer />
```

No alias. `MlvSpacer` is `mlv-spacer` from `@malva-ui/cdk/utils`, and the BEM
class changes with it: `.mlv-action-bar__spacer` → `.mlv-spacer`.

The removed component was `display: inline-flex; flex-grow: 1` on an attribute
host; `MlvSpacer` is `flex: 1 1 auto`, and a flex item's `display` is blockified
either way, so the rendered result inside a bar is identical. Its one extra
capability was content projection, and no call site used it — every occurrence in
`apps/docs` and in the specs was an empty `<div mlvActionBarSpacer></div>`.

`MlvToolbarSpacer` is the same shape and is deliberately **not** removed:
`toolbar.scss` selects `.mlv-toolbar-spacer` for its own spacing rules.

### `MlvPage.maxWidth` caps the reading column, not the canvas

`maxWidth` used to set `max-width` plus `margin-inline: auto` on
`.mlv-page__inner`, so the **whole canvas** narrowed and the sticky chrome
narrowed with it, leaving the header floating in the middle of a wide window.
It now caps every non-chrome child of the canvas, while the chrome spans the
full canvas and pads itself by the same gutter
(`--mlv-page-measure-gutter`), so a wide application gets full-bleed chrome and
a narrow measure at once.

Visible change: on a page with `maxWidth` **and** a header, summary or dock,
that chrome now reaches the canvas edges. A consumer whose CSS assumed the
chrome stopped at `maxWidth` should delete that assumption rather than
re-narrow it.

### `MlvPageShell` chrome colour is theme-aware

`--mlv-page-shell-chrome-background` / `-foreground` defaulted to the raw
palette stops `neutral-900` / `neutral-50`. They now resolve the new semantic
tokens `--mlv-background-chrome` / `--mlv-text-on-chrome`.

| Theme         | Chrome before | Chrome after | Canvas    |
| ------------- | ------------- | ------------ | --------- |
| Light         | `#171717`     | `#e5e5e5`    | `#fafafa` |
| Dark          | `#171717`     | `#0a0a0a`    | `#171717` |
| High contrast | `#171717`     | `#000000`    | `#ffffff` |

The old default followed no theme: in light it was a near-maximum-contrast dark
band, and in dark it was **byte-identical to the canvas**, so the frame
disappeared entirely. Both values are now one deliberate step off the canvas in
their own theme, and the quiet frame is the default.

**To keep the dark frame in light mode**, set the shell's own input — it still
resolves in the host's cascade and still derives a readable foreground:

```html
<mlv-page-shell color="#171717">…</mlv-page-shell>
```

or override the two custom properties directly, which is unchanged.

### The chrome bars no longer paint glass

`mlv-action-bar`, `mlv-page-header`, `mlv-page-summary` and `mlv-page-dock` each
stacked four separation signals: a translucent `elevation-bg-3` fill,
`backdrop-filter: blur(1.25rem)`, a hairline, and a shadow deepening
`raised` → `floating` once scrolled. Two are left — the hairline says where the
bar ends, and the fill steps one rung (`--mlv-background-bar` →
`--mlv-background-bar-overlapped`) when the bar is over content.

Three consequences:

- **`backdrop-filter` is gone from all four.** That was not only cosmetic: a
  `backdrop-filter` establishes a containing block for `position: fixed`
  descendants, so a consumer's overlay rendered inside a bar was anchored to the
  bar rather than to the viewport. `mlv-action-bar[appearance]`'s deliberate
  `--contrast` smoked-glass variant keeps its blur.
- **`--mlv-action-bar-shadow` is no longer declared** on the block. It is still
  read (`box-shadow: var(--mlv-action-bar-shadow, none)`), so an override still
  wins; the default is now no shadow. The pill shape and `--contrast` supply
  their own.
- **`mlv-page-header--scrolled` styles nothing.** The class is still emitted and
  still follows the snap controller's `overlapped`, so a consumer hook on it
  keeps working. The fill step is declared once on the page host as
  `mlv-page--overlapped`, so the three page bars cannot answer "am I over
  content" differently.

### One chrome rhythm

The three page bars each picked their own block padding — `0.5rem` (header),
`0.75rem` (summary items), `0.375rem` (dock) — and every row inside the header
picked its own gap. They now read three custom properties declared once on
`.mlv-page`:

| Property                          | Default           | Read by                                                      |
| --------------------------------- | ----------------- | ------------------------------------------------------------ |
| `--mlv-page-chrome-block-padding` | `--mlv-spacing-3` | header, summary items, dock                                  |
| `--mlv-page-chrome-row-gap`       | `--mlv-spacing-2` | the header's stacked rows                                    |
| `--mlv-page-chrome-item-gap`      | `--mlv-spacing-2` | every row inside the header, the dock regions, the facts row |

All three scale with **density**; the header's two title type roles do not — a
compact data table wants a tighter bar, not a smaller page title, so the type
roles stay a `size` decision.

Visible change: the header and dock are slightly taller at comfortable density
and the header's intra-row gaps are slightly tighter. `mlv-page-content`'s top
padding, which was a fixed `0.5rem` regardless of `gap`, is now the same measure
as the `gap` input it exposes.

### `MlvPageHeader` declares its collapsed floor

New custom properties on the header: `--mlv-page-header-row-height`
(`--mlv-height-l`, `--mlv-height-m` under `size="s"`) and
`--mlv-page-header-floor`, which is that plus twice the chrome block padding.
The title row's `min-height` reads the first and the header's `min-block-size`
reads the second, so the collapse distance's "expanded minus collapsed"
subtraction has a real second term rather than an emergent one.

---

## Behaviour

### The page is addressable, focusable and restorable

Five additions to `@malva-ui/core/page`, all opt-in providers or directives —
nothing changes for a page that does not use them:

| Export                                                               | What it does                                                                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `MlvPageRegistry`                                                    | Root registry of mounted pages; `active()` is the one on screen                                                       |
| `provideMlvPageRouteFocus(options?)`, `MLV_PAGE_ROUTE_FOCUS_OPTIONS` | Moves focus (and/or announces) to the newly activated page on navigation — `'focus' \| 'announce' \| 'both'`          |
| `provideMlvPageScrollRestoration()`, `MlvPageViewportScroller`       | Teaches Angular's router to restore the **page's** scrollport, not the document's                                     |
| `a[mlvPageSkipLink]` (`MlvPageSkipLink`)                             | Skip link that resolves the live page from the registry, so it works across routes with no coordinated id             |
| `mlvPageViewTransitionHook()`, `MlvPageViewTransition`               | View-transition names for the page canvas and its chrome, so a route change cross-fades the body and holds the chrome |

`MlvPageSkipLink` emits **no `href`** when no page is mounted — an anchor
without `href` is not a link and not a tab stop, so the control withdraws
instead of becoming a focusable no-op.

### `mlv-page-end-pane` recreates its content across the breakpoint

Stated, not changed. The inline `<aside>` and the modal Drawer are two outlets,
so crossing `collapseBelow` destroys one view and builds the other. The
_logical_ state the component owns survives (`opened`, the focus-restore target,
the event sequence); anything the view holds does not — a half-typed input, a
scroll offset, an open popup. New public signal `renderer`
(`MlvPageEndPaneRenderer`, `'inline' | 'drawer'`) is the exact moment of the
swap, for a consumer that needs to snapshot first.

`afterOpened` now fires **after the active renderer exists** — the inline aside
has rendered, or the Drawer's overlay is attached and has taken initial focus.
It used to fire one render earlier, so a handler focusing something inside the
pane was focusing a surface that was not there yet.

### Full-bleed chrome survives a wrapper

`mlv-page-header` and `mlv-page-summary` derived their full-bleed margins from a
`.mlv-page__inner > …` child selector, so a `<form>` or `<section>` between the
canvas and the chrome silently dropped the treatment. Both now read the
inherited `--mlv-page-inset-inline` / `-block`, the way `mlv-page-dock` always
did, and the canvas corner radius is reached by a descendant selector.

Inheritance fixes _discovery_, not containment: a wrapper that scrolls, clips or
pads still changes the geometry.

### The anchored canvas keeps its rounded top, deliberately

`surface="anchored"` rounds the canvas's top two corners against the shell
chrome with no gap. That reads as an accident only while the frame and the
canvas are the same colour, which is what the chrome token change above fixes.
No gap was added: the documented intent is one continuous canvas rounding
into the frame, not a card floating inside it.

### A sticky element's inline inset stays physical

Safari 26 mispositions a `position: sticky` element in RTL when its inline inset
is written logically, which collides with `.claude/rules/rtl.md`'s mandate.
The exception is documented there and guarded by
`libs/styles/src/lib/sticky-inline-inset.spec.mjs`, which sweeps every
stylesheet under `libs/` and fails on a rule declaring both `position: sticky`
and `inset-inline*`. Every sticky inset in `mlv-page` is on the block axis, so
nothing changed today; the guard stops the obvious form from landing later.

---

## New tokens

| Token                             | Light                     | Dark                      | High contrast |
| --------------------------------- | ------------------------- | ------------------------- | ------------- |
| `--mlv-background-chrome`         | `neutral-100`             | `neutral-950`             | `#000000`     |
| `--mlv-text-on-chrome`            | `--mlv-text-primary`      | `--mlv-text-primary`      | `#ffffff`     |
| `--mlv-background-bar`            | `--mlv-background-base`   | `--mlv-background-base`   | `#ffffff`     |
| `--mlv-background-bar-overlapped` | `--mlv-background-raised` | `--mlv-background-raised` | `#f5f5f5`     |

Page-scoped, all on `.mlv-page`: `--mlv-page-chrome-surface`,
`--mlv-page-chrome-block-padding`, `--mlv-page-chrome-row-gap`,
`--mlv-page-chrome-item-gap`, `--mlv-page-measure`,
`--mlv-page-measure-gutter`. Header-scoped: `--mlv-page-header-row-height`,
`--mlv-page-header-floor`.

`--mlv-page-chrome-bg` and `--mlv-page-chrome-border` are unchanged as consumer
override knobs and are read ahead of the page's own state.
