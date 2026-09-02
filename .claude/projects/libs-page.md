---

# Library: page

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you change this library's API, layout, accessibility, styling, tests, or packaging.

## Overview

`@malva-ui/core/page` provides composable application-page primitives. `mlv-page-shell` owns the reusable geometry that joins an existing action bar, zero to two start sidebars, one optional static or responsive end pane, and the rounded Page canvas; the projected navigation components retain their own behavior. The remaining primitives own page scrolling, structured headers, a collapsible key-facts summary strip, responsive main/aside content, and a bottom workflow action dock.

Record-editor experiences (draft/live switches, version history, diff views, suggestions, delayed publish) are built by **composition**: this library ships the structure, slots, and scroll-linked behaviour; the host owns the domain state. See docs page example 3 for the full pattern.

## Public API

Exported from `libs/core/page/src/index.ts`:

| Export                     | Kind             | Selector / values                    |
| -------------------------- | ---------------- | ------------------------------------ |
| `MlvPageShell`             | Component        | `mlv-page-shell`                     |
| `MlvPageTopbar`            | Shell slot       | `[mlvPageTopbar]`                    |
| `MlvPageSidebar`           | Shell slot       | `[mlvPageSidebar]`                   |
| `MlvPageEndSidebar`        | Shell slot       | `[mlvPageEndSidebar]`                |
| `MlvPageEndPane`           | Component        | `mlv-page-end-pane`                  |
| `MlvPageEndPaneContent`    | Template slot    | `ng-template[mlvPageEndPaneContent]` |
| `MlvPageEndPaneTrigger`    | Button directive | `button[mlvPageEndPaneTrigger]`      |
| `MlvPage`                  | Component        | `main[mlvPage]`                      |
| `MlvPageHeader`            | Component        | `mlv-page-header`                    |
| `MlvPageContent`           | Component        | `mlv-page-content`                   |
| `MlvPageBreadcrumb`        | Template slot    | `[mlvPageBreadcrumb]`                |
| `MlvPageHeaderIcon`        | Template slot    | `[mlvPageHeaderIcon]`                |
| `MlvPageTitle`             | Template slot    | `[mlvPageTitle]`                     |
| `MlvPageHeaderStatus`      | Template slot    | `[mlvPageHeaderStatus]`              |
| `MlvPageHeaderActions`     | Template slot    | `[mlvPageHeaderActions]`             |
| `MlvPageHeaderDescription` | Template slot    | `[mlvPageHeaderDescription]`         |
| `MlvPageHeaderMeta`        | Template slot    | `[mlvPageHeaderMeta]`                |
| `MlvPageHeaderTabs`        | Template slot    | `[mlvPageHeaderTabs]`                |
| `MlvPageHeaderTabsActions` | Template slot    | `[mlvPageHeaderTabsActions]`         |
| `MlvPageAside`             | Template slot    | `[mlvPageAside]`                     |
| `MlvPageSummary`           | Component        | `mlv-page-summary`                   |
| `MlvPageSummaryItem`       | Component        | `mlv-page-summary-item`              |
| `MlvPageDock`              | Component        | `mlv-page-dock`                      |
| `MlvPageDockStart`         | Dock slot        | `[mlvPageDockStart]`                 |
| `MlvPageDockCenter`        | Dock slot        | `[mlvPageDockCenter]`                |
| `MlvPageDockEnd`           | Dock slot        | `[mlvPageDockEnd]`                   |
| `MLV_PAGE_SCROLL`          | Token            | `MlvPageScrollState`                 |
| `MlvPageScrollState`       | Interface        | `{ scrollTop; scrolled }`            |
| `MlvPageSnapController`    | Service          | provided by `MlvPage`                |
| `MlvPageSnap`              | Directive        | `[mlvPageSnap]`                      |
| `MlvPageSnapRegionBase`    | Abstract base    | focus contract for snap regions      |
| `MlvPageSnapRegion`        | Interface        | `{ reveal; syncHiddenState }`        |
| `MlvPageSnapMode`          | Type             | `'hide' \| 'fade' \| 'keep'`         |
| `MlvPageDockAppearance`    | Type             | `'bar' \| 'floating'`                |
| `MlvPageScroll`            | Type             | `'auto' \| 'none'`                   |
| `MlvPagePadding`           | Type             | `'none' \| 's' \| 'm' \| 'l'`        |
| `MlvPageSurface`           | Type             | `'anchored' \| 'flat'`               |
| `MlvPageHeaderSize`        | Type             | `'m' \| 's'`                         |
| `MlvPageHeaderTabsAlign`   | Type             | `'start' \| 'center'`                |
| `MlvPageAsidePlacement`    | Type             | `'start' \| 'end'`                   |
| `MlvPageContentGap`        | Type             | `'s' \| 'm' \| 'l'`                  |

