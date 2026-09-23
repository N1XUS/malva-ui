---

# Library: page

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you change this library's API, layout, accessibility, styling, tests, or packaging.

## Overview

`@malva-ui/core/page` provides composable application-page primitives. `mlv-page-shell` owns the reusable geometry that joins an existing action bar, zero to two start sidebars, one optional static or responsive end pane, and the rounded Page canvas; the projected navigation components retain their own behavior. The remaining primitives own page scrolling, structured headers, a collapsible key-facts summary strip, responsive main/aside content, and a bottom workflow action dock.

Record-editor experiences (draft/live switches, version history, diff views, suggestions, delayed publish) are built by **composition**: this library ships the structure, slots, and scroll-linked behaviour; the host owns the domain state. See docs page example 3 for the full pattern.

## Public API

Exported from `libs/core/page/src/index.ts`:

| Export                            | Kind             | Selector / values                                               |
| --------------------------------- | ---------------- | --------------------------------------------------------------- |
| `MlvPageShell`                    | Component        | `mlv-page-shell`                                                |
| `MlvPageTopbar`                   | Shell slot       | `[mlvPageTopbar]`                                               |
| `MlvPageSidebar`                  | Shell slot       | `[mlvPageSidebar]`                                              |
| `MlvPageEndSidebar`               | Shell slot       | `[mlvPageEndSidebar]`                                           |
| `MlvPageEndPane`                  | Component        | `mlv-page-end-pane`                                             |
| `MlvPageEndPaneContent`           | Template slot    | `ng-template[mlvPageEndPaneContent]`                            |
| `MlvPageEndPaneTrigger`           | Button directive | `button[mlvPageEndPaneTrigger]`                                 |
| `MlvPage`                         | Component        | `main[mlvPage]`                                                 |
| `MlvPageHeader`                   | Component        | `mlv-page-header`                                               |
| `MlvPageContent`                  | Component        | `mlv-page-content`                                              |
| `MlvPageContext`                  | Header region    | `[mlvPageContext]`                                              |
| `MlvPageTitle`                    | Template slot    | `[mlvPageTitle]`                                                |
| `MlvPageStatus`                   | Header region    | `[mlvPageStatus]`                                               |
| `MlvPageActions`                  | Header region    | `[mlvPageActions]`                                              |
| `MlvPageDescription`              | Header region    | `[mlvPageDescription]`                                          |
| `MlvPageMeta`                     | Header region    | `[mlvPageMeta]`                                                 |
| `MlvPageTabs`                     | Header region    | `[mlvPageTabs]`                                                 |
| `MlvPageAside`                    | Content region   | `[mlvPageAside]`                                                |
| `MlvPageSummary`                  | Component        | `mlv-page-summary`                                              |
| `MlvPageSummaryItem`              | Component        | `div[mlvPageSummaryItem]`                                       |
| `MlvPageDock`                     | Component        | `mlv-page-dock`                                                 |
| `MlvPageDockStart`                | Dock slot        | `[mlvPageDockStart]`                                            |
| `MlvPageDockCenter`               | Dock slot        | `[mlvPageDockCenter]`                                           |
| `MlvPageDockEnd`                  | Dock slot        | `[mlvPageDockEnd]`                                              |
| `MlvPageChromeRegion`             | Abstract base    | `hideOn` — every projected chrome region extends it             |
| `MlvPageRegionHide`               | Type             | `'narrow' \| 'wide' \| null`                                    |
| `MlvPageHeaderState`              | Interface        | `{ progress; collapsed; titleClipped }`                         |
| `MLV_PAGE_HEADER_STATE`           | Token            | collapse state of the enclosing `mlv-page-header`               |
| `MLV_PAGE_SNAP_WINDOW`            | Token            | a region's own default stagger window                           |
| `MlvPageSnapWindow`               | Interface        | `{ from; to }`                                                  |
| `MlvPageGeometry`                 | Service          | provided by `MlvPage`                                           |
| `MlvPageSnapState`                | Interface        | `{ progress; snapped; overlapped; collapseDistance; expand() }` |
| `MlvPageSnapBehavior`             | Type             | `'pinned' \| 'enterAlways' \| 'exitUntilCollapsed'`             |
| `MlvPageRegion`                   | Interface        | `{ element; edge; sticky; followsChromeDefault? }`              |
| `MlvPageStickyEdge`               | Type             | `'block-start' \| 'block-end'`                                  |
| `registerPageRegion`              | Function         | registers a region with the enclosing page                      |
| `publishViewportInsetBlockEnd`    | Function         | document-scoped block-end registry                              |
| `obstructsViewportBlockEnd`       | Function         | geometric viewport-obstruction test                             |
| `MlvPageShellSizing`              | Type             | `'parent' \| 'viewport' \| 'content'`                           |
| `MlvPageSnap`                     | Directive        | `[mlvPageSnap]`                                                 |
| `MlvPageSnapRegionBase`           | Abstract base    | focus contract for snap regions                                 |
| `MlvPageSnapRegion`               | Interface        | `{ reveal; syncHiddenState }`                                   |
| `MlvPageSnapCoordinator`          | Interface        | `@internal` — what the region base consumes                     |
| `MlvPageSnapMode`                 | Type             | `'hide' \| 'fade' \| 'keep'`                                    |
| `MlvPageDockAppearance`           | Type             | `'bar' \| 'floating'`                                           |
| `MlvPageScroll`                   | Type             | `'page' \| 'content' \| 'document'`                             |
| `MlvPageScroller`                 | Directive        | `[mlvPageScroller]`                                             |
| `MlvPagePadding`                  | Type             | `'none' \| 's' \| 'm' \| 'l'`                                   |
| `MlvPageSurface`                  | Type             | `'anchored' \| 'flat'`                                          |
| `MlvPageHeaderSize`               | Type             | `'m' \| 's'`                                                    |
| `MlvPageHeaderTabsAlign`          | Type             | `'start' \| 'center'`                                           |
| `MlvPageContentGap`               | Type             | `'s' \| 'm' \| 'l'`                                             |
| `MlvPageRegistry`                 | Service          | root registry of mounted pages                                  |
| `MlvPageEntry`                    | Interface        | `{ id; element; page }`                                         |
| `MlvPageRouteFocusHandler`        | Service          | moves focus / announces on navigation                           |
| `provideMlvPageRouteFocus`        | Function         | providers that activate the handler                             |
| `MlvPageRouteFocusStrategy`       | Type             | `'focus' \| 'announce' \| 'both'`                               |
| `MlvPageRouteFocusOptions`        | Interface        | `{ strategy; politeness; announce? }`                           |
| `MLV_PAGE_ROUTE_FOCUS_OPTIONS`    | Token            | route-focus options                                             |
| `MlvPageViewportScroller`         | Service          | `ViewportScroller` that scrolls the page, not the document      |
| `provideMlvPageScrollRestoration` | Function         | swaps the router's scroller for the one above                   |
| `MlvPageSkipLink`                 | Directive        | `a[mlvPageSkipLink]`                                            |
| `MlvPageViewTransition`           | Service          | names the canvas / chrome for a view transition                 |
| `mlvPageViewTransitionHook`       | Function         | `withViewTransitions({ onViewTransitionCreated })` hook         |
| `MlvPageViewTransitionLike`       | Interface        | structural `ViewTransition` (the DOM lib type is not shipped)   |
| `MlvPageViewTransitionInfoLike`   | Interface        | structural `ViewTransitionInfo`                                 |
| `MlvPageEndPaneRenderer`          | Type             | `'inline' \| 'drawer'`                                          |

## Regions are projected elements

Every chrome slot except the page title is an **element the consumer owns**,
selected out of the projected content by an attribute — `[mlvPageContext]`,
`[mlvPageStatus]`, `[mlvPageActions]`, `[mlvPageDescription]`, `[mlvPageMeta]`,
`[mlvPageTabs]`, `[mlvPageAside]`, and the three dock slots. Region _order_ is
still the component's, because the projection sites are in its template; what
the consumer gains is that the node in the DOM is the one they wrote —
selectable and stylable without piercing encapsulation, never re-instantiated
when a sibling region appears or disappears, and free to be a semantic element
(`<nav mlvPageContext>`, `<p mlvPageDescription>`, `<aside mlvPageAside>`).

**`[mlvPageTitle]` is the one template**, and for the same structural reason the
end pane keeps one: the header renders the title _twice_, at two complete type
roles, and crossfades between them. A projected element is one DOM node and can
land in only one slot.

### `MlvPageChromeRegion`

Every region extends one abstract base carrying exactly one input, because
responsive withholding is the only behaviour all of them share.

| Input    | Type                | Default | Description                                     |
| -------- | ------------------- | ------- | ----------------------------------------------- |
| `hideOn` | `MlvPageRegionHide` | `null`  | Withholds the region on a narrow or wide canvas |

`hideOn` is serialised onto the host as `data-hide-on` and resolved by **one
container query** in `page.scss`, against the page canvas (`.mlv-page__inner`
is a _named_ size container, `mlv-page`) rather than the viewport. So it costs
no change detection, needs no resize listener, renders correctly on the server,
and a region withheld inside a narrow canvas on a wide screen is withheld
because the canvas is narrow. Outside `main[mlvPage]` there is no canvas and
nothing is withheld. `40rem` is the single definition of "narrow", in
`_page-container.scss`; the two queries use range syntax (`width <= 40rem` /
`width > 40rem`) so neither width is matched by both.

Everything else a region needs it declares for itself. `[mlvPageDescription]`
and `[mlvPageMeta]` compose `MlvPageSnap` through `hostDirectives` and supply
their own stagger windows by providing `MLV_PAGE_SNAP_WINDOW` (0–0.6 and
0.15–0.75) — a `hostDirectives` entry cannot have its inputs bound, and a
window is exactly the kind of default that belongs to the region rather than to
one more input on the header.

### `data-slot`

Every structural part of the page family carries a `data-slot` attribute naming
it: `page`, `page-shell`, `page-topbar`, `page-sidebar`, `page-end-sidebar`,
`page-header`, `page-context`, `page-status`, `page-actions`,
`page-description`, `page-meta`, `page-tabs`, `page-header-expand`,
`page-content`, `page-main`, `page-aside`, `page-summary`, `page-summary-item`,
`page-end-pane`, `page-dock`, `page-dock-start`, `page-dock-center`,
`page-dock-end`, `page-skip-link`.

A test, a screenshot diff and a consumer override all need a handle on a part,
and a BEM class is the wrong one: it is simultaneously the styling surface, so
it cannot be renamed without breaking overrides and cannot be queried without
coupling the query to the visual API. `data-slot` is a name with no other job.

## `MlvPageShell`

`MlvPageShell` is the application-page composition boundary. It supplies stable topbar/body/content tracks, one continuous chrome frame, and the integration styling that turns a collapsed `mlv-sidebar` into a rail beside an attached Page canvas. Consumers project existing navigation components through marker directives; Page does not duplicate their interaction logic.

- `[mlvPageTopbar]` spans the shell above every column.
- `[mlvPageSidebar]` marks zero to two start sidebars. Repeated hosts project in their author DOM order.
- `[mlvPageEndSidebar]` optionally adds one static shell-level end sidebar after the canvas.
- `mlv-page-end-pane` adds a responsive trailing pane that becomes a modal Drawer below its configured breakpoint.
- Unmarked content occupies the central canvas track and should normally be one `main[mlvPage]`.