## `MlvPageShell`

`MlvPageShell` is the application-page composition boundary. It supplies stable topbar/body/content tracks, continuous dark chrome, and the integration styling that turns a collapsed `mlv-sidebar` into a rail beside an attached Page canvas. Consumers project existing navigation components through marker directives; Page does not duplicate their interaction logic.

- `[mlvPageTopbar]` spans the shell above every column.
- `[mlvPageSidebar]` marks zero to two start sidebars. Repeated hosts project in their author DOM order.
- `[mlvPageEndSidebar]` optionally adds one static shell-level end sidebar after the canvas.
- `mlv-page-end-pane` adds a responsive trailing pane that becomes a modal Drawer below its configured breakpoint.
- Unmarked content occupies the central canvas track and should normally be one `main[mlvPage]`.

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

| Input        | Type             | Default | Description                                                                                       |
| ------------ | ---------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `color`      | `string \| null` | `null`  | CSS chrome background color. Supports literals, named colors, and resolved `var(...)` references. |
| `foreground` | `string \| null` | `null`  | Optional foreground override; otherwise black or white is selected from WCAG contrast.            |

When `color` is set, the browser resolves it in the shell's real CSS cascade.
The component composites translucent colors over ancestor backgrounds, then
chooses the black or white endpoint with the higher WCAG contrast ratio. It
recomputes when the input, a referenced custom property, or an ancestor theme
attribute changes. Invalid or cyclic values leave the default chrome intact.

```html
<mlv-page-shell color="#7138d0">…</mlv-page-shell>

<mlv-page-shell [style.--brand-shell]="brandColor()" color="var(--brand-shell)"> … </mlv-page-shell>

<mlv-page-shell color="var(--brand-shell)" foreground="var(--brand-on-shell)"> … </mlv-page-shell>
```

Consumers can continue to override
`--mlv-page-shell-chrome-background` and
`--mlv-page-shell-chrome-foreground` directly. The `color` and `foreground`
inputs take precedence while present; without inputs, the existing custom
property cascade remains unchanged.

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
| `--mlv-background-neutral-1-active` | foreground 12 %      | Same — e.g. the workspace switcher's open state.                                      |
| `--mlv-sidebar-hover-bg`            | foreground 8 %       | Row hover / focus-visible fill (see `libs-sidebar.md` → **State surfaces**).          |
| `--mlv-sidebar-active-bg`           | foreground 12 %      | Active row pill.                                                                      |
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

`&__topbar .mlv-form-control-wrapper` / `&__sidebar .mlv-form-control-wrapper`
carry the matching remap for projected form controls (container background,
border ramp, text and focus tokens) — same chrome-background mix, unchanged
percentages (10 / 30 / 40 / 50 for the field fill/border ramp; 78 / 78 / 60 for
the action/text-secondary/text-tertiary foregrounds).

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

| Output         | Description                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `openedChange` | Model output emitted when the logical `opened` state changes.                                            |
| `afterOpened`  | Emits once for each logical false-to-true transition. Breakpoint migration does not emit.                |
| `afterClosed`  | Emits once after a real close and after the active renderer is gone. Breakpoint migration does not emit. |

Public methods `open()`, `close()`, and `toggle()` update the same logical
model. `button[mlvPageEndPaneTrigger]` requires a pane instance, toggles it,
and mirrors `aria-expanded` plus `aria-controls`. The pane host owns a stable
`panelId`, so that relationship resolves while open, closed, inline, or modal.

The pane captures the pre-open active element only on a logical false-to-true
transition. Its internal Drawer disables its own focus restoration; the pane
restores focus once after a real close. Moving an already-open pane across the
breakpoint neither restores focus nor emits a false close event.

## `MlvPage`

`MlvPage` enhances a native `<main>` landmark and uses an internal `mlv-scrollbar` as the page scroll owner by default. It generates a unique id and sets `tabindex="-1"` so route focus management has a predictable target; set `id` explicitly when a skip link needs a stable application-level target. With `scroll="none"`, the scrollbar is disabled and **its own** viewport is clipped so a consumer-owned nested region can handle scrolling.

Both rules the page aims at that viewport are child-scoped, and any new one must be — `.mlv-page__scrollbar > .mlv-scrollbar__viewport` (`overflow-x: hidden`, `scroll-padding-top`, `overflow-anchor: none`) and `.mlv-page--scroll-none .mlv-page__scrollbar > .mlv-scrollbar__viewport` (`overflow: clip`). Page content routinely brings its own `mlv-scrollbar` (`mlv-chat`, an external-scroller `mlv-textarea`, and the `scroll="none"` region itself), and a descendant combinator would clip those nested viewports and kill their horizontal axis for a page-level decision nobody made about them — breaking the exact composition `scroll="none"` exists for. Guarded by `libs/core/page/src/lib/page/page-nested-scrollbar.spec.ts`; `mlv-scrollbar`'s own rules were scoped the same way in issue #98, documented in that library's CLAUDE.md.

| Input          | Type             | Default      | Description                                                             |
| -------------- | ---------------- | ------------ | ----------------------------------------------------------------------- |
| `id`           | `string`         | generated    | Unique landmark id; may be set explicitly for skip-link targeting.      |
| `scroll`       | `MlvPageScroll`  | `'auto'`     | Page-owned vertical scrolling or consumer-owned scrolling.              |
| `maxWidth`     | `string \| null` | `null`       | Maximum width of the centered inner canvas.                             |
| `padding`      | `MlvPagePadding` | `'m'`        | Responsive content inset.                                               |
| `surface`      | `MlvPageSurface` | `'anchored'` | Rounded anchored canvas or flat surface.                                |
| `stickyHeader` | `boolean`        | `true`       | Makes a projected `mlv-page-header` sticky within the page scroll area. |
| `snapRange`    | `number`         | `96`         | Scroll distance in px mapped onto the full 0..1 snap timeline.          |

`MlvPage` also exposes its snap controller as a `snap` getter, so a component
that only _hosts_ the page (and therefore cannot inject the controller) can
reach it with `viewChild(MlvPage).snap` — see `expand()` below.

The anchored surface rounds only the top corners. This makes the page read as one continuous canvas rather than a detached card floating inside the application shell.

The host rounds its border box and publishes the matching _padding_-box curve as
`--mlv-page-surface-radius` (`calc(var(--mlv-radius-xl) - 0.0625rem)` when
anchored, `0rem` when flat). A **first-child** `mlv-page-header` /
`mlv-page-summary` consumes it for its own top corners; full-bleed chrome
further down the page stays square.

That radius cannot be left to the host's `overflow: clip`. The header and the
summary strip paint a glass surface with `backdrop-filter`, and a filtered
backdrop is composited into a backdrop root that an ancestor's _rounded_
overflow clip never reaches — verified in Chromium: forcing
`backdrop-filter: none` on the header rounds the corners, restoring the blur
squares them off again. Clipping on `.mlv-page__inner` is **not** the
alternative: `overflow` there makes `__inner` the nearest scroll container for
the sticky header, and `__inner` scrolls with the content, so the header would
stop sticking — and every inline-rendered overlay would be cut off at the canvas
edge.

### Chrome surface (glass)

Header, summary strip, and dock share the `mlv-action-bar` glass recipe:
translucent background (`color-mix(in srgb, var(--mlv-elevation-bg-3),
transparent 50%)`, overridable via `--mlv-page-chrome-bg` /
`--mlv-page-chrome-border`) with `backdrop-filter: blur(1.25rem)` doing the
separation work over scrolled content.

### Full-bleed top chrome and page inset

The padding modifiers publish the inset as `--mlv-page-inset` on
`.mlv-page__inner`. `mlv-page-header`, `mlv-page-summary`, and `mlv-page-dock`
are pulled full-bleed with negative margins (the header also to the top edge,
the dock to the bottom edge; the header's own radius is zeroed — the page host
clips the rounded corners). Each of those components pads its content inline
with `max(var(--mlv-page-inset), var(--mlv-spacing-3))`, so their content stays
aligned with the page edge padding at any inset.

**Where the negative margins come from differs, and it matters:**

- `mlv-page-dock` applies its own `margin-inline` / `margin-bottom` in
  `page-dock.scss`, computed from the **inherited** `--mlv-page-inset`. Custom
  properties inherit through any depth, so the dock keeps its full-bleed
  geometry inside a consumer wrapper — a `<form>`, a `<section>` — and collapses
  to zero outside a page, where the property is unset.