### Sizing (`sizing`)

The shell owns the definite block size everything sticky inside it resolves
against — the page's own scrollport, the sidebar rails, the header, the dock, a
sticky aside. Without one they all fail at once and silently, which is why the
mode is an input rather than something each consumer re-derives.

| `sizing`             | Block size                                      | Use when                                                                          |
| -------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `'parent'` (default) | `100%`                                          | the shell is inside a box that already has a definite block size                  |
| `'viewport'`         | `calc(100svh - inset)`, `100dvh` at `md` and up | the shell _is_ the application                                                    |
| `'content'`          | `auto`                                          | the shell is embedded in a document-scrolled page and nothing inside it is sticky |

`'parent'` is the default because `100%` against an indefinite parent computes
to `auto` — identical to declaring nothing — so it fixes the bounded case
without changing the unbounded one.

In `'viewport'` mode the shell **measures its own distance from the top of the
layout** (`getBoundingClientRect().top + scrollY`, so it is scroll-invariant and
does not depend on the shell's own block size) and publishes it as
`--mlv-page-shell-viewport-inset-block-start`. A fixed application bar above the
shell, or the padding reserved for one, is therefore subtracted without anyone
writing its height down a second time. The measurement assumes the document is
the shell's scrolling ancestor; a shell nested in another scroller wants
`'parent'`, where the parent already carries the size.

`svh` below `md`, `dvh` above: `dvh` on a phone re-runs the page scroller's
thumb maths every time the URL bar collapses.

### Route-host contract

Angular inserts an activated route's component _beside_ `<router-outlet>`, on
its own host element, so under a router the shell's content child is the route
host and the page is one level further down. The shell therefore gives **every**
content child flex participation and a zero minimum on both axes, and hides the
outlet element itself (it renders no content and must not claim a line box).

A route host that is not itself a flex or grid container can opt into the
`mlv-page-host` class, which makes it a flex column so the definite size reaches
the `main[mlvPage]` inside it:

```html
<!-- route component host -->
<div class="mlv-page-host">
  <main mlvPage>…</main>
</div>
```

### Multi-sidebar projection contract

`mlv-page-shell` accepts zero, one, or two repeated `[mlvPageSidebar]` hosts.
Their DOM order is their visual and reading order, so an icon rail followed by an
expanded navigation panel stays a rail followed by navigation for every user.
The shell accepts at most one `[mlvPageEndSidebar]`, projected after the central
content track for a labelled inspector or complementary navigation region.
The same end projection also accepts one `mlv-page-end-pane`; existing static
end-sidebar markup remains compatible and unchanged.

The shell deliberately has no numbered sidebar selectors and no column-count
input. Each projected host owns its own `width`, collapsed state, and
`offcanvas` mode. The shell only preserves the tracks around it: the central
content track remains `flex: 1 1 auto` with `min-width: 0`, allowing it to
shrink instead of overflowing when sidebars are present.

A projected sidebar in `mode="offcanvas"` renders as an overlay drawer while its
host element stays in the shell's body row. `mlv-sidebar--offcanvas` is
`width: 100%` so a standalone sidebar can fill its container, which inside the
shell would claim the entire body and leave the canvas no width, so the shell
zeroes that slot. Switching `mode` between `'icon'` and `'offcanvas'` is
therefore all a responsive shell needs to do; see the app-shell docs example,
which drives it from its own measured width.

| Input        | Type                 | Default    | Description                                                                                       |
| ------------ | -------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `color`      | `string \| null`     | `null`     | CSS chrome background color. Supports literals, named colors, and resolved `var(...)` references. |
| `foreground` | `string \| null`     | `null`     | Optional foreground override; otherwise black or white is selected from WCAG contrast.            |
| `sizing`     | `MlvPageShellSizing` | `'parent'` | How the shell resolves its own block size. See "Sizing" above.                                    |

### Chrome colour

`color` and `foreground` are **not the shell's own inputs**. They belong to
[`MlvChromeColor`](libs-utils.md#mlvchromecolor), which the shell composes
through `hostDirectives` and aliases back to the names it always had:

```ts
hostDirectives: [
  {
    directive: MlvChromeColor,
    inputs: ['mlvChromeColor: color', 'chromeForeground: foreground'],
  },
];
```

Nothing changes at a call site. What changes is that contrast-derived chrome is
reachable **without adopting the whole shell** — a standalone `nav mlvActionBar`,
a sidebar in a bespoke layout, a marketing header — which it was not while the
colour resolution, the compositing and the ancestor `MutationObserver` lived
inside `mlv-page-shell`.

When `color` is set, the browser resolves it in the host's real CSS cascade. The
directive composites translucent colours over what is actually behind them, then
chooses the black or white endpoint with the higher WCAG contrast ratio. It
recomputes when the input, a referenced custom property, or an ancestor theme
attribute changes. Invalid or cyclic values write nothing at all — the
properties stay **absent**, not empty, which is what lets the stylesheet's
fallback apply.

```html
<mlv-page-shell color="#7138d0">…</mlv-page-shell>

<mlv-page-shell [style.--brand-shell]="brandColor()" color="var(--brand-shell)"> … </mlv-page-shell>

<mlv-page-shell color="var(--brand-shell)" foreground="var(--brand-on-shell)"> … </mlv-page-shell>
```

The resolved pair is readable as signals for a consumer painting a matching
surface outside the shell: `shell.chrome.background()` /
`shell.chrome.foreground()`, through the shell's public `chrome` property.

The stylesheet reads the directive's two published properties with the default
chrome as the fallback:

```scss
--mlv-page-shell-effective-background: var(--mlv-chrome-background, var(--mlv-page-shell-chrome-background));
--mlv-page-shell-effective-foreground: var(--mlv-chrome-foreground, var(--mlv-page-shell-chrome-foreground));
```

So consumers can still override `--mlv-page-shell-chrome-background` and
`--mlv-page-shell-chrome-foreground` directly. The `color` and `foreground`
inputs take precedence while present; without them the existing custom-property
cascade is unchanged.

**The two defaults are theme-aware**, resolving `--mlv-background-chrome` and
`--mlv-text-on-chrome`. They used to be the raw palette stops `neutral-900` /
`neutral-50`, which followed no theme at all:

| Theme         | Chrome, before | Chrome, now | Canvas    |
| ------------- | -------------- | ----------- | --------- |
| Light         | `#171717`      | `#e5e5e5`   | `#fafafa` |
| Dark          | `#171717`      | `#0a0a0a`   | `#171717` |
| High contrast | `#171717`      | `#000000`   | `#ffffff` |

In light that was a near-maximum-contrast dark band around a near-white canvas;
in dark it was **byte-identical to the canvas**, so the frame disappeared
entirely. Both values are now one deliberate step off the canvas in their own
theme, and the quiet frame is the default. A shell that wants the old dark band
in light mode sets its own input — `<mlv-page-shell color="#171717">` — which
still derives a readable foreground from contrast.

### Chrome token remap (`page-shell.scss`)

Everything projected into `[mlvPageTopbar]` / `[mlvPageSidebar]` /
`[mlvPageEndSidebar]` sits on the chrome background, not on a page surface, so
the theme tokens those components resolve read wrong against it. The shell
remaps them scoped to the chrome slots only — a control inside `main[mlvPage]`
keeps the normal tokens. Every remap mixes
`--mlv-page-shell-effective-foreground` **against
`--mlv-page-shell-effective-background`** — never against `transparent` — so
one formula is correct on a light chrome, a dark chrome, and a brand chrome,
and the result is opaque (a portalled flyout no longer picks up whatever is
behind it) (SF-R2).

On `&__sidebar.mlv-sidebar`:

| Remapped token                      | Value                | Why                                                                                   |
| ----------------------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| `--mlv-sidebar-border-width`        | `0rem`               | The rail has no wall of its own inside the shell.                                     |
| `--mlv-text-primary`                | effective foreground | Row labels.                                                                           |
| `--mlv-text-secondary`              | foreground 78 %      | Idle row labels.                                                                      |
| `--mlv-text-action`                 | effective foreground | Link/action foreground inside the rail.                                               |
| `--mlv-background-neutral-1`        | foreground 8 %       | Neutral interactive fill.                                                             |
| `--mlv-background-neutral-1-hover`  | foreground 8 %       | Transparent-variant `mlvButton`s and other projected chrome resolve this pair direct. |
| `--mlv-background-neutral-1-active` | foreground 12 %      | Same — the pressed (pointer-down) fill of that projected chrome.                      |
| `--mlv-sidebar-hover-bg`            | foreground 8 %       | Row hover / focus-visible fill (see `libs-sidebar.md` → **State surfaces**).          |
| `--mlv-sidebar-active-bg`           | foreground 12 %      | Active row pill; the workspace switcher's open trigger.                               |
| `--mlv-sidebar-rail-color`          | foreground 24 %      | Expanded group tree line.                                                             |
| `--mlv-text-on-selected`            | effective foreground | Active row label — see below.                                                         |
| `--mlv-background-selected`         | foreground 12 %      | Selected fill for anything resolving it directly (workspace switcher row).            |
| `--mlv-background-selected-hover`   | foreground 8 %       | Same, hovered.                                                                        |
| `--mlv-border-focus`                | effective foreground | Focus ring.                                                                           |

The six row-state fills above (`--mlv-background-neutral-1*`,
`--mlv-sidebar-hover-bg/-active-bg/-rail-color`) sit lower than the
field-fill/border/foreground mixes elsewhere in this remap — SF-R2/SL-R5's "no
state fill darker than the darkest resting surface." Resolved on three
chromes: light (`#ffffff` bg, near-black fg) hover `rgb(236,236,236)` / active
`rgb(227,227,227)`; dark default (`#171717` bg, `#fafafa` fg) hover
`rgb(41,41,41)` / active `rgb(50,50,50)`; brand blue `rgb(65,99,169)` with
white foreground — hover `rgb(80,111,176)` / active `rgb(88,118,179)`. One
formula, three correct answers.

`--mlv-text-on-selected` has to be remapped **in its own right**, not through
`--mlv-text-action`. It is declared once per theme block as
`var(--mlv-text-action)`, so it resolves in the scope it is declared in — the
document root — and remapping `--mlv-text-action` on the sidebar never reaches
it. Without the direct remap an active row keeps the theme accent: a lavender
label on the chrome-derived 12 % pill, unreadable on a coloured chrome and deaf
to a `color`/`foreground` override.

The seam between two adjacent start sidebars
(`.mlv-page-shell__body > [mlvPageSidebar] + [mlvPageSidebar]`) is derived the
same way — `border-inline-start: var(--mlv-stroke-width) solid` foreground
**16 %**, between the 8/12 % row-state fills and the 24 % rail line.
`--mlv-border-subtle` resolves against the page surface and painted a near-white
hairline across a dark or brand chrome.

`&__topbar.mlv-action-bar:not([mlvTheme])` carries the same derivation for the
topbar. The `--mlv-action-bar-*` trio colours the bar's own surface; the tokens
beside it colour what the consumer projects _into_ it, which the bar's own
`color` cannot reach. A `<strong>`, an `mlv-badge`, an `mlv-avatar` and a
`variant="transparent"` `mlvButton` each resolve their own theme token, so an
unremapped chrome topbar painted page-surface colours on the frame — measured
`--mlv-text-primary: #171717` for the product name and `rgb(82, 82, 82)` for
the nav buttons, both near-black on a saturated brand purple. Percentages match
the sidebar remap (78 / 60 for text-secondary/tertiary, 8 / 8 / 12 for the
neutral interactive ramp, 12 / 8 for the selected pair), and
`--mlv-text-on-selected` is remapped in its own right for the same reason the
sidebar's active row is. `min-height: 3.25rem` is structural and stays in its
own unguarded rule.

Measured on the `mlv-page-shell` colour example at `#7138d0`: product name
6.6:1, badge 5.6:1, nav buttons 4.7:1, avatar initials 10.7:1 — all AA, against
1.6:1 for the nav buttons before.

`&__topbar:not([mlvTheme]) .mlv-form-control-wrapper` /
`&__sidebar:not([mlvTheme]) .mlv-form-control-wrapper` carry the matching remap
for projected form controls (container background, border ramp, text and focus
tokens) — same chrome-background mix, unchanged percentages (10 / 30 / 40 / 50
for the field fill/border ramp; 78 / 78 / 60 for the
action/text-secondary/text-tertiary foregrounds).

`:not([mlvTheme])` for the same reason the sidebar remap above carries it, and
it is the same bug: every mix reads `--mlv-page-shell-effective-*`, declared on
the shell host, so on a slot the consumer has scoped to its own theme these
paint the _document's_ chrome mix over a field the theme island has already
coloured. A 10 % foreground tint is visibly darker than the theme's own field
fill, so a themed rail's filter field read as a grey box in a white rail.
Withdrawing hands the field back to the wrapper's own defaults, which the island
resolves. Pinned by `page-shell-sidebar-tokens.spec.ts` §
_page shell chrome form controls_, which also asserts the unguarded selector
never comes back.

### A shell topbar does not take `contrast`

`mlv-action-bar[contrast]` is the deliberate smoked-glass variant — a
translucent `neutral-800` fill, a hairline, `backdrop-filter: saturate(1.4)
blur(1.25rem)` and a drop shadow — kept out of the rebuild's de-glassing on
purpose, for a bar floating over a photo or a hero. It is the wrong variant for
`[mlvPageTopbar]`, and measurably contributes nothing there: the shell's own
`&__topbar` remap already supplies the bar's surface _and_ the foregrounds its
projected children resolve, so with and without `contrast` a shell topbar
computes the same colours. What the modifier adds is only the two things the
rebuild removed from every chrome bar — a `0 1rem 2.25rem` drop shadow, which
smears down over the rails beneath it, and a `backdrop-filter`, which
establishes a containing block so a consumer's `position: fixed` overlay
rendered inside the bar anchors to the bar instead of the viewport.

`contrast`'s child re-tokenization is what made it attractive on chrome in the
first place, and that is the gap the topbar remap above closes: a shell topbar
no longer needs a glass variant to keep its own product name legible.

Nothing in the library forbids the combination — `contrast` is a general
`MlvActionBar` modifier and a consumer may want glass chrome deliberately — but
a bar that is already painted by the shell has no separation left to buy.

## `MlvPageEndPane`

`MlvPageEndPane` owns one trailing region across two renderers. It projects the
single required `ng-template[mlvPageEndPaneContent]` into a labelled inline
`aside` above `collapseBelow` and into a right-side modal `MlvDrawer` below it.
Only one branch exists at a time, so consumers never create duplicate forms,
subscriptions, ids, or tab stops while the viewport crosses the breakpoint.

| Input / model          | Type                     | Default   | Description                                                     |
| ---------------------- | ------------------------ | --------- | --------------------------------------------------------------- |
| `opened`               | `boolean` model          | `false`   | One logical open state shared by inline and Drawer renderers.   |
| `width`                | `string`                 | `'20rem'` | Inline track width and compact Drawer size.                     |
| `collapseBelow`        | `MlvBreakpoint \| null`  | `null`    | Breakpoint below which the pane uses the modal Drawer renderer. |
| `ariaLabel`            | `string`                 | required  | Accessible name of the active aside or dialog.                  |
| `closeOnBackdropClick` | `boolean`                | `true`    | Allows backdrop dismissal in compact mode.                      |
| `closeOnEscape`        | `boolean`                | `true`    | Allows Escape dismissal in compact mode.                        |
| `initialFocus`         | `MlvOverlayInitialFocus` | `'auto'`  | Compact Drawer initial-focus strategy.                          |

| Output         | Description                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `openedChange` | Model output emitted when the logical `opened` state changes.                                                                   |
| `afterOpened`  | Emits once for each logical false-to-true transition, **after the active renderer exists**. Breakpoint migration does not emit. |
| `afterClosed`  | Emits once after a real close and after the active renderer is gone. Breakpoint migration does not emit.                        |

Public methods `open()`, `close()`, and `toggle()` update the same logical
model. `button[mlvPageEndPaneTrigger]` requires a pane instance, toggles it,
and mirrors `aria-expanded` plus `aria-controls`. The pane host owns a stable
`panelId`, so that relationship resolves while open, closed, inline, or modal.

The pane captures the pre-open active element only on a logical false-to-true
transition. Its internal Drawer disables its own focus restoration; the pane
restores focus once after a real close. Moving an already-open pane across the
breakpoint neither restores focus nor emits a false close event.

### What survives the breakpoint, and what does not

The inline `<aside>` and the modal Drawer are two outlets, so crossing
`collapseBelow` **destroys one view and builds the other**. That is the point —
one branch at a time is what stops duplicate forms, ids and tab stops — but it
means the split is between _logical_ state, which the component owns and
carries across, and _view_ state, which it does not:

| Survives                                            | Does not survive                      |
| --------------------------------------------------- | ------------------------------------- |
| `opened`, the focus-restore target, the event order | a half-typed input, a scroll offset   |
| `panelId` and the trigger relationship              | an open popup or menu inside the pane |

The public `renderer` signal (`MlvPageEndPaneRenderer`, `'inline' | 'drawer'`)
is the exact moment of the swap, for a consumer that wants to snapshot first.

`afterOpened` fires **after the active renderer exists** — the inline aside has
rendered, or the Drawer's overlay is attached and has taken initial focus. It
used to fire one render earlier, so a handler focusing something inside the pane
was focusing a surface that was not there yet.

## `MlvPage`

`MlvPage` enhances a native `<main>` landmark. It generates a unique id and
sets `tabindex="-1"` so route focus management has a predictable target; set
`id` explicitly when a skip link needs a stable application-level target.

Every rule the page aims at its own scrollport is child-scoped, and any new one
must be — `.mlv-page__scrollbar > .mlv-scrollbar__viewport` carries
`overflow-x: hidden`, the WCAG scroll padding and the snap progress chain, and
`.mlv-page--snapping .mlv-page__scrollbar > .mlv-scrollbar__viewport` adds
`overflow-anchor: none`. Page content routinely brings its own `mlv-scrollbar`
(`mlv-chat`, an external-scroller `mlv-textarea`, and a `[mlvPageScroller]`
pane above all), and a descendant combinator would kill those nested viewports'
horizontal axis and take away their scroll anchoring for a page-level decision
nobody made about them. Guarded by
`libs/core/page/src/lib/page/page-nested-scrollbar.spec.ts`; `mlv-scrollbar`'s
own rules were scoped the same way in issue #98, documented in that library's
CLAUDE.md.

| Input          | Type                  | Default                | Description                                                                                                                   |
| -------------- | --------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `id`           | `string`              | generated              | Unique landmark id; may be set explicitly for skip-link targeting.                                                            |
| `scroll`       | `MlvPageScroll`       | `'page'`               | Which element scrolls this page. See "Scroll modes" below.                                                                    |
| `maxWidth`     | `string \| null`      | `null`                 | Maximum width of the centered **reading column**. Chrome stays full-bleed — see "Reading measure" below.                      |
| `padding`      | `MlvPagePadding`      | `'m'`                  | Responsive content inset.                                                                                                     |
| `surface`      | `MlvPageSurface`      | `'anchored'`           | Rounded anchored canvas or flat surface.                                                                                      |
| `stickyHeader` | `boolean`             | `true`                 | Makes a projected `mlv-page-header` sticky within the page scroll area. The page owns this; the header has no `sticky` input. |
| `snapBehavior` | `MlvPageSnapBehavior` | `'exitUntilCollapsed'` | How the collapsing top chrome answers scrolling.                                                                              |

`MlvPage` also exposes its snap controller as a `snap` getter, so a component
that only _hosts_ the page (and therefore cannot inject the controller) can
reach it with `viewChild(MlvPage).snap` — see `expand()` below.

The anchored surface rounds only the top corners. This makes the page read as one continuous canvas rather than a detached card floating inside the application shell.

The host rounds its border box and publishes the matching _padding_-box curve as
`--mlv-page-surface-radius` (`calc(var(--mlv-radius-xl) - 0.0625rem)` when
anchored, `0rem` when flat). A **first-child** `mlv-page-header` /
`mlv-page-summary` consumes it for its own top corners; full-bleed chrome
further down the page stays square.

That radius cannot be left to the host's `overflow: clip`, for two reasons that
survive the chrome losing its `backdrop-filter` (which used to be a third — a
filtered backdrop composites into a backdrop root an ancestor's _rounded_
overflow clip never reaches). **Only `scroll="page"` and `scroll="content"`
clip at all**: a `scroll="document"` page keeps no definite block size and no
`overflow`, so there is no clip to inherit the curve from. And clipping on
`.mlv-page__inner` is **not** the alternative: `overflow` there makes `__inner`
the nearest scroll container for the sticky header, and `__inner` scrolls with
the content, so the header would stop sticking — and every inline-rendered
overlay would be cut off at the canvas edge.

### Scroll modes (`scroll`)

Which element scrolls decides which one the geometry contract measures, which
one scrubs the collapse timeline, and which one `expand()` returns to. It is one
input with three values, and the page never guesses.

| `scroll`           | Page box                       | Scrollport                     | Collapse timeline                                  |
| ------------------ | ------------------------------ | ------------------------------ | -------------------------------------------------- |
| `'page'` (default) | bounded, `overflow: clip`      | its own `mlv-scrollbar`        | CSS `scroll(self block)` on that viewport          |
| `'content'`        | bounded, `overflow: clip`      | **none** unless donated        | only from a `[mlvPageScroller]` pane, driven in JS |
| `'document'`       | natural flow, as tall as it is | the document scrolling element | CSS `scroll(root block)`                           |

**`'page'`** is the application-canvas case: chrome sticks inside the page's own
scrollport, so a shell can put a topbar and two sidebars around it and the page
still owns one bounded scroll area.

**`'content'`** is the bounded-layout case — a full-height data table, a split
pane, a canvas that scrolls itself. Chrome sits in auto flex tracks and
everything else shares the remaining space, so the body gets a definite box to
fill. There is **no page scrollbar component, no scroll listener and no
scrollport registration**: the previous `scroll="none"` rendered an
`mlv-scrollbar` and then disabled it, which left a live component with its full
observer set, a listener that could never fire, and a permanently zero scroll
offset feeding the geometry contract and the snap timeline.

Nothing is inferred from the DOM. A composed page routinely contains several
scrollers, so "the first overflowing descendant" would pick `mlv-chat` as often
as the pane the author meant. A pane that wants to drive the timeline says so:

```html
<main mlvPage scroll="content">
  <mlv-page-header>…</mlv-page-header>
  <mlv-scrollbar mlvPageScroller>…</mlv-scrollbar>
</main>
```

**`'document'`** is the marketing / long-form case: the page keeps no definite
block size, so it is exactly as tall as its content and sticky chrome sticks to
the viewport. The document element becomes the scrollport for every purpose —
measurement, scroll offset, `expand()` — with two deliberate asymmetries. Its
`scroll` event is delivered on the **document**, not on the element, which is
why the scrollport binding carries an event target separately from its scroller;
and it is **not** registered with the CDK `ScrollDispatcher`, which already
watches the window for exactly this scroller, so registering it would make every
overlay in the document count one scroll twice.

One thing document mode does not do for you: `scroll-padding-block-start` on the
root scroller (WCAG 2.2 SC 2.4.11) has to be declared on `html`, which is not
the page's element to write. Add it in the consuming application if the page
carries sticky chrome.

### `MlvPageScroller` (`[mlvPageScroller]`)

Donates a consumer-owned pane's scroll to the page it is inside. It takes no
inputs — registering _is_ the API — and makes that pane the page's scrollport
for every purpose at once: measured for `--mlv-page-available-block-size`, read
into `MlvPageGeometry.scrollTop`, scrubbing the snap timeline, the element
`expand()` scrolls back to the top, and registered with the CDK
`ScrollDispatcher` so overlays anchored inside it reposition on its scroll. A
scroller that did three of those five would be one that silently half-works,
which is why they are one registration and not five.

On an `mlv-scrollbar` it registers that component's **viewport**, not its host —
the host is not the element that scrolls. On anything else the host is
registered as-is; give it a definite block size and an `overflow` of its own.

It requires `scroll="content"`. Inside a `'page'` or `'document'` page the
scrollport is already taken, and two of them would fight over one
`registerScrollport` slot and one `expand()` target, so the directive warns in
dev and registers nothing rather than half-connecting. Only one pane per page
should carry it.

### Scroll anchoring

`overflow-anchor: none` on the page scrollport is **not** a default page policy.
It is compensation for the snap timeline resizing the top chrome, which would
otherwise feed the adjusted `scrollTop` back into the progress until it ran away
to 0 or 1. Anchoring is a real accessibility feature — it keeps a reader's place
when content above them resizes — so the page spends it only while it has a
timeline to protect: the rule is scoped to `mlv-page--snapping`, a host class
that follows the measured `collapseDistance`. A page whose chrome collapses by
nothing keeps the browser's own place-keeping.

### Chrome surface

The header, the summary strip and the dock paint **one** surface, and the
`mlv-action-bar` a shell projects into `[mlvPageTopbar]` paints the same one.
Two signals, each saying one thing:

| Signal               | Says                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| A hairline           | where the bar ends — `var(--mlv-page-chrome-border, var(--mlv-border-subtle))`       |
| A one-rung fill step | the bar is over content — `--mlv-background-bar` → `--mlv-background-bar-overlapped` |

Every bar resolves the same three-step chain, in this order and for these
reasons: a consumer override wins over the page's state, the page's state wins
over the rest value, and the rest value is what a bar rendered **outside** a
page resolves.

```scss
background-color: var(--mlv-page-chrome-bg, var(--mlv-page-chrome-surface, var(--mlv-background-bar)));
```

**The state is declared once, on the page host** — `.mlv-page--overlapped`
re-declares `--mlv-page-chrome-surface` — and no bar re-declares it. That is not
a stylistic preference: an element's own declaration beats an inherited one, so
a bar that declared the property itself could never be reached by a page-level
state. The class follows `MlvPageSnapController.overlapped`, deliberately not
`progress`: chrome pinned at full height has a collapse fraction of zero forever
and still has to say it is sitting over content. `mlv-action-bar` takes the
raised rung statically under `--sticky` / `--fixed`, because a pinned bar is
over content by construction and that is why it is pinned.

There used to be four signals per bar, in four copies of one recipe: a
translucent `elevation-bg-3` fill, `backdrop-filter: blur(1.25rem)`, a hairline,
and a shadow deepening `raised` → `floating` once scrolled. `mlv-page-shell` had
to unset two of them by hand on its own topbar.

**Losing the blur is not cosmetic.** A `backdrop-filter` establishes a
containing block for `position: fixed` descendants, so a consumer's overlay
rendered inside a bar was anchored to the bar rather than to the viewport.
`mlv-action-bar[appearance="contrast"]` — a smoked-glass surface a consumer opts
into — keeps its blur, and is the only rule in the family that has one.

`--mlv-action-bar-shadow` is still **read** (`box-shadow: var(--mlv-action-bar-shadow, none)`)
and is no longer **declared**, so an override still wins and the default is no
shadow. `mlv-page-header--scrolled` is still emitted and still follows
`overlapped`, but styles nothing — a consumer hook, not a surface.

### Chrome rhythm

The three page bars used to pick their own block padding — `0.5rem` (header),
`0.75rem` (summary items), `0.375rem` (dock) — and every row inside the header
picked its own gap. They read three properties declared once on `.mlv-page`:

| Property                          | Default           | Read by                                                      |
| --------------------------------- | ----------------- | ------------------------------------------------------------ |
| `--mlv-page-chrome-block-padding` | `--mlv-spacing-3` | header, summary items, dock                                  |
| `--mlv-page-chrome-row-gap`       | `--mlv-spacing-2` | the header's stacked rows                                    |
| `--mlv-page-chrome-item-gap`      | `--mlv-spacing-2` | every row inside the header, the dock regions, the facts row |

All three scale with **density**; the header's two title type roles do not. A
compact data table wants a tighter bar, not a smaller page title — the type
roles stay a `size` decision, and mixing the two would make `density` a
typographic input by accident.

The header also declares its own collapsed floor:
`--mlv-page-header-row-height` (`--mlv-height-l`, or `--mlv-height-m` under
`size="s"`) and `--mlv-page-header-floor`, which is that plus twice the chrome
block padding. The title row's `min-height` reads the first, the header's
`min-block-size` reads the second, so "expanded height minus collapsed height"
has a real second term instead of an emergent one.

`--mlv-page-measure` (`48rem`) is the reading measure the header's description
and any other prose column caps itself at.

### Full-bleed top chrome and page inset

The padding modifiers publish the inset as `--mlv-page-inset` on
`.mlv-page__inner`, which derives `--mlv-page-inset-inline` and
`--mlv-page-inset-block` from it and feeds the padding shorthand from those two.
`--mlv-page-inset` stays the knob a consumer sets; chrome geometry reads the
axis names, so a full-bleed margin can never borrow the other axis.
`mlv-page-header`, `mlv-page-summary`, and `mlv-page-dock`
are pulled full-bleed with negative margins (the header also to the top edge,
the dock to the bottom edge; the header's own radius is zeroed — the page host
clips the rounded corners). Each of those components pads its content inline
with `max(var(--mlv-page-inset-inline), var(--mlv-spacing-3))`, so their content
stays aligned with the page edge padding at any inset.

**Where the negative margins come from differs, and it matters:**

- `mlv-page-dock` applies its own `margin-inline` / `margin-bottom` in
  `page-dock.scss`, computed from the **inherited** `--mlv-page-inset-inline`
  and `--mlv-page-inset-block`. Custom
  properties inherit through any depth, so the dock keeps its full-bleed
  geometry inside a consumer wrapper — a `<form>`, a `<section>` — and collapses
  to zero outside a page, where the property is unset.
- **`mlv-page-header` and `mlv-page-summary` derive theirs the same way now.**
  They used to be `.mlv-page__inner > …` child selectors, so a `<form>` or a
  `<section>` between the canvas and the chrome silently dropped the full-bleed
  treatment; both read the inherited properties instead, and the canvas corner
  radius is reached by a descendant selector. `:first-child` then reads as
  "first child of whatever wraps it", which is the honest claim — the page
  cannot know whether a wrapper adds a box of its own.
- **Inheritance fixes _discovery_, not containment.** A wrapper that scrolls,
  clips or pads still changes the geometry, and no amount of custom-property
  inheritance rescues that.
- **Measurement never depended on any of it.** Both register with
  `MlvPageGeometry` instead of being found by a one-shot `querySelectorAll`, so
  `--mlv-page-snap-offset` and the whole geometry contract below are correct
  for a header rendered later by an `@if` or wrapped in a `<form>`.

### Reading measure (`maxWidth`)

`maxWidth` caps the **reading column**, not the canvas. It used to set
`max-width` plus `margin-inline: auto` on `.mlv-page__inner`, so the whole
canvas narrowed and the sticky chrome narrowed with it — a header floating in
the middle of a wide window, with the application's own frame visible on both
sides of it.

`.mlv-page__inner` publishes half the slack as
`--mlv-page-measure-gutter: max(0rem, calc((100% - var(--mlv-page-max-width, 100%)) / 2))`,
every non-chrome child is capped at the measure, and the chrome spans the full
canvas and adds the gutter to its own inline padding. So a wide application gets
full-bleed chrome and a narrow measure at once, and chrome content shares one
start edge with body content.

The percentage is **substituted, not resolved**, at the point it is declared:
every consumer of the property resolves it against that same content box, which
is exactly what makes the two edges line up.

`--mlv-page-measure` (`48rem`) is a separate token — the measure prose columns
inside the chrome cap themselves at (the header description). A consumer who
wants the canvas and the prose on one measure writes
`maxWidth="var(--mlv-page-measure)"`.

### Geometry contract (`MlvPageGeometry`)

`MlvPage` provides `MlvPageGeometry`. Chrome regions register with it, it
measures them through `MlvResizeObserverService`, and it publishes the results
as **pixel lengths** on the page host. No consumer hand-measures a sticky
offset.

| Property                                            | Written by                                       | Answers                                   |
| --------------------------------------------------- | ------------------------------------------------ | ----------------------------------------- |
| `--mlv-page-scrollport-block-size`                  | coordinator, from the registered scroll viewport | the page's actual usable scrollport       |
| `--mlv-page-chrome-block-size`                      | coordinator                                      | how tall the top chrome currently is      |
| `--mlv-page-sticky-inset-block-start`               | coordinator                                      | clearance owed at the top edge            |
| `--mlv-page-sticky-inset-block-end`                 | coordinator                                      | clearance owed at the bottom edge         |
| `--mlv-page-dock-block-size`                        | coordinator                                      | the dock's in-page reservation            |
| `--mlv-page-available-block-size`                   | **CSS**, derived from three of the above         | max block size for a sticky aside         |
| `--mlv-viewport-inset-block-end`                    | `mlv-page-dock`, on the document element         | viewport clearance for portalled overlays |
| `--mlv-page-dock-height`                            | same, compatibility bridge                       | what `mlv-toast` reads today              |
| `--mlv-page-inset`, `-inline`, `-block`             | padding modifiers on `.mlv-page__inner`          | bleed and canvas padding                  |
| `--mlv-page-max-width`, `--mlv-page-surface-radius` | `MlvPage`                                        | canvas width, chrome corners              |

Five rules hold it together:

1. **Size and clearance are different questions.** `--chrome-block-size` is how
   tall the chrome is; `--sticky-inset-block-start` is what a scrollport must
   reserve. They diverge whenever the header is not sticky, which is the
   `stickyHeader="false"` case and Mantine's height-vs-offset split.
2. **Every page declares fresh local defaults** (`0px`) in `page.scss`, so one
   page's measurements never leak into another mounted beside it. The
   coordinator _removes_ a property rather than publishing `0px`, so a
   consumer's own declaration is never shadowed.
3. **Registration is dynamic and page-scoped**, with teardown — not a one-shot
   query. A region rendered by an `@if` registers like any other.
4. **Nested chrome counts once.** A summary strip projected inside the header
   is contained by the header's own measured box, so it is dropped from the sum
   rather than reserved twice.
5. **`--mlv-page-available-block-size` is derived in CSS**, clamped at `0px`
   (`max(0px, …)`), so it stays live with its three terms and never publishes a
   negative length — which would make every `calc()` reading it invalid at
   computed-value time.

Two names that were read and written by nothing survive as the **first term of
a fallback chain**, so a consumer that set them keeps winning:

- `scroll-padding-block-start: var(--mlv-page-header-offset, var(--mlv-page-sticky-inset-block-start))`
  on the page's scroll viewport. This is the WCAG 2.2 SC 2.4.11 (Focus Not
  Obscured, AA) technique; the value has to be the measured one, because the
  header collapses as the page scrolls.
- `inset-block-start: var(--mlv-page-aside-offset, calc(var(--mlv-page-sticky-inset-block-start, 0px) + var(--mlv-spacing-4)))`
  on a sticky `mlv-page-content` aside.

Consumers reading a published length should keep a `max()` floor: nothing is
published during server rendering or before the first measurement lands.

```scss
.my-panel {
  max-block-size: max(18rem, calc(var(--mlv-page-available-block-size) - var(--mlv-spacing-4)));
}
```

### Page scroll offset

`MlvPageGeometry.scrollTop` is a readonly signal fed by a passive scroll
listener on the page's scrollbar viewport, reached through the public
`MlvScrollbar.viewportElement` getter. The listener is a
`fromEvent(viewport, 'scroll', { passive: true })` stream released by
`takeUntilDestroyed(this._destroyRef)` — the ref passed explicitly because it
is bound from an `afterNextRender` callback, which is not an injection context.
(It was a raw `addEventListener` until #76; the `runOutsideAngular` wrapper is
kept for consumers still on zone-based change detection.)

It lives on the geometry coordinator rather than behind its own token because
its one consumer — the dock re-testing whether it still obstructs the viewport
— is already asking that service a geometry question. **"Is the chrome over
content?" is a different question**, and it is answered by
`MlvPageSnapController.overlapped`, not by a scroll offset: chrome that never
collapses still needs to paint its separation from content scrolling under it.

There used to be an `MLV_PAGE_SCROLL` token with a `scrolled` signal and a
`mlv-page--scrolled` host class beside it. The token had no application
consumers, the class was styled by nothing, and the one library read of
`scrolled` sat in a fallback branch that was unreachable because the page
always provides the snap controller. All of it is deleted.

### Scroll-scrubbed snap timeline

`MlvPage` provides `MlvPageSnapController`. Its progress is **scrubbed by
scroll**, not played on a clock, and reaches every chrome region as the
`--mlv-page-snap` custom property (0 fully expanded .. 1 fully snapped).

**Snap state (`MlvPage.snap`, typed `MlvPageSnapState`).** Four signals and one
method — that is the whole capability:

| Member             | Meaning                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `progress`         | 0 fully expanded .. 1 fully snapped.                                     |
| `snapped`          | `progress() >= 0.5` — closer to snapped than open.                       |
| `overlapped`       | The scroller has moved off the top (> 4px). Independent of `progress`.   |
| `collapseDistance` | Block size the chrome gives up, in px — and the timeline's whole length. |
| `expand()`         | Reveal every collapsed region, then scroll the page back to the top.     |

#### The distance is derived, never declared

There is **no scroll-distance input.** Every collapsing region measures itself
and registers the block size it gives up (`registerCollapse`, `@internal`); the
sum is `collapseDistance`, which is both the length of the timeline and the
height the page has to compensate for. Material derives it the same way —
expanded height minus collapsed height, with no distance knob at all — and for
the same reason: a hand-declared constant stands in for a measurement and is
wrong the moment a font loads, a locale changes or a row rewraps.

Four consequences worth stating:

- A page whose chrome has nothing to collapse reports `0` and never collapses.
  That is `pinned` arrived at from the geometry rather than from an input, and
  it is why `overlapped` has to be a separate signal.
- `MlvPageSnap` regions measure their own `scrollHeight`, not `offsetHeight`:
  the host's `max-block-size` is what the scrub animates, so the clamped border
  box shrinks to nothing while the content box keeps reporting the open height.
- **A clamped box cannot report its content growing** — the box stays where the
  clamp holds it, so a `ResizeObserver` on it has nothing to deliver (#317:
  description text lengthened by a tab switch stayed cut off at rest, and a
  region that rendered empty stayed invisible at every progress). A directive
  has no template, so there is no inner wrapper to observe the way
  `MlvPageSummary` observes its `__items` row. Two triggers close it instead:
  - **At rest the clamp lifts.** `.mlv-page-snap--hide` adds a step term to its
    `max-block-size` that is `100000px` at progress 0 and `0` from `0.00001`
    on (finer than any real scroll produces), so at the top the box _is_ the
    content and the host observer sees every change to it — text, a font swap,
    a density or header-`size` change, an image. Visually a no-op — at rest the
    measurement and the content are the same number (to the sub-pixel
    `scrollHeight` rounds away) — **unless something transitions
    `max-block-size`**. The rest value is an unbounded sentinel, so a
    transition starts from `100000px`: measured with a 200ms linear
    `max-block-size` transition, the first scroll step holds the box still for
    about 170ms and then snaps. Never put a `max-block-size` (or `all`) transition on a snap region;
    the scrub is already continuous. A region revealed for focus reads progress
    0 and is unclamped the same way.
  - **While scrubbing, the content is watched.** A `MutationObserver`
    (`childList` + `characterData`, subtree) and `document.fonts`
    `loadingdone` re-measure directly, so the timeline length follows a tab
    switch made with the chrome collapsed. A style-only change mid-scrub (no
    DOM mutation, no font load) is picked up on the next scrub step, which
    moves the clamp and therefore the box. Both triggers act on `hide` regions
    only: a `fade` or `keep` region is never clamped, so the box observer
    already sees every change to it and keeps the measurement current for a
    later switch to `hide`; reading it there would force a layout per mutation
    batch for a value nothing reads. The mode is read per change, since
    `mlvPageSnap` is an input.
- **In a spec, jsdom lays nothing out**, so every measurement is `0` and the
  timeline never runs. Register the measurement the browser would have
  contributed: `controller.registerCollapse(signal(96))`.

#### Three behaviours (`snapBehavior`)

| Value                            | Height                        | Re-expands                          |
| -------------------------------- | ----------------------------- | ----------------------------------- |
| `'pinned'`                       | never changes                 | n/a — only `overlapped` moves       |
| `'enterAlways'`                  | the collapsing rows leave     | on **any** pull down, at any offset |
| `'exitUntilCollapsed'` (default) | shrinks to the chrome's floor | as the scroller returns to the top  |

`exitUntilCollapsed` is the linear mapping **because** the timeline is only
`collapseDistance` pixels long: the chrome is fully collapsed for the whole
document below that, so re-expanding it means scrolling back into the first
screenful and reaching the top for the last of it. The invariant belongs to the
range, not to a latch. `enterAlways` is the one behaviour that is a function of
scroll _history_ rather than position, so it integrates the scroll delta.

Three invariants come with the triad, and the header implements them:

1. **Only the title collapses.** Leading navigation and trailing actions never
   collapse on scroll. Collapsing them into overflow on _width_ is a different
   concern.
2. **The floor is a real bar**, never zero, with its controls in the tab order
   at every fraction.
3. **Re-expansion requires returning to the top** on the collapse behaviour.

#### CSS owns the interpolation

The progress is animated by the scroller itself through a scroll-driven
animation, not written per scroll event:

```css
@property --mlv-page-scroll-snap {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}
@keyframes mlv-page-snap-scrub {
  to {
    --mlv-page-scroll-snap: 1;
  }
}
```

Four things about that are not optional:

- **The animation goes on the scroller**, `.mlv-page__scrollbar > .mlv-scrollbar__viewport`,
  not on the page host. An anonymous `scroll(self block)` timeline resolves
  against the element's own scroll container; the host is above the scrollport
  and would find nothing.
- **Longhands only.** The `animation` shorthand resets `animation-timeline`, and
  `animation-duration` stays `auto`, which is what maps a progress-based
  timeline onto the whole animation.
- **The override is read _through_ the animated property**, never written over
  it: `--mlv-page-snap: var(--mlv-page-snap-override, var(--mlv-page-scroll-snap))`.
  Animations outrank normal author declarations and a _paused_ animation still
  applies its value, so a plain write to the animated property could never win.
  `MlvPage` writes `--mlv-page-snap-override` on the viewport whenever it — not
  the timeline — is the source of progress: no scroll-timeline support, a
  behaviour the timeline cannot express, or a zero-length range.
- **The `@supports` guard is mandatory.** Firefox has not shipped scroll-driven
  animations (preference-gated in Nightly) and Safari only did in 26, so the
  JavaScript path is the fallback, not dead code.

Under `prefers-reduced-motion: reduce` the timeline **steps** between its two
ends at the halfway mark instead of scrubbing — `steps(2, jump-none)` on the
CSS side, a rounded `progress()` on the JS side. The shared reduced-motion
mixin only shortens durations, and a scroll-driven collapse has none; what the
criterion is about here is a title resizing under the reader on every wheel
notch.

#### Height compensation

Snapping shrinks in-flow chrome, which would shorten the document while the
reader is still scrolling. The height is re-added at the end of the canvas
(`.mlv-page__inner::after`) as `calc(var(--mlv-page-snap-range) * var(--mlv-page-snap))`
— exact, in CSS, with no baseline to go stale, because **every collapsing
region gives up its block size over the same 0..1 span**. The `snapFrom` /
`snapTo` stagger moves opacity, not height, which is what keeps that sum a
single multiplication. A pseudo-element and not a margin on the chrome: the
spacer must not be shadowed by a region that has stepped off the timeline to
keep a focused control visible, and `__inner` is that region's ancestor.

#### Overlays inside the page

`MlvPage` registers its viewport with the CDK `ScrollDispatcher` as a bare
`ScrollDispatcherTarget` — the dispatcher's whole contract is `elementScrolled()`
and `getElementRef()`, the `CdkScrollable` directive's only other job is a
scroll listener the page already owns, and the viewport belongs to
`mlv-scrollbar`'s template where no attribute of ours can reach. Without it
every overlay anchored inside the page — a menu, a tooltip, a select panel —
keeps its `reposition` and `close` scroll strategies deaf to page scrolling.

`overlapped` is the second signal Material and UIKit both keep separate from
the collapse fraction, for the reason both give: a bar pinned at full height
has a collapse fraction of zero forever and still has to know it is sitting
over content. `mlv-page-header--scrolled` is driven by `overlapped`, not by
progress.

The controller class itself (`MlvPageSnapController`) is **not exported** —
consumers reach the capability through `MlvPage.snap`, and library components
inside the page inject the class from the package-internal module.

#### The pin is gone

`pinned`, `setPinned()`, `toggle()`, `collapse()` and
`spacerScale` are deleted, with no replacement. They carried two pin _origins_
whose only observable difference was whether returning to the top released the
freeze, and a spacer scale that existed purely to tween away the dead space
that pinning-while-collapsed created — a feature that manufactured a bug and
then shipped the fix. Arbitrary partial progress is not a useful user
preference, and with the pin gone progress has exactly one source again.

**`expand()` reveals collapsed chrome for a programmatic focus.** A collapsed
snap region is `visibility: hidden`, so a consumer's `focus()` on a control
inside it is silently refused. `expand()` therefore reveals every registered
region **synchronously**, before anything scrolls, so the naive sequence works:

```ts
// A component that hosts the page reaches the capability through the page.
private readonly page = viewChild.required(MlvPage);

onEscapeToTop(): void {
  this.page().snap.expand();
  this.activeHeaderTab()?.focus();
}
```

The page registers _how_ to scroll (`registerScroller`), because it is the only
thing that knows which element scrolls; the scroll is smooth unless
`prefers-reduced-motion` is set. The reveal closes when the scroll **arrives**
— a smooth scroll has no fixed duration — with a 700ms fallback for a scroll
that is interrupted, refused, or never registered. A reveal that never closed
would leave invisible tab stops behind, which is the exact defect the hidden
state exists to prevent. `revealing` (`@internal`) is the bridge flag the
regions read in between.

### `MlvPageSnap` (`[mlvPageSnap]`)

Every element can define its own state on the snap timeline: the directive
remaps the page progress into the element's stagger window and applies a
behaviour — `hide` (height + opacity collapse, default), `fade`, or `keep`.

| Input                 | Default   | Description                                            |
| --------------------- | --------- | ------------------------------------------------------ |
| `mlvPageSnap`         | `'hide'`  | Behaviour (`'hide' \| 'fade' \| 'keep'`; `''` = hide). |
| `snapFrom` / `snapTo` | `0` / `1` | Stagger window for the **content fade**.               |

There is no size input. A `hide` region measures its own open height
(`scrollHeight`, re-measured through `MlvResizeObserverService`, a
`MutationObserver` over its content and `document.fonts` `loadingdone`),
publishes it as `--mlv-snap-size`, and contributes it to the page's
`collapseDistance`. At rest its clamp lifts, so the region is never cut off at
a stale size, and a `max-block-size` transition on it freezes then snaps — see
§ _The distance is derived, never declared_.

**Which progress drives what is a deliberate split.** Block size follows the
**page** progress, so the collapsing chrome always gives up exactly
`collapseDistance × progress` pixels and the compensation spacer is one CSS
multiplication with no baseline to go stale. The `snapFrom` / `snapTo` window
drives only opacity and transform, which is where a stagger is legible anyway —
regions fading at slightly different moments read as one motion; regions
_resizing_ at different moments do not, and cost the exactness. Opacity reaches
zero exactly at `snapTo`, the same fraction at which the region hides, so
visual and semantic disappearance coincide instead of the content vanishing
early behind a lead multiplier.

Fully elapsed `hide`/`fade` elements get `visibility: hidden` so they leave
the accessibility tree and tab order — a control nobody can see must not be an
invisible tab stop. The behaviour CSS lives in `page.scss`
(`.mlv-page-snap--hide/--fade`), so it is only active inside a page.

**Focus contract (`MlvPageSnapRegionBase`).** The collapse is driven by
_scrolling_, not by a user action, so hiding it unconditionally would let a
scroll blur whatever the user had focused — the browser drops that focus to
`<body>` and the next Tab restarts at the top of the page. A region therefore
**never hides while it holds focus**: `focusin`/`focusout` (with a
`relatedTarget` containment test, so moving between two controls inside the
region does not count as leaving) drive a `mlv-page-snap--revealed` /
`mlv-page-summary--revealed` class that zeroes the region's local
`--mlv-snap-progress`, taking it off the timeline until focus leaves. Nothing
relocates focus, and the mouse-only scrub — nothing focused — is unchanged.
`MlvPageSnap` and `MlvPageSummary` share the contract through
`MlvPageSnapRegionBase`; a subclass supplies its own end-of-window test and
binds `_hidden()` / `_revealed()` plus the two focus listeners in its `host`.

The base also implements the `MlvPageSnapRegion` methods the controller calls —
`reveal()` lifts the hide immediately (ahead of change detection, so a
same-task `focus()` lands) and `syncHiddenState()` re-applies it when the
reveal window closes without a render in between. Both are controller
plumbing; consumers call `expand()`, never these.

## Application integration

Five opt-in pieces, all reaching the live page through one root
`MlvPageRegistry`. Each `main[mlvPage]` registers itself for its lifetime, and
`registry.active()` is the most recently registered live page — the one
arriving, while a route animation or a view transition holds two at once.

**`active` is a documented heuristic, not a guarantee.** A secondary page inside
a split view registers like any other, so an application with two live pages
should pass an explicit target rather than let the heuristic pick.

### Route focus (`provideMlvPageRouteFocus`)

```ts
provideMlvPageRouteFocus({ strategy: 'focus' });
```

| Strategy            | What happens                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| `'focus'` (default) | Focus moves to the arriving `<main>` landmark                             |
| `'announce'`        | Focus is left alone; the page's name is spoken through a live region      |
| `'both'`            | Both — deliberately not the default, because it says the same thing twice |

The landmark already carries `tabindex="-1"`, so focusing it announces the
landmark, starts reading from its top, and makes the next Tab continue inside
the new content instead of restarting at the top of the document. `'announce'`
is the right one for a list-detail flow where the reader is still working the
list.

`announceWith` produces the string (default: the page's own visible `<h1>`,
falling back to `document.title`; returning `null` announces nothing), and
`includeSameRouteNavigations` defaults to `false` — an in-page anchor is not a
new page, and stealing focus from it would undo the jump the reader asked for.

### Skip link (`a[mlvPageSkipLink]`)

```html
<a mlvPageSkipLink>Skip to content</a>
```

WCAG 2.4.1 (Bypass Blocks, A) without a coordinated id: the link reads the id
and the `tabindex="-1"` off whichever page is on screen. The `href` is real, so
the destination shows in the status bar and the control degrades to a fragment
jump without JavaScript; the click is still handled, because under a router a
bare fragment `href` is a navigation and this needs to move focus rather than
change the URL.

**With no page mounted it emits no `href` at all** — an anchor without one is
not a link and not a tab stop, so the control withdraws instead of becoming a
focusable no-op. It is a component rather than a directive because the
hidden-until-focused treatment needs a stylesheet.

Pass `[mlvPageSkipLink]="someElement"` to target a specific landmark.

### Scroll restoration (`provideMlvPageScrollRestoration`)

`withInMemoryScrolling()` silently does nothing for a page that owns an inner
scrollport: Angular's `ViewportScroller` scrolls the **document**, so
restoration saves and restores a number that never moves, and anchor scrolling
goes with it. Nothing throws and nothing is logged — the position simply never
comes back.

`MlvPageViewportScroller` scrolls the live page's registered scrollport instead,
falling back to the document when there is none. Its anchor offset is
**measured** by default: the page already publishes the clearance its sticky
chrome owes as `stickyInsetBlockStart`, which is exactly what an anchor has to
clear, and it changes as the chrome collapses. `setOffset()` still overrides it.

### View transitions (`mlvPageViewTransitionHook`)

```ts
provideRouter(routes, withViewTransitions({ onViewTransitionCreated: mlvPageViewTransitionHook() }));
```

During a view transition the old side is a **still image** and the new side
stays live, so a scroll-scrubbed collapse still running in that window animates
one against the other — the old header frozen at whatever progress it had, the
new one still moving, the crossfade blending two collapse states. While a
transition is in flight the page pauses its scrub: the CSS timeline through a
`[data-mlv-page-view-transition]` attribute on the document element, the
JavaScript fallback through `MlvPageViewTransition.active`. Overlapping
transitions are depth-counted, so the first to finish does not lift a freeze the
second still needs.

**No page component stamps a `view-transition-name` by default.** Those names
must be unique across the document and a duplicate does not warn — the browser
skips _every_ transition on the page — and two live page headers is exactly what
a route transition is. Chrome a shell has only one of can be named, which is
what the opt-in stylesheet does:

```json
"styles": ["node_modules/@malva-ui/core/styles/page-view-transitions.css"]
```

It names the shell's topbar and sidebars so they hold still while the canvas
crossfades. List it **after** `malva-ui.css`, or write
`@import '@malva-ui/core/styles/page-view-transitions.css';` in a global
stylesheet, which resolves through core's `./styles/*` export. The stylesheet
first ships in the release that introduces `mlvPageViewTransitionHook` (#275,
after `0.1.15`); no earlier release has either.

## `MlvPageHeader`

The header renders a predictable hierarchy: leading context, one semantic page
title with inline status and trailing actions, a supporting description, a
metadata row, and a navigation row. **Six projected element regions and one
template**, all optional.

| Region                 | Where it renders                              | Collapses on scroll |
| ---------------------- | --------------------------------------------- | ------------------- |
| `[mlvPageContext]`     | above the title — breadcrumb, back link, icon | no                  |
| `[mlvPageTitle]`       | the title row (**an `ng-template`**)          | crossfades          |
| `[mlvPageStatus]`      | inline, directly after the title              | no                  |
| `[mlvPageActions]`     | trailing edge of the title row                | no                  |
| `[mlvPageDescription]` | below the title row                           | 0–0.6               |
| `[mlvPageMeta]`        | below the description                         | 0.15–0.75           |
| `[mlvPageTabs]`        | the bottom navigation row                     | never               |

`[mlvPageContext]` is one region, not three stacked rows: it also replaces the
header's built-in back link, which forwarded a restricted destination to a
router link _and_ emitted a click — conflating "navigate to this destination"
with "go back" — while making every consumer of the header pull in
`@angular/router` for a link most of them never rendered. A back link is now
the consumer's own `<a mlvLink routerLink="…">` inside that region.

`[mlvPageTabs]` is likewise one region, not a tab strip plus a trailing action
slot: it is a flex row, so a projected tab group takes the free inline size and
anything after it sits at the trailing edge.

| Input          | Type                     | Default            | Description                                                                |
| -------------- | ------------------------ | ------------------ | -------------------------------------------------------------------------- |
| `size`         | `MlvPageHeaderSize`      | `'m'`              | `'s'` renders the compact record-editor header with a smaller title scale. |
| `tabsAlign`    | `MlvPageHeaderTabsAlign` | `'start'`          | Centers the tabs row when `'center'`.                                      |
| `snapControls` | `boolean`                | `false`            | Shows the expand chevron in the title row once the chrome is snapped.      |
| `expandLabel`  | `string \| undefined`    | `undefined` → i18n | Accessible label of the expand chevron. Falls back to `page.expandHeader`. |

| Method         | Returns   | Description                                                             |
| -------------- | --------- | ----------------------------------------------------------------------- |
| `focusTitle()` | `boolean` | Focuses the title role currently on screen; `false` when there is none. |

Consumers should project exactly one semantic `<h1>` through `[mlvPageTitle]`.

#### The title template holds the title and nothing else

`[mlvPageTitle]` is the one **template** region, and the header instantiates it
**twice** — once per type role (see _The title is two nodes_ below). Anything
with identity or state declared inside it therefore exists twice, in ways the
consumer cannot see from their own template:

| Declared in the title slot  | What actually happens                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id="…"`                    | The id is in the document twice; `getElementById` answers with the copy that is `inert` while the header is collapsed. **The header warns in dev.** |
| `tabindex="-1"`             | Two focus candidates, one of them `inert`, which silently refuses focus                                                                             |
| `ng-template[mlvDialog]`    | Two dialog hosts — one open request renders two dialogs                                                                                             |
| A control, a trigger, a CVA | Two instances registering with whatever they register with                                                                                          |

Two consequences worth spelling out, because both were live defects the rebuild
had to fix in `apps/docs`:

- **A leading nav trigger goes in `[mlvPageContext]`**, not inline with the
  `<h1>`. That region is a projected _element_, rendered once, and a back link
  or menu button is leading context by definition.
- **The focus target is `focusTitle()`**, not an id the route wrote. A "back to
  the top" handler calls it and reads the returned boolean; the header focuses
  whichever of its two `tabindex="-1"` title nodes is live. The nodes are
  programmatic targets only — neither is ever a tab stop.

### Collapse state (`MLV_PAGE_HEADER_STATE`, `exportAs: 'mlvPageHeader'`)

The header publishes three signals — `progress`, `collapsed`, `titleClipped` —
and there are two ways in, neither of which needs an output forwarded or state
mirrored into the consumer's component:

```html
<mlv-page-header #header="mlvPageHeader">…</mlv-page-header> <span>{{ header.collapsed() }}</span>
```

```ts
// From a projected region — the element injector reaches the header it is
// declared inside.
readonly state = inject(MLV_PAGE_HEADER_STATE);
```

`titleClipped` is **reported, never acted on**: it says the title node
currently on screen is wider than its box, and how a truncated title should
degrade — a tooltip, a shorter string, a second line — is the consumer's
decision. It follows whichever of the two title roles is exposed, so a title
that does not fit at `h4` but does at `h6` reports `true` expanded and `false`
snapped.

**Snap behaviour (scrubbed).** Inside `main[mlvPage]` the header takes its
progress from `--mlv-page-snap`. **The title block collapses; the navigation
does not.** The description gives up its height over the 0–0.6 window and the
meta row over 0.15–0.75 (both regions declaring their own window, see
_Regions are projected elements_); the context row, the tabs row, the status
and the actions stay exactly where they are.
Both platforms make that choice for the same reason — navigation is the thing a
reader needs _most_ once scrolled — and it is what makes the collapsed bar a
real bar rather than a strip of leftovers.

**The title is two nodes, not one interpolated font size.** The header renders
the projected title twice, at two complete type roles (`m`: h2 → h4, `s`:
h4 → h6), stacked in one grid cell and crossfaded: the expanded role fades out
linearly, the collapsed one arrives on a back-loaded curve. Nothing
interpolates a `font-size`, so each role keeps its own weight and tracking
instead of a shrunk title wearing display tracking at text size — the reason
the `h3`–`h6` letter-spacing tokens were added. Only the pair's shared grid
cell is scrubbed, between the two heights the header measures off the nodes
themselves; that measured delta is also what the title contributes to the
page's `collapseDistance`.

Rendering the title twice is a duplicate for the accessibility tree, so exactly
one node is exposed at a time: the inactive one takes `aria-hidden` **and**
`inert`, because an opacity-zero heading is still announced and still focusable
on the web. A `display: none` would not do — the node has to stay laid out to
be measurable.

That is also the whole cost of the crossfade, and it is paid by the consumer's
template rather than by the header: see _The title template holds the title and
nothing else_ above for what must not be declared inside it, and use
`focusTitle()` rather than reaching for a node by id.

**The node declares the type role; the projected heading adopts it.** The role
lives on `.mlv-page-header__title-node`, and a projected heading inherits every
part of it — `font-size`, `font-weight`, `line-height`, `letter-spacing` —
through an explicit `inherit` on `&__title-node :is(h1, h2, h3, h4, h5, h6)`.
Without that, the UA's own `h1 { font-size: 2em }` wins over the inherited
value and the title renders at **double** whichever role the node resolved:
measured on `/page`'s record editor, `size="s"` asked for a 20px title and got
40px, wrapping to three lines and taking 165px of a 538px header on a 390px
canvas. A bare `<h1>` is the shape every showcase and example writes, so that
was the common case, not the edge one. It defeats the `size` input outright,
and it defeats the collapse with it: the crossfade's clipped cell is sized from
the two measured nodes, so a title that wraps in _both_ roles is cut mid-scrub
instead of shrinking.

Only the UA default is neutralised. **A heading that declares its own role is
left alone** — `.mlv-title[data-level]` is 0,2,0 against the rule's 0,1,1, so an
`<h1 mlvTitle>` keeps whatever level it asked for. That is the consumer's call
and stays one, but it is worth knowing what it costs: pinning both nodes to the
same size makes the measured delta zero, so such a title contributes **nothing**
to the page's `collapseDistance` and the crossfade has nothing to cross. Two of
the `/page` examples are written that way. `titleClipped` still reports on it.

Pinned by `page-header.spec.ts` § _two titles, exactly one exposed_, which reads
the compiled stylesheet rather than a computed style: jsdom resolves no `var()`,
so every type role computes to `''` there and a `getComputedStyle` comparison
between the node and its heading would pass whatever the rule said.

**A narrow canvas holds the title to one line.** Below `40rem` the title node is
`white-space: nowrap` + `text-overflow: ellipsis`, and the cell above it gets
`min-inline-size: 0` so the un-wrappable text ellipses instead of setting the
flex row's width.

This is not a typographic preference — it is what keeps the collapse from
cutting the title. The cell is `overflow: hidden` and scrubs between the two
roles' **measured** heights, while the large role holds full opacity until the
small one starts fading in at 0.6 snap. So a title that wraps on a narrow canvas
is not merely tall: through the first two thirds of the gesture the reader
watches the only visible heading lose its second line and then get sliced
through the middle of the first. Measured on `/page`'s record editor at a 375px
canvas: `--mlv-page-header-title-size` was **50px** against a 23px collapsed
size, so 27px of a visible heading was removed mid-gesture. With the rule it is
25px against 23px — a worst-case 1.6px of descender slack, at a scrub position
where the large role is down to 0.125 opacity.

A wide canvas keeps wrapping, because there the second line is a real line of a
real headline and the cell is measured to hold it. The narrow canvas makes the
other trade: the tail of a long title is worth less than a collapse that reads.
Nothing is removed from the accessibility tree — `text-overflow` truncates
painted glyphs, not the text node — and `titleClipped` is exactly how a consumer
learns it happened.

**The node ellipses; a projected heading is inlined so it can.**
`text-overflow` acts on the block box that directly contains the overflowing
inline text, so a block-level `<h1>` child would clip and ellipse _itself_ and
leave the node's own box exactly as wide as its content. `titleClipped` is
`scrollWidth > clientWidth` **on the node**, so it would then report `false` for
a title the reader can plainly see truncated — measured at 375px with the
heading left block-level: node 287/287, the `<h1>` inside it 291/287. The narrow
block therefore also sets `display: inline` on a projected heading, which keeps
one element both painting the ellipsis and measuring it. That is a
box-generation change, not a semantic one: the heading keeps its role and level.
It is deliberately not `display: contents`, which has historically dropped
heading semantics outright in some engines.

Both halves are pinned in `page-header.spec.ts` § _responsive withholding_, again
on the compiled stylesheet — jsdom resolves no container query, so a
`getComputedStyle` assertion there could only ever read the wide-canvas
fallback. The second test also asserts the ellipsis is **not** on the heading,
which is the shape that silently breaks `titleClipped`.

`mlv-page-header--scrolled` (raised shadow) follows the snap controller's
`overlapped`, so chrome that is not collapsing still marks itself as sitting
over content. Action regions force `white-space: nowrap` on buttons/links.

**Projected summary row.** `<ng-content select="mlv-page-summary" />` renders
a projected summary strip as the chrome's bottom row: one glass surface, one
border, one sticky element — no seam between panels. Inside the header the
strip drops its own background/blur/border and goes full-bleed against the
header padding.

**Snap control.** With `snapControls`, a single chevron sits in the title row —
in reading order, in the tab order, after the actions — and expands the chrome:
it reveals every collapsed region and scrolls the page back to the top, which
is what makes the collapse release. It renders only while the chrome is
actually snapped and only when a page snap controller is present; expanding an
expanded header does nothing, so the control would otherwise be a dead tab stop
for the whole time the reader is at the top. It paints no surface of its own —
it is a control inside the chrome, not a control floating over content, so it
needs neither its own background nor clearance from a neighbour.

## `MlvPageSummary`

Key-facts strip rendered directly under the header. It is a **description
list**: the strip renders a `<dl class="mlv-page-summary__facts">` and each
projected `div[mlvPageSummaryItem]` renders `<dt>` (its `label`) and `<dd>`
(the projected value). **Purely presentational**:
the collapse is driven by the page's scroll through `MlvPageSnapController` —
the strip measures its own natural row height with a `ResizeObserver`,
registers it as its share of the page's `collapseDistance`, scrubs that height
against `--mlv-page-snap`, fades over its own stagger window, and turns
`visibility: hidden` once fully collapsed — unless it holds focus, in which case it reveals itself
(`mlv-page-summary--revealed`) rather than let a scroll blur a projected
interactive fact into `<body>`; see the snap focus contract above. Breaking
change: the former `collapsed`/`pinned` models, `collapseOnScroll`, and the
strip-owned controls were removed. As a `MlvPageSnapRegionBase` subclass it
also carries the controller-facing `reveal()` / `syncHiddenState()` pair.

| Input          | Type                  | Default            | Description                                                          |
| -------------- | --------------------- | ------------------ | -------------------------------------------------------------------- |
| `summaryLabel` | `string \| undefined` | `undefined` → i18n | Accessible name of the facts list. Falls back to `page.pageSummary`. |
| `snapFrom`     | `number`              | `0.1`              | Progress at which collapsing starts.                                 |
| `snapTo`       | `number`              | `0.95`             | Progress at which it is fully collapsed.                             |

### Why the item is `div[mlvPageSummaryItem]`

A `<dl>`'s content model admits only `<dt>`/`<dd>` groups, `<div>`, `<script>`
and `<template>` between the list and its terms. A custom element there fails
axe's own `definition-list` and `dlitem` rules — so the item is an attribute
component on a real `<div>`, not an element component nested one level deeper
inside one. `<mlv-page-summary-item>` matches nothing.

The BEM names (`.mlv-page-summary-item`, `__label`, `__value`) and the
`data-slot="page-summary-item"` handle are unchanged. What moved is the strip's
own structure: `.mlv-page-summary__items` keeps the padding, and the `<dl>`
inside it — `.mlv-page-summary__facts` — carries the gaps, the `overflow` clip
and the accessible name.

Project the strip **inside** `mlv-page-header` (the header renders a
dedicated `mlv-page-summary` content slot as its bottom row) so the whole
chrome is one sticky surface. A legacy sibling strip after the header still
works but renders its own surface. The items row carries bottom clearance for
the chrome's floating snap controls riding its bottom edge.

## `MlvPageDock`

Bottom workflow action bar. Projects `[mlvPageDockStart]` (status text),
`[mlvPageDockCenter]` (tool cluster, truly centered), and `[mlvPageDockEnd]`
(primary actions) into a `1fr auto 1fr` grid.

| Input        | Type                    | Default | Description                                                            |
| ------------ | ----------------------- | ------- | ---------------------------------------------------------------------- |
| `sticky`     | `boolean`               | `true`  | Keeps the dock attached to the bottom edge of the page scroll area.    |
| `appearance` | `MlvPageDockAppearance` | `'bar'` | Solid glass bar, or the floating gradient-masked backdrop (see below). |

**`appearance="floating"`** drops the dock's own glass surface — whatever
floats inside it, e.g. a pill action bar, brings that — and replaces it with
the `mlvFloatingContainer` recipe from `@malva-ui/cdk/floating-container`,
pulled in through the shared `floating-container.mixins.scss`: a `::before`
backdrop bleeding `2.5rem` above the dock with
`mask-image: linear-gradient(180deg, transparent, black 2.5rem)`, plus
`padding-block-end: max(var(--mlv-spacing-1-5), env(safe-area-inset-bottom))`.
Content scrolling underneath therefore fades out instead of running into the
actions. The modifier sets `isolation: isolate` so the `z-index: -1` backdrop
has a stacking context even when the dock is not sticky. Override the backdrop
fill with `--mlv-page-dock-backdrop` (default `--mlv-background-base`).

**Wrapping.** Buttons and links keep `white-space: nowrap` so a label never
breaks mid-word, but the three regions are `flex-wrap: wrap`: four actions
reflow onto a second row on a narrow canvas instead of overflowing the grid
column. With room to spare nothing wraps and the single-line look is unchanged.
A projected `nav[mlvActionBar]` needs its own `wrap` input to do the same.

**Wrapper-tolerant geometry.** The full-bleed margins are derived from the
inherited `--mlv-page-inset`, not from a `.mlv-page__inner > …` child selector,
so a `<form>` or `<section>` between the page canvas and the dock does not
break them. `mlv-page-header` and `mlv-page-summary` derive theirs the same way
— see "Full-bleed top chrome and page inset" above.

**Two different published questions.** The dock measures its own border-box
height (`MlvResizeObserverService` from `@malva-ui/cdk/utils`, started from
`afterNextRender` so nothing runs during server rendering) and that one
measurement answers two things that are not the same:

- **In-page reservation.** It registers as the page's block-end region, so
  `main[mlvPage]` publishes `--mlv-page-dock-block-size` and — while sticky —
  folds it into `--mlv-page-sticky-inset-block-end` and the derived
  `--mlv-page-available-block-size`. See "Geometry contract" above.
- **Viewport clearance.** While the dock actually reaches the bottom edge of
  the screen it publishes `--mlv-viewport-inset-block-end` on
  `document.documentElement`, with `--mlv-page-dock-height` carrying the
  identical value as a compatibility bridge until it is retired. Viewport-
  anchored CDK overlays — most importantly bottom toast positions, see
  `libs-toast.md` — read it so they are never rendered underneath the dock.

**A `position: sticky` declaration is not evidence of viewport obstruction.** A
dock pinned halfway down a document-scrolled page covers nothing a portalled
overlay would use, so the second publication is gated on the dock's own rect
reaching `innerHeight`, re-tested as the page scrolls. When the element has no
layout at all (server rendering, a detached tree, jsdom) the geometry cannot
answer and the dock's own `sticky` state is trusted, rather than silently
withdrawing a real reservation.

Contributions are tracked per dock instance and the tallest one wins, so two
mounted pages during a route transition cannot clobber each other; both
properties are removed once the last contributor is destroyed or stops
obstructing.

## `MlvPageContent`

`MlvPageContent` lays out primary content and an optional complementary column. It observes its own content-box width with `MlvResizeObserverService`, so stacking follows the space actually available after sidebars rather than the viewport width.

| Input         | Type                | Default   | Description                                                                                                                          |
| ------------- | ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `asideWidth`  | `string`            | `'20rem'` | Preferred inline aside width.                                                                                                        |
| `asideSticky` | `boolean`           | `true`    | Keeps the inline aside visible while the page scrolls.                                                                               |
| `gap`         | `MlvPageContentGap` | `'m'`     | Gap between the primary and complementary columns — and the content's own top padding, which used to be a fixed `0.5rem` regardless. |
| `stackBelow`  | `number`            | `1024`    | Container width in CSS pixels below which the columns stack.                                                                         |

### The aside is the consumer's own landmark

```html
<mlv-page-content asideWidth="18rem">
  <section><!-- primary content --></section>
  <aside mlvPageAside aria-label="Project details"><!-- … --></aside>
</mlv-page-content>
```

The component contributes the grid area and nothing else, so the landmark, its
role and its accessible name are all expressible without an input each. In dev
mode the region warns when its host is neither an `<aside>` nor
`role="complementary"`, and when a landmark carries no `aria-label` /
`aria-labelledby` — warned from the region rather than from the parent, which
could not introspect a projected template to say either thing.

**There is no `asidePlacement`.** The old `'start'` value moved the column
before the main content _visually while leaving it after the main content in
the DOM_ — a reading and focus order that disagreed with the rendered page,
introduced by a layout convenience. Neither `order` nor `grid-template-areas`
can fix that: assistive technology and sequential focus follow the DOM. A
genuinely leading complementary column is a claim about reading order, and the
honest way to make it is to write that content first — which a component
wrapping the main column cannot express, and no longer pretends to.

### Aside track reservation

- The complementary grid track exists **only while an `[mlvPageAside]` element is actually projected**. The component sets `mlv-page-content--has-aside` on the host from a `contentChild(MlvPageAside)` query, and the SCSS keys the two-track definition (and the stacked two-row definition) on that class.
- Without an aside the host is a single `minmax(0, 1fr)` track / `'main'` area, so a consumer that projects no aside keeps the full inline size instead of losing `asideWidth` to an empty track. No opt-in input; no `:has()`; consumer-side overrides that collapsed the track are no longer needed.
- Inline geometry is scoped `--has-aside:not(--stacked)`, so it cannot out-specify the stacked single-column rules.

## Usage

```html
<mlv-page-shell>
  <header mlvActionBar mlvPageTopbar><!-- global navigation --></header>
  <mlv-sidebar mlvPageSidebar><!-- primary navigation --></mlv-sidebar>

  <main mlvPage maxWidth="90rem">
    <mlv-page-header>
      <nav mlvBreadcrumb mlvPageContext [items]="breadcrumbs"></nav>
      <ng-template mlvPageTitle><h1>Project Atlas</h1></ng-template>
      <div mlvPageTabs><!-- mlv-tab-group --></div>
    </mlv-page-header>

    <mlv-page-content asideWidth="18rem">
      <section><!-- cards and feature content --></section>
      <aside mlvPageAside aria-label="Project details"><!-- … --></aside>
    </mlv-page-content>
  </main>
</mlv-page-shell>
```

Record-editor composition (compact header, summary strip, dock):

```html
<main mlvPage>
  <mlv-page-header size="s" tabsAlign="center" snapControls>
    <ng-template mlvPageTitle><h1>{{ name() }}</h1></ng-template>
    <mlv-badge mlvPageStatus tone="warning" muted>Draft</mlv-badge>
    <div mlvPageActions><!-- draft/live toggle, menus --></div>
    <p mlvPageDescription hideOn="narrow"><!-- supporting copy --></p>
    <div mlvPageTabs><!-- mlv-tab-group, then any trailing control --></div>
  </mlv-page-header>

  <mlv-page-summary>
    <div mlvPageSummaryItem label="Price">329 USD</div>
  </mlv-page-summary>

  <!-- tab-switched content; any element may opt into the snap timeline: -->
  <p mlvPageSnap="fade" [snapFrom]="0.5" [snapTo]="1">Secondary hint</p>

  <mlv-page-dock>
    <span mlvPageDockStart>6 pending changes</span>
    <div mlvPageDockCenter><!-- tool cluster --></div>
    <div mlvPageDockEnd><!-- Discard / Schedule / Save / Publish --></div>
  </mlv-page-dock>
</main>
```

## Dependencies

- Angular core/common/router
- `@angular/cdk/coercion`
- `@lucide/angular`
- `@malva-ui/cdk` (`MlvStructural`, `MlvResizeObserverService`)
- `@malva-ui/cdk/overlay` (`MlvOverlayInitialFocus`)
- `@malva-ui/cdk/utils` (`MlvBreakpointService`, `MlvBreakpoint`, `mlvNextId`)
- `@malva-ui/cdk/floating-container` — **SCSS only**: `page-dock.scss` `@use`s
  `floating-container.mixins.scss` for the floating appearance. The mixins are
  inlined at compile time, so this is not a runtime or package dependency (and
  the Nx graph does not model it — see the same arrangement with `libs/styles`).
- `@malva-ui/core/button` (summary chevron/pin controls)
- `@malva-ui/core/drawer` (compact end-pane renderer)
- `@malva-ui/core/expand` (summary collapse animation)
- `@malva-ui/core/link`
- `@malva-ui/core/scrollbar` (page scroll owner; `viewportElement` feeds the scroll context)
- `@malva-ui/i18n` (`MLV_PAGE_I18N` — the summary strip's list name and the
  header's expand-chevron label)
- `@angular/cdk/a11y` (`LiveAnnouncer`, for the `announce` route-focus strategies)

## Testing

- `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run core-page:test`
- `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run core-page:typecheck`
- `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run core-page:lint`
- `page-end-pane.spec.ts` covers inline/compact rendering, single-template migration, logical lifecycle outputs, focus restoration, Escape/backdrop dismissal, tab-order removal, axe, and destroy-while-open cleanup.
- `page-chrome-surface.spec.ts` pins the whole chrome-surface contract: each of
  the three page bars resolving the same three-step fill chain, none of them
  painting a `backdrop-filter`, the over-content step declared once on the page
  host and re-declared by no bar, the shell frame on semantic tokens with no
  `neutral-900` literal left, both themes giving the tokens a **real step** off
  the canvas (the defect it replaces was two identical values, so "the token
  exists" proves nothing), and a DOM test that the host class follows
  `overlapped` and not `progress`. `action-bar.spec.ts` carries the fourth bar's
  half, because a cross-project stylesheet read here would fail in a project
  `nx affected` never selects for that change.
- `page-nested-scrollbar.spec.ts` guards the child-scoped scrollport rules.
- `page-surface-radius.spec.ts` guards the published padding-box curve.
- `page-routing.spec.ts` covers the registry, route focus (both strategies and
  the same-route case), the skip link's absent-`href` state, and the scroller.