- **`mlv-page-header` and `mlv-page-summary` must stay direct children of
  `main[mlvPage]`.** Their rules are `.mlv-page__inner > …` child selectors in
  `page.scss`, because the geometry is sibling-relative (the header's top bleed,
  and the snap-spacer handover from header to a legacy sibling summary strip
  via `:not(:has(~ .mlv-page-summary))`), and `MlvPage` measures those same
  direct children to compute `--mlv-page-snap-offset`. Wrapping either one
  silently drops both the full-bleed treatment and the snap compensation.

### Page scroll context

`MlvPage` provides itself as `MLV_PAGE_SCROLL` (`MlvPageScrollState`): readonly
`scrollTop` and `scrolled` signals fed by a passive scroll listener (attached
outside the Angular zone) on its scrollbar viewport, reached through the public
`MlvScrollbar.viewportElement` getter. `scrolled()` flips past a 4px hysteresis
threshold and also toggles a `mlv-page--scrolled` host class. Descendants
(`mlv-page-header`, `mlv-page-summary`) inject the token **optionally**, so
they keep working outside a page — just without scroll-linked behaviour.

### Scroll-scrubbed snap timeline

`MlvPage` also provides `MlvPageSnapController` and publishes its effective
progress as `--mlv-page-snap` (0 fully expanded .. 1 fully snapped) on the page
host. The progress is **scrubbed by scroll**, not played on a clock: scrolling
`snapRange` pixels (input, default `96`) moves the timeline from 0 to 1, so
20px of scroll runs exactly 20% of every snap animation. Descendant styles
interpolate with pure `calc()` from the custom property; the only time-based
motion is a short rAF tween when the chevron/pin controls change the state
manually (skipped under `prefers-reduced-motion`).

Controller API: `progress`/`pinned`/`snapped`/`spacerScale` signals,
`toggle()` (snap fully open/closed — a manual pin, otherwise the next scroll
event would undo it; collapsing also tweens `spacerScale` to 0 so the
compensation spacer is reclaimed), `expand()` / `collapse()` (the same manual
pin, driven imperatively), `setPinned(boolean)` (freeze at the
current progress / release back to scroll-following). Pin origin matters: a
manual (chevron) pin survives everywhere with the spacer reclaimed; a
scroll-origin (pin button) pin auto-releases at the top of the page.

**`expand()` also reveals collapsed chrome for a programmatic focus.** A
collapsed snap region is `visibility: hidden`, so a consumer's `focus()` on a
control inside it is silently refused. `expand()` therefore reveals every
registered region **synchronously**, before its own tween runs, so the naive
sequence works:

```ts
// A component that hosts the page reaches the controller through the page.
private readonly page = viewChild.required(MlvPage);

onEscapeToTop(): void {
  this.page().snap.expand();
  this.activeHeaderTab()?.focus();
}
```

A component _inside_ `main[mlvPage]` injects `MlvPageSnapController` directly
instead. `revealing` (`@internal`) is the bridge flag the regions read between
the call and the tween leaving their window.

### `MlvPageSnap` (`[mlvPageSnap]`)

Every element can define its own state on the snap timeline: the directive
remaps the page progress into the element's stagger window and applies a
behaviour — `hide` (height + opacity collapse, default), `fade`, or `keep`.

| Input                 | Default   | Description                                            |
| --------------------- | --------- | ------------------------------------------------------ |
| `mlvPageSnap`         | `'hide'`  | Behaviour (`'hide' \| 'fade' \| 'keep'`; `''` = hide). |
| `snapFrom` / `snapTo` | `0` / `1` | Stagger window on the 0..1 timeline.                   |
| `snapSize`            | `'3rem'`  | Nominal expanded size for the `hide` height scrub.     |

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

## `MlvPageHeader`

The header renders a predictable hierarchy for breadcrumb/back navigation, one semantic page title, inline status, actions, supporting description, metadata, and a tabs row. All content areas are optional structural template slots.

| Input / output | Type                           | Default              | Description                                                                |
| -------------- | ------------------------------ | -------------------- | -------------------------------------------------------------------------- |
| `back`         | `string \| string[] \| null`   | `null`               | Optional Router destination for a built-in back link.                      |
| `backLabel`    | `string`                       | `'Back'`             | Visible and accessible back-link text.                                     |
| `sticky`       | `boolean`                      | `false`              | Makes this header sticky independently of `MlvPage`.                       |
| `size`         | `MlvPageHeaderSize`            | `'m'`                | `'s'` renders the compact record-editor header with a smaller title scale. |
| `tabsAlign`    | `MlvPageHeaderTabsAlign`       | `'start'`            | Centers the tabs row when `'center'`.                                      |
| `snapControls` | `boolean`                      | `false`              | Floating chevron/pin controls on the header's bottom edge.                 |
| `toggleLabel`  | `string`                       | `'Toggle header'`    | Accessible label of the chevron control.                                   |
| `pinLabel`     | `string`                       | `'Pin header state'` | Accessible label of the pin control.                                       |
| `backClick`    | `OutputEmitterRef<MouseEvent>` | —                    | Emits when the built-in back link is activated.                            |

Consumers should project exactly one semantic `<h1>` through `[mlvPageTitle]`.
`[mlvPageHeaderStatus]` renders inline right after the title — intended for
draft/live badges or an unsaved indicator.

**Snap behaviour (scrubbed).** Inside `main[mlvPage]` the header interpolates
from `--mlv-page-snap`: the title scrubs down one type scale (`m`: h2 → h4,
`s`: h4 → h6), the breadcrumb row collapses over the 0–0.5 window, and the
tabs row over 0.3–0.85 (both via `[mlvPageSnap]`). Meta, title, status, and
actions stay visible. `mlv-page-header--scrolled` (raised shadow) applies past
2% progress. Action regions force `white-space: nowrap` on buttons/links.

**Projected summary row.** `<ng-content select="mlv-page-summary" />` renders
a projected summary strip as the chrome's bottom row: one glass surface, one
border, one sticky element — no seam between panels. Inside the header the
strip drops its own background/blur/border and goes full-bleed against the
header padding.

**Snap controls.** With `snapControls`, a small solid-surface chevron and pin
(tight density, raised background/shadow — they float over arbitrary content)
straddle the header's bottom edge — with a projected summary row that edge is
the bottom of the whole chrome. The sticky header keeps them visible at any
scroll position; they render only when a page snap controller is present. The
chevron (`aria-expanded`, rotation scrubbed from progress) snaps the chrome
fully open/closed — a **manual** pin that also reclaims the geometry spacer
(no dead space above content, even at the top). The pin (`aria-pressed`)
freezes the current state against scrolling — a **scroll-origin** pin that
releases itself when the user returns to the top, where the frozen scroll
artifact would only leave empty space. Its icon switches from `pin` to
`pin-off` and it takes the active accent while pinned.

## `MlvPageSummary`

Key-facts strip rendered directly under the header. Projects
`mlv-page-summary-item` children (`label` input + projected value content) in
a wrapping row inside an accessible `role="group"`. **Purely presentational**:
collapse/expand and pinning are driven by the header's snap controls through
`MlvPageSnapController` — the strip itself just scrubs its height (against a
`ResizeObserver`-measured natural row height) and opacity from
`--mlv-page-snap` over its stagger window, and turns `visibility: hidden`
once fully collapsed — unless it holds focus, in which case it reveals itself
(`mlv-page-summary--revealed`) rather than let a scroll blur a projected
interactive fact into `<body>`; see the snap focus contract above. Breaking
change: the former `collapsed`/`pinned` models, `collapseOnScroll`, and the
strip-owned controls were removed. As a `MlvPageSnapRegionBase` subclass it
also carries the controller-facing `reveal()` / `syncHiddenState()` pair.

| Input          | Type     | Default          | Description                              |
| -------------- | -------- | ---------------- | ---------------------------------------- |
| `summaryLabel` | `string` | `'Page summary'` | Accessible name of the facts region.     |
| `snapFrom`     | `number` | `0.1`            | Progress at which collapsing starts.     |
| `snapTo`       | `number` | `0.95`           | Progress at which it is fully collapsed. |

Project the strip **inside** `mlv-page-header` (the header renders a
dedicated `mlv-page-summary` content slot as its bottom row) so the whole
chrome is a single sticky glass surface. A legacy sibling strip after the
header still works but renders its own surface. The items row carries bottom
clearance for the chrome's floating snap controls riding its bottom edge.

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
break them. See "Full-bleed top chrome and page inset" above for the header /
summary constraint, which is _not_ wrapper-tolerant.

**Published height.** While `sticky`, the dock measures its own border-box
height (`MlvResizeObserverService` from `@malva-ui/cdk/utils`, started from
`afterNextRender` so nothing runs during server rendering) and publishes it as
`--mlv-page-dock-height` on `document.documentElement`. Viewport-anchored CDK
overlays — most importantly bottom toast positions, see `libs-toast.md` — read
it so they are never rendered underneath the dock. Contributions are tracked
per dock instance and the tallest one wins, so two mounted pages during a route
transition cannot clobber each other; the property is removed once the last
sticky dock is destroyed or `sticky` goes false.

## `MlvPageContent`

`MlvPageContent` lays out primary content and an optional complementary `<aside>`. It observes its own content-box width with `MlvResizeObserverService`, so stacking follows the space actually available after sidebars rather than the viewport width.

| Input            | Type                    | Default             | Description                                                  |
| ---------------- | ----------------------- | ------------------- | ------------------------------------------------------------ |
| `asidePlacement` | `MlvPageAsidePlacement` | `'end'`             | Places the aside before or after primary content.            |
| `asideWidth`     | `string`                | `'20rem'`           | Preferred inline aside width.                                |
| `asideSticky`    | `boolean`               | `true`              | Keeps the inline aside visible while the page scrolls.       |
| `gap`            | `MlvPageContentGap`     | `'m'`               | Gap between the primary and complementary columns.           |
| `stackBelow`     | `number`                | `1024`              | Container width in CSS pixels below which the columns stack. |
| `asideLabel`     | `string`                | `'Related content'` | Accessible name for the aside landmark.                      |

### Aside track reservation

- The complementary grid track exists **only while an `[mlvPageAside]` template is actually projected**. The component sets `mlv-page-content--has-aside` on the host from the same `contentChild(MlvPageAside)` query that renders the `<aside>`, and the SCSS keys the two-track definition (and the stacked two-row definition) on that class.
- Without an aside the host is a single `minmax(0, 1fr)` track / `'main'` area, so a consumer that projects no aside keeps the full inline size instead of losing `asideWidth` to an empty track. No opt-in input; no `:has()`; consumer-side overrides that collapsed the track are no longer needed.
- Inline geometry is scoped `--has-aside:not(--stacked)` so the compound `--has-aside.--aside-start` selector cannot out-specify the stacked single-column rules.

## Usage

```html
<mlv-page-shell>
  <header mlvActionBar mlvPageTopbar><!-- global navigation --></header>
  <mlv-sidebar mlvPageSidebar><!-- primary navigation --></mlv-sidebar>

  <main mlvPage maxWidth="90rem">
    <mlv-page-header>
      <ng-template mlvPageBreadcrumb>
        <nav mlvBreadcrumb [items]="breadcrumbs"></nav>
      </ng-template>
      <ng-template mlvPageTitle><h1>Project Atlas</h1></ng-template>
      <ng-template mlvPageHeaderTabs><!-- mlv-tab-group --></ng-template>
    </mlv-page-header>

    <mlv-page-content asidePlacement="end" asideWidth="18rem">
      <section><!-- cards and feature content --></section>
      <ng-template mlvPageAside><!-- complementary content --></ng-template>
    </mlv-page-content>
  </main>
</mlv-page-shell>
```

Record-editor composition (compact header, summary strip, dock):

```html
<main mlvPage>
  <mlv-page-header size="s" tabsAlign="center" snapControls>
    <ng-template mlvPageTitle><h1>{{ name() }}</h1></ng-template>
    <ng-template mlvPageHeaderStatus>
      <mlv-badge tone="warning" muted>Draft</mlv-badge>
    </ng-template>
    <ng-template mlvPageHeaderActions><!-- draft/live toggle, menus --></ng-template>
    <ng-template mlvPageHeaderTabs><!-- mlv-tab-group --></ng-template>
  </mlv-page-header>

  <mlv-page-summary>
    <mlv-page-summary-item label="Price">329 USD</mlv-page-summary-item>
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

## Testing

- `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run core-page:test`
- `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run core-page:typecheck`
- `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run core-page:lint`
- `page-end-pane.spec.ts` covers inline/compact rendering, single-template migration, logical lifecycle outputs, focus restoration, Escape/backdrop dismissal, tab-order removal, axe, and destroy-while-open cleanup.
