---
# Library: tabs

The overflow trigger explicitly uses `type="button"` to remain form-safe.

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

`@malva-ui/core/tabs` provides a full-featured, accessible tab group component for the Malva UI design system. It supports horizontal and vertical orientations, animated content transitions, overflow handling (tabs that don't fit in the header move to a popup "More" menu), keyboard navigation, and two-way binding for the active tab.

The library is built entirely with Angular signals, uses `ChangeDetectionStrategy.OnPush`, and is compliant with ARIA tab panel patterns (`role="tablist"`, `role="tab"`, `role="tabpanel"`).

### `@angular/aria` integration (Phase 2 · Task 2.3)

The tablist's roving focus, arrow-key navigation, selection and ARIA wiring are delegated to `@angular/aria`'s headless tabs pattern (migrated from a hand-rolled `FocusKeyManager`):

- `MlvTabGroup` host-applies aria `Tabs` (`hostDirectives: [Tabs]`).
- The header (`.mlv-tab-group__header`) is `ngTabList`; each visible `mlv-tab-item` carries `ngTab [value]`.
- The active panel (`mlv-tab-content`) is `ngTabPanel` and wraps `[mlvTabContent]` 1:1 in an `ngTabContent` structural directive; inert stub `ngTabPanel`s (`.mlv-tab-group__panel-stub`, `display:none`) are rendered for the other visible tabs so every `ngTab`'s `aria-controls` resolves (aria's dev validator requires a matching panel; the overflow architecture renders only the active panel's real content).

aria now owns `role="tab"/"tablist"/"tabpanel"`, `aria-selected`, `aria-disabled`, `aria-orientation`, the roving `tabindex`, and auto-wires `aria-controls` ↔ `aria-labelledby` by matching `value` (no more manual id computation). Pins on `ngTabList`: `selectionMode="follow"` (auto-select on arrow, as before), `[softDisabled]="false"` (skip/never-select disabled tabs, as before), `[wrap]="false"` (no wrap, as before). RTL is now correct via CDK `Directionality` (the old `FocusKeyManager` hard-coded `'ltr'`). `mlv-tab-item` keeps its own click/Enter/Space→`activate` handlers; Enter/Space `stopPropagation()` so aria's tablist keydown does not additionally activate the roving-focused tab, preserving the historical "keyboard activation targets the event's tab" contract. The former "Arrow past the last visible tab opens the overflow popup" shortcut was dropped — the "More" button stays mouse/Tab/Enter reachable.

---

## External panels (`panels="external"` + `[mlvTabPanel]`)

A tab strip is routinely part of a page's sticky chrome while its content
belongs in the page body. Those are different places in the layout and cannot be
one element's children, so `panels="external"` renders **no panel body at all**
— the strip is the whole component — and one `[mlvTabPanel]` elsewhere carries
the content.

```html
<mlv-page-header>
  <div mlvPageTabs>
    <mlv-tab-group #tabs panels="external" [(activeTab)]="section">
      <mlv-tab value="overview" label="Overview" />
      <mlv-tab value="activity" label="Activity" />
    </mlv-tab-group>
  </div>
</mlv-page-header>

<mlv-page-content>
  <section [mlvTabPanel]="tabs">…the active section…</section>
</mlv-page-content>
```

**What the arrangement replaces.** The shape it used to take was one empty
`mlvTabContent` per tab, rendering a stub panel purely so `aria-controls`
resolved to _something_. A reference that resolves to an empty element is not a
panel relationship — it is a valid id pointing at nothing a reader can use.

**What the panel claims, and what it does not.** It takes `role="tabpanel"`, a
tab stop, and an `aria-labelledby` naming the selected tab, so a reader arriving
in the panel is told which tab it belongs to and can Tab into it from the strip.
It does **not** make the tabs point back: `aria-controls` is written by
`@angular/aria` from a panel inside the group's own DI scope, and an element in
a different part of the layout is not that. The APG lists `aria-controls` on a
tab as _recommended_, not required — one honest half of the relationship beats
two halves whose second resolves to an empty stub.

Three details that follow from that:

- **`MlvTabGroup.activeTabId`** is the public signal the panel points at: the
  DOM id of the selected tab, or `null` when the selected tab is not in the
  visible row (it is in the overflow menu, or nothing is selected). An
  `aria-labelledby` pointing at a tab that is not rendered would name the panel
  after nothing.
- **The `group` input is optional**, not required. The group is routinely
  reached with a `viewChild()`, and a template reference variable declared
  inside an `@if` is not visible outside it — a strip in a page header usually
  is inside one. That query is `undefined` on the first render, and a panel with
  no name yet is still a panel; a required input would throw on the first pass
  instead.
- **One panel that changes**, not one panel per tab. The consumer swaps its
  content on the group's `activeTab`, which is what makes the arrangement
  expressible at all.

Tab element ids are deterministic (`mlv-tab-N-<value>`, with non-id characters
folded to `-`), so the strip and the external panel derive the same value
without either querying the DOM. The prefix is unique per group rather than per
document, which is what keeps two values differing only in folded characters
from colliding across groups.

---

## Public API

Exported from `libs/core/tabs/src/index.ts`:

| Export                 | Kind            | Description                                                                                                                    |
| ---------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `MlvTabGroup`          | Component       | Root container. Renders the tab header (list + indicator) and active content panel.                                            |
| `MlvTab`               | Component       | Invisible definition node. Declares a single tab's value, disabled state, and its label/content templates.                     |
| `MlvTabDef`            | Directive       | Structural directive applied to an `<ng-template>` inside `<mlv-tab>` to define the tab label.                                 |
| `MlvTabDefContext`     | Type            | Template context for `mlvTabDef` — `{ $implicit: boolean }` where `$implicit` is `true` when the tab is in the overflow popup. |
| `MlvTabContentDef`     | Directive       | Structural directive applied to an `<ng-template>` inside `<mlv-tab>` to define the panel content.                             |
| `MlvTabItem`           | Component       | Low-level clickable tab button rendered inside the header. Receives `active`/`disabled` inputs and emits `activate`.           |
| `MlvTabContent`        | Component       | Wrapper for the active panel; applies CSS entry/leave animation classes.                                                       |
| `TAB_GROUP`            | Injection Token | `InjectionToken<MlvTabGroupAccessor>` — lets child components access the parent `MlvTabGroup` without a direct import.         |
| `MlvTabGroupAccessor`  | Interface       | Contract exposed via `TAB_GROUP`: `activeTab`, `orientation`, `selectTab()`, `isActive()`.                                     |
| `MlvTabOrientation`    | Type            | `'horizontal'                                                                                                                  | 'vertical'` |
| `MlvTabAppearance`     | Type            | `'underline' \| 'boxed'` — header visual style (Phase A). Orthogonal to `orientation`; composes with horizontal & vertical.    |
| `MlvTabsService`       | Service         | Scoped service (provided by `MlvTabGroup`) that manages tab registration, visible/overflow split, and forced-visible logic.    |
| `MlvTabPanel`          | Directive       | `[mlvTabPanel]` — marks an element elsewhere in the document as the panel of a `panels="external"` group.                      |
| `MlvTabPanelPlacement` | Type            | `'inline' \| 'external'` — where the group renders its panels.                                                                 |

---

## Components

### `MlvTabGroup`

**File:** `libs/core/tabs/src/lib/tabs/tabs.ts`

**Selector:** `mlv-tab-group`

**Purpose:** The root shell. Renders the header (`role="tablist"`), the animated active indicator bar, the overflow "More" popup, and the active tab's content panel.

#### Inputs (models / signals)

| Name          | Type                                                           | Default        | Description                                                                                                                                                                                                                                                                                                                           |
| ------------- | -------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orientation` | `model<MlvTabOrientation>`                                     | `'horizontal'` | Layout direction. `'horizontal'` stacks tabs in a row; `'vertical'` stacks them in a column. Two-way bindable.                                                                                                                                                                                                                        |
| `activeTab`   | `model<string>`                                                | `''`           | Value of the currently selected tab. Two-way bindable. Auto-selects the first tab if the value is empty or does not match any registered tab. **Suppressed in routed mode** — the URL owns the active tab.                                                                                                                            |
| `appearance`  | `input<MlvTabAppearance>`                                      | `'underline'`  | Header visual style. `'underline'` shows the sliding indicator bar (non-active tabs get a grey hover line at the indicator position); `'boxed'` is a segmented control — grey content-width track with a white pill that slides behind the active tab. **Orthogonal to `orientation`** — a boxed group can be horizontal or vertical. |
| `panels`      | `input<MlvTabPanelPlacement>`                                  | `'inline'`     | Where the panels render. `'external'` renders **no panel body at all** — see "External panels" above.                                                                                                                                                                                                                                 |
| `mlvDensity`  | `input<MlvDensity>` (via `MlvDensityDirective` host directive) | inherited      | Content density for the group. Adds `mlv-tab-group--<density>` on the host; `tab-item.scss` scales padding/font-size per level (tight/compact/comfortable/spacious/airy). Inherits from the nearest density ancestor when unset.                                                                                                      |

#### Internal signals / computed

| Name                    | Description                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `selectedTab`           | `computed<string \| undefined>` — bridges `activeTab` to the aria `ngTabList` `selectedTab` model (`'' → undefined`). |
| `visibleTabs`           | `computed` — tabs that fit in the header (delegates to `MlvTabsService.visibleTabs`).                                 |
| `overflowTabs`          | `computed` — tabs hidden from the header (delegates to `MlvTabsService.overflowTabs`).                                |
| `activeContentTemplate` | `computed<TemplateRef<unknown> \| null>` — the `mlvTabContent` template for the active tab.                           |

`activeTabId` is **public**, not internal: `computed<string | null>` — the DOM id of the selected tab element, or `null` while the selected tab is in the overflow menu or nothing is selected. `[mlvTabPanel]` points its `aria-labelledby` at it.

`_onSelectedTabChange(value)` bridges the aria `selectedTabChange` output back to `activeTab` (ignoring `undefined`).

#### Outputs

| Name                | Type                         | Description                              |
| ------------------- | ---------------------------- | ---------------------------------------- |
| `activeTabChange`   | `output<string>`             | The `activeTab` model's change output.   |
| `orientationChange` | `output<MlvTabsOrientation>` | The `orientation` model's change output. |

Both are the `model()` change outputs — there are no separate `output()` declarations.

#### Host directives

- `Tabs` (`ngTabs`) from `@angular/aria/tabs` — the container the aria tab list/panels register against (no inputs).
- `MlvDensityDirective` from `@malva-ui/cdk/density` (exposes `mlvDensity`; `MLV_DENSITY_ELEMENT` is provided as `'tab-group'`, which the directive prefixes to produce `mlv-tab-group--<density>`).

#### Host bindings

```
class: 'mlv-tab-group'
[class.mlv-tab-group--horizontal]:        orientation() === 'horizontal'
[class.mlv-tab-group--vertical]:          orientation() === 'vertical'
[class.mlv-tab-group--appearance-boxed]:  appearance() === 'boxed'
```

#### Public methods

| Method              | Signature                  | Description                                                                                                                                                                                                                                   |
| ------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectTab`         | `(value: string): void`    | Activates a tab by value. No-op if the tab is disabled. **For a routed tab (one with a `[routerLink]`) it calls `router.navigateByUrl(urlTree)` instead of setting `activeTab` directly** — the resulting `NavigationEnd` drives `activeTab`. |
| `selectOverflowTab` | `(value: string): void`    | Promotes an overflow tab to visible area, then activates it.                                                                                                                                                                                  |
| `isActive`          | `(value: string): boolean` | Returns `true` if the given value matches `activeTab()`.                                                                                                                                                                                      |

#### Overflow popup methods (template-facing, public)

| Method                   | Signature                      | Description                                                                     |
| ------------------------ | ------------------------------ | ------------------------------------------------------------------------------- |
| `openOverflowPopup`      | `(): void`                     | Opens the "More" popup and resets the overflow roving index to the first entry. |
| `onMorePopupAfterOpened` | `(): void`                     | Moves focus into the popup once it finishes opening.                            |
| `onMorePopupAfterClosed` | `(): void`                     | Restores focus to the "More" trigger after the popup closes.                    |
| `onOverflowKeydown`      | `(event: KeyboardEvent): void` | Arrow/Home/End/Escape roving navigation inside the overflow popup.              |

#### Providers

- `MlvTabsService` — scoped to the component tree.
- `TAB_GROUP` → `useExisting: MlvTabGroup` — exposes `MlvTabGroupAccessor` to descendants.

#### Template structure summary

```
.mlv-tab-group__header  ngTabList [orientation] [wrap]=false [softDisabled]=false selectionMode=follow [(selectedTab)]
  @for visibleTabs
    <mlv-tab-item ngTab [value]> with ng-template mlvTabDef (context: { $implicit: false })
      label rendered directly inside the role="tab" — routed and non-routed are identical
      (no nested <a>: an anchor inside role="tab" trips axe nested-interactive)
  @if overflowTabs.length > 0
    <button .mlv-tab-group__more-trigger [mlvPopupTrigger]>
    <mlv-popup>
      <ng-template mlvPopupContent>
        <mlv-list>
          @for overflowTabs → <mlv-list-item> with ng-template mlvTabDef (context: { $implicit: true })
  <div .mlv-tab-group__indicator #indicatorRef>
.mlv-tab-group__body
  @if activeContentTemplate
    <mlv-tab-content ngTabPanel [value]=activeTab>
      <ng-template ngTabContent><ng-container [ngTemplateOutlet]=activeContentTemplate></ng-template>
  @for visibleTabs where !isActive → <div .mlv-tab-group__panel-stub ngTabPanel [value]><ng-template ngTabContent></div>
```

#### CSS

File: `libs/core/tabs/src/lib/tabs/tabs.scss`

Key classes:

- `.mlv-tab-group` — `display:flex; flex-direction:column` (row when `--vertical`); **`min-width: 0`**.
- `.mlv-tab-group__header` — `display:flex; overflow:hidden`; **`min-width: 0`**. Horizontal: bottom border shadow. Vertical: right border shadow.
- `.mlv-tab-group__indicator` — absolutely-positioned bar animated via CSS custom properties `--mlv-tab-indicator-left`, `--mlv-tab-indicator-width` (horizontal) or `--mlv-tab-indicator-top`, `--mlv-tab-indicator-height` (vertical). Duration controlled via `--mlv-tab-indicator-duration` (default `var(--mlv-duration-normal)`, 200ms).
- `.mlv-tab-group__more-trigger` — the "More (N)" overflow button.
- `.mlv-tab-group__body` — `flex:1; min-width:0; min-height:0`.

**`min-width: 0` on the block and header is load-bearing, not tidiness.** The
overflow split is computed from `headerEl.clientWidth`, so it only engages when
the group can actually be narrower than its tab row. A flex or grid item
defaults to `min-width: auto`, whose content-based minimum here is the full
width of the tab row — `overflow: hidden` on the header suppresses the
_automatic minimum size_ of a flex item, not the min-content contribution the
parent track sizes against. Without it, a tab group placed in a grid or flex
child refuses to shrink, `clientWidth` never drops, "More (N)" never appears,
and the header silently clips its trailing tabs. `tabs.spec.ts` guards both
declarations (the stylesheet is asserted directly — component styles are not
injected under jsdom, so `getComputedStyle` cannot see them).

CSS variables used:

- `--mlv-border-subtle` — header bottom/right separator box-shadow.
- `--mlv-border-normal` — non-active hover line (underline appearance).
- `--mlv-background-accent-1` — indicator bar fill.
- `--mlv-text-secondary` — more-trigger colour, same as `.mlv-tab-item` (no hover colour shift — see Hover policy under Appearance). Was the raw `--mlv-palette-neutral-400` until #302: 2.42:1 on the light page, frozen to one theme.
- `--mlv-border-focus` / `--mlv-radius-s` — more-trigger focus ring.
- `--mlv-duration-normal` — more-trigger colour transition.
- `--mlv-ease-in-out-strong` — indicator slide easing.
- `--mlv-background-neutral-1` / `--mlv-elevation-bg-4` / `--mlv-background-neutral-1-hover` / `--mlv-radius-xl` / `--mlv-radius-xs` / `--mlv-shadow-raised` / `--mlv-text-primary` — boxed appearance (track, pill, hover tint, concentric radius).

#### Appearance (Phase A)

`appearance` (`'underline' | 'boxed'`, default `'underline'`) is **orthogonal to `orientation`** — two independent inputs that compose, not a single union.

**Hover policy (both appearances):** tabs never shift text colour on hover — only the **active** state recolours. The hover affordance is positional instead: underline shows a grey line, boxed tints the item background.

`'underline'` — the classic sliding indicator bar. A non-active, non-disabled tab (and the overflow "More" trigger, which gets `position: relative` for this) shows a **grey hover line** (`::after`, `var(--mlv-border-normal)`) at the exact indicator position — bottom edge for horizontal, inline-end for vertical. Scoped via `.mlv-tab-group:not(.mlv-tab-group--appearance-boxed)`.

`'boxed'` — a **segmented control**. Under `mlv-tab-group--appearance-boxed`:

- the `__header` becomes the grey **track**: `width: fit-content` (content-width, so it can be aligned horizontally; `height: fit-content` for vertical), `background: var(--mlv-background-neutral-1)`, `border-radius: var(--mlv-radius-xl)`, `padding: 0.1875rem`, `gap: 0.125rem`, separator box-shadow dropped;
- the `__indicator` is repurposed as the **white pill that SLIDES behind the active tab** (reusing the same `left/width | top/height` animation as the underline bar) — `background: var(--mlv-elevation-bg-4)`, `box-shadow: var(--mlv-shadow-raised)`, `z-index: 0`, inset inside the track padding (`top/bottom: 0.1875rem` horizontal, `left/right: 0.1875rem` vertical), **concentric radius** `calc(var(--mlv-radius-xl) - var(--mlv-radius-xs))`;
- each `.mlv-tab-item` gets the concentric `border-radius` + `z-index: 1` (label above the pill); **non-active hover** tints `var(--mlv-background-neutral-1-hover)` (NOT `neutral-1` — that token is the track colour, making the hover invisible); the **active** item only changes `color` to `var(--mlv-text-primary)` (the sliding pill provides its background — it is _not_ given its own `background`);
- the `__more-trigger` mirrors the non-active item treatment (radius, `z-index: 1`, hover tint) — it never carries the pill.
- **Theme follows tokens only (#454):** `--mlv-elevation-bg-4` is `#ffffff` in light and high contrast and `#404040` in dark — one step above the `#262626` track, where `--mlv-background-raised` (`#1e1e1e`) would sink the pill below it. Until #454 the dark pill was a `[mlvTheme='dark'] … > .mlv-tab-group__indicator` repaint to `--mlv-palette-neutral-700` over a `raised` default: pure light and dark resolve exactly as before, but the repaint also reached light islands inside a dark page, kept the dark pill under high contrast on a dark `<html>` (2.03:1 under HC's black label) and missed a tab group that carries `mlvTheme` itself. `mlv-segmented`'s neutral pill reads the same token. No stylesheet may key on a theme attribute (`libs/styles/src/lib/theme-attribute-selectors.spec.mjs`); every arrangement is pinned in `theme-scopes.spec.mjs` and the active label on the pill scored ≥ 4.5:1 in all four themes in `tone-contrast.spec.mjs`.

**Every boxed selector uses the child combinator (`>`)** — `.mlv-tab-group--appearance-boxed > .mlv-tab-group__header > .mlv-tab-item` etc. — so a boxed group **never** restyles the tab-items/indicator of a tab-group **nested inside its panels** (e.g. demo tab-groups inside a boxed docs Examples panel). The earlier descendant-combinator version leaked boxed styling into nested underline groups; the child combinator is load-bearing, not cosmetic. Boxed composes with `--horizontal` and `--vertical` (a vertical boxed group slides the pill top/height).

#### Routed mode (Phase A2)

When **any** registered tab carries a `[routerLink]` (its `urlTree()` is non-null), the group enters **routed mode** (`_isRouted` computed). In routed mode the URL is the source of truth for the active tab:

- The group injects `Router` (`{ optional: true }` — non-routed groups work with no router provided) and subscribes to `Router.events` filtered to `NavigationEnd` (`takeUntilDestroyed`). On each event — and once on init via an effect, because the router may already be settled — `_syncActiveFromRoute()` sets `activeTab` to the value of the first tab whose `urlTree` satisfies `router.isActive(urlTree, options)`. `linkActiveOptions` is honoured: the `{ exact }` shorthand is mapped through `Router.isActive`'s boolean overload (exact ↔ subset), a full `IsActiveMatchOptions` is passed straight through.
- The **auto-select-first** effect and **`_onSelectedTabChange`** (aria's optimistic selection) both early-return while routed, so nothing sets `activeTab` behind the route's back.
- `selectTab()` navigates (`router.navigateByUrl(urlTree)`) rather than setting `activeTab`; the resulting `NavigationEnd` updates it. This covers both click and keyboard (Enter/Space) activation.
- **No header anchor.** The label renders directly inside the `role="tab"` (`<mlv-tab-item>`), for both routed and non-routed tabs. A routed tab does **not** wrap its label in an `<a href>`: an anchor is inherently interactive, and nesting it inside `role="tab"` fails the axe **`nested-interactive`** rule (a hard requirement). The trade-off is that routed tabs lose native middle-click / open-in-new-tab; the URL is still fully deep-linkable and back/forward works. (An earlier version wrapped the label in an `<a tabindex="-1" role="presentation">`, but `role="presentation"` cannot suppress a focusable anchor, so axe still flagged it — hence the removal.)
- `role="tab"` / `aria-selected` continue to come from `ngTab`; because `activeTab` is updated from the route, aria stays in sync.

**Subtlety (documented in code):** `routerLink` on `<mlv-tab>` is a URL _carrier_ on the `display:none` def node; `routerLinkActive` cannot style the separately-rendered header, so active state is owned explicitly via `Router.isActive` — intentional, not a workaround to remove later.

> `Router.isActive(url, options)` is marked `@deprecated 21.1` (superseded by the standalone `isActive()` signal function) but remains functional, long-stable public API and is not flagged by the repo's ESLint config (no type-checked/`no-deprecated` ruleset).

Overflow-menu focus restoration uses this tab group's own queried item refs;
it never performs a document-wide selector, so multiple tab groups remain
independent.

#### Active-tab pinning (content survival)

`MlvTabGroup` keeps the **active tab pinned into the visible row** via an
`effect` that mirrors `activeTab` into `MlvTabsService.forcedVisibleValue`. When
overflow is active this swaps the active tab into the last visible slot (the same
mechanism as picking a tab from the overflow popup), guaranteeing the active tab
always keeps a rendered `ngTab`.

This is load-bearing for correctness, not cosmetics: `@angular/aria` derives the
active `ngTabPanel`'s visibility from its controlling `ngTab`'s `expanded` state.
If the active tab's `ngTab` is torn down (e.g. a resize repartition pushes it into
overflow, or the old code cleared `forcedVisibleValue` on every resize), aria
desyncs its `selectedTab` model, marks the active panel `inert`, and the deferred
`ngTabContent` **destroys the panel body permanently** — the content vanishes and
never re-renders. Pinning the active tab prevents that teardown, so active content
survives any resize/repartition. (The `activeContentTemplate` panel additionally
survives even if the active tab is driven fully into overflow, because aria treats
a panel with no matching `ngTab` as visible.)

#### Overflow / resize behaviour

`MlvTabGroup` observes **every box the split reads** — the header (the width
available) plus each rendered `mlv-tab-item` and the "More (N)" trigger (the
width consumed). The target set is kept current by a tracked
`afterRenderEffect()` on `tabItems()` / `_moreTriggerRef()` / `tabListRef()`, so
a tab that renders later is still observed. The observer itself comes from
`MlvResizeObserverFactory` (`@malva-ui/cdk/utils`), not the raw global: its
`create()` answers `null` where the constructor is absent, so server rendering
is the seam's own documented case, and a spec can hand the component a double
without patching `globalThis`. `afterRenderEffect` rather than `effect` because
the body constructs an observer and that primitive structurally cannot run on
the server.

Observations are added and removed incrementally (`_syncResizeTargets`,
`_observedTargets`) rather than by `disconnect()`-and-re-observe.
Per the spec a fresh `ResizeObservation` starts at `lastReportedSizes =
[(-1,-1)]`, so `observe()` on a not-currently-observed target always delivers an
initial notification — for a `0×0` and a `display: none` box too — while
`observe()` on a live target is a no-op. `disconnect()` therefore re-arms every
target, and a settled box that never moved is notified again on each
repartition. (The trailing debounce absorbs those extra deliveries into the same
number of recalculations, so the cost is deliveries and retained detached tab
elements rather than extra work; the spec asserts the delivery count for exactly
that reason.) That same initial notification is what makes observing the tabs
work at all — it is how the split gets recomputed once the tabs finally have a
laid-out box.

A vertical group stays observed even though it never overflows —
`_recalculateOverflow` owns that case and resets the split to "all visible"
itself. The guarantee is narrower than "it recovers on switch": it is that a
group which _started_ vertical still holds a live observer, so the first resize
notification after a switch to horizontal repartitions it. (Before, the observer
was created once from `ngAfterViewInit` behind a `vertical` early return, so
such a group had no observer at all and its overflow was dead for the
component's lifetime.) `orientation()` is a dependency of nothing that
recalculates, so recovery rides on the relayout the orientation change itself
produces, not on the input write.

Observing only the header was the #232 defect: the split is a function of the
_tabs'_ widths, but the only thing that re-ran it was a change in the _header's_
size, and a header whose width comes from its parent never resizes when its
children finally get theirs. A measuring pass landing before the tabs had a
laid-out box read every `offsetWidth` as `0`, left `_tabWidths` empty and the
total at `0` — which satisfies `total <= containerWidth` — and so committed "no
overflow" for the lifetime of the component. The same held for widths that
changed without moving the header: a webfont swap, a density change, a label
retranslation.

The recalculation is **damped** to eliminate the flickering ("dizzy")
repartition that a naive per-frame recalc produces:

1. **Debounce** — ResizeObserver callbacks are coalesced with a trailing
   `setTimeout` (`_RESIZE_DEBOUNCE_MS = 64`), so a drag — or the burst of
   notifications one repartition produces across several observed boxes —
   triggers one recalculation after the widths settle rather than one per frame.
2. **Width caching (no measure→mutate loop)** — each tab's natural header width
   is cached by value (`_tabWidths`) the first time all tabs render. Subsequent
   recalculations compute the split purely from the cache and the container
   width — they never reset the rendered set to "show all" to re-measure, which
   was the source of the flicker and the observer feedback loop. The DOM is only
   expanded-to-measure when the cache is cold or a new tab was added.
3. **Hysteresis** — `_computeFittingCount(widths, containerWidth, moreButtonWidth,
currentMax)` is a pure function returning how many leading tabs fit (`-1` when
   all fit). A tab currently in overflow must clear the boundary by an extra
   `_HYSTERESIS_PX = 24` before it returns to the visible row, while a visible
   tab leaves as soon as it no longer fits. This asymmetric threshold makes the
   split a fixed point at boundary widths, so it cannot oscillate.

Together those three make the observe → notify → recalculate → repartition →
observe cycle terminate: a cold start settles in **two** recalculations and
stays there (asserted, from a cold start with nothing hand-fired).

**Settling delta, visible on first load.** Because the "More (N)" trigger is now
observed, its first appearance delivers an initial notification of its own, and
the recalculation 64 ms later runs against a _measured_ `_moreButtonWidth`
instead of `_applyOverflowFit`'s `|| 100` fallback. Where the real trigger is
narrower than 100 px and one more tab fits in the difference, a group can
therefore show N tabs at ~70 ms and N+1 at ~140 ms — a single re-partition after
load that did not happen before, when the fallback was never replaced. It is a
correctness improvement (the second answer is the right one), but it is a
behaviour change, and it settles rather than oscillating.

`MlvTabsService.visibleTabs` / `overflowTabs` guard the `maxVisibleCount === 0` case
(all tabs overflow): the active/forced tab becomes the sole visible tab instead of
duplicating the last natural tab (which previously produced an `NG0955`
duplicate-track-key warning).

---

### `MlvTab`

**File:** `libs/core/tabs/src/lib/tab/tab.ts`

**Selector:** `mlv-tab`

**Purpose:** Invisible definition node (`display:none`). Wraps a tab's value, disabled state, and two optional `<ng-template>` slots: one for the header label (`mlvTabDef`) and one for the panel body (`mlvTabContent`). Registers itself with `MlvTabsService` on init and unregisters on destroy.

#### Inputs

| Name                | Type                                                  | Default            | Description                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `value`             | `input.required<string>()`                            | —                  | Unique identifier for the tab. Used to match against `MlvTabGroup.activeTab`.                                                                                                              |
| `disabled`          | `input(false)`                                        | `false`            | When `true`, prevents the tab from being activated.                                                                                                                                        |
| `linkActiveOptions` | `input<{ exact: boolean } \| IsActiveMatchOptions>()` | `{ exact: false }` | (Phase A2) Match options controlling when this **routed** tab is considered active, mirroring `RouterLinkActive.routerLinkActiveOptions`. Only consulted when a `[routerLink]` is present. |

#### Routable tabs (Phase A2)

A consumer may put Angular's native `[routerLink]` (plus `queryParams` / `fragment` / `relativeTo` / …) directly on `<mlv-tab>`. `MlvTab` optionally self-injects the `RouterLink` directive and exposes:

| Member      | Signature             | Description                                                                                                                                               |
| ----------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `urlTree()` | `(): UrlTree \| null` | The `UrlTree` this tab links to, or `null` when no `[routerLink]` is applied. A non-null value on **any** tab switches the parent group into routed mode. |

The `routerLink` sits on the `display:none` `<mlv-tab>` def node purely as a **URL carrier** — because the header tab is rendered separately by `mlv-tab-group`, `routerLinkActive` cannot style it, so active state is derived explicitly from `Router.isActive` (see the routed-mode notes on `MlvTabGroup`). This is intentional, not a workaround.

#### Content queries

| Name              | Type                             | Description                                      |
| ----------------- | -------------------------------- | ------------------------------------------------ |
| `defTemplate`     | `contentChild(MlvTabDef)`        | The `mlvTabDef` template for the tab label.      |
| `contentTemplate` | `contentChild(MlvTabContentDef)` | The `mlvTabContent` template for the panel body. |

#### Host bindings

```
style: 'display: none'
```

---

### `MlvTabItem`

**File:** `libs/core/tabs/src/lib/tab-item/tab-item.ts`

**Selector:** `mlv-tab-item`

**Purpose:** The rendered, focusable tab button in the header. Projects its content via `<ng-content />`. Handles click and keyboard (Enter / Space) activation. The parent `mlv-tab-group` applies `@angular/aria`'s `ngTab` directive on this element, which owns `role="tab"`, `aria-selected`, `aria-disabled`, the DOM `id`, the roving `tabindex`, and `aria-controls`; this component only owns the active/disabled **styling** and the `activate` output.

#### Inputs

| Name       | Type           | Default | Description                                                                                               |
| ---------- | -------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `active`   | `input(false)` | `false` | Whether this tab is currently selected. Drives the `--active` style class only (ARIA comes from `ngTab`). |
| `disabled` | `input(false)` | `false` | Whether this tab is disabled. Drives the `--disabled` style class only.                                   |

> The former `controls` input was removed — `aria-controls` is auto-wired by `ngTab` from the matching `ngTabPanel` value.

#### Outputs

| Name       | Type             | Description                                        |
| ---------- | ---------------- | -------------------------------------------------- |
| `activate` | `output<void>()` | Emitted on click or Enter/Space when not disabled. |

#### Public methods

| Method    | Signature  | Description                                                                       |
| --------- | ---------- | --------------------------------------------------------------------------------- |
| `focus()` | `(): void` | Moves DOM focus to the tab button — used by the group's overflow/roving handling. |

#### Host bindings

```
class: 'mlv-tab-item'
[class.mlv-tab-item--active]:    active()
[class.mlv-tab-item--disabled]:  disabled()
(click):                        !disabled() && activate.emit()
(keydown.enter):                !disabled() && activate.emit(); $event.stopPropagation()
(keydown.space):                !disabled() && activate.emit(); $event.stopPropagation(); $event.preventDefault()
```

`role="tab"`, `aria-selected`, `aria-disabled`, `aria-controls`, `id`, and the roving `tabindex` are contributed by the `ngTab` directive applied on the element by `mlv-tab-group`. Enter/Space `stopPropagation()` so aria's `ngTabList` keydown does not additionally activate the roving-focused tab.

#### CSS

File: `libs/core/tabs/src/lib/tab-item/tab-item.scss`

- `.mlv-tab-item` — `inline-flex; gap:0.5rem; padding:0.75rem 1rem` (comfortable). No hover colour shift.
- Density mixins (`density.density-*`) scale padding/font-size per group `mlvDensity`: tight `0.375rem 0.625rem`, compact `0.5rem 0.75rem`, spacious `1rem 1.25rem`, airy `1.25rem 1.5rem`.
- `--active` — `color: var(--mlv-text-action)` (boxed overrides to `text-primary`).
- `--disabled` — `opacity:0.5; cursor:not-allowed`.

Boxed overrides for `.mlv-tab-item` (radius, `z-index:1`, hover tint, active colour) live in `tabs.scss` under `--appearance-boxed` via child combinators.

---

### `MlvTabContent`

**File:** `libs/core/tabs/src/lib/tab-content/tab-content.ts`

**Selector:** `mlv-tab-content`

**Purpose:** Presentational wrapper for the active panel content. It has no inputs — `role="tabpanel"`, the panel `id` and `aria-labelledby` are contributed by the `@angular/aria` `ngTabPanel` directive applied on the element by `mlv-tab-group` (which wires them to the controlling tab by matching `value`).

#### Inputs

None.

#### Host bindings

```
class: 'mlv-tab-content'
```

`role="tabpanel"`, `id`, `aria-labelledby`, and the `inert` toggle come from the `ngTabPanel` directive.

#### CSS

File: `libs/core/tabs/src/lib/tab-content/tab-content.scss`

- `.mlv-tab-content--enter` — keyframe `tab-content-enter`: fade in + slide from `-0.25rem` Y. Duration: `--mlv-tab-content-enter-duration` (default `200ms`).
- `.mlv-tab-content--leave` — keyframe `tab-content-leave`: fade out + slide to `-0.25rem` Y. Duration: `--mlv-tab-content-leave-duration` (default `150ms`).

---

## Directives

### `MlvTabDef`

**File:** `libs/core/tabs/src/lib/tab-def.ts`

**Selector:** `[mlvTabDef]`

**Purpose:** Applied to an `<ng-template>` inside `<mlv-tab>` to define the tab header label. The template is rendered inside `<mlv-tab-item>` in both the visible header and the overflow popup.

**Template context:** `MlvTabDefContext`

```ts
interface MlvTabDefContext {
  $implicit: boolean; // true when rendered in the overflow popup, false in the header
}
```

Includes an `ngTemplateContextGuard` static method for proper type narrowing.

---

### `MlvTabContentDef`

**File:** `libs/core/tabs/src/lib/tab-content-def.ts`

**Selector:** `[mlvTabContent]`

**Purpose:** Applied to an `<ng-template>` inside `<mlv-tab>` to define the panel body that is rendered inside `<mlv-tab-content>` when the tab is active.

No inputs or outputs. Exposes `templateRef: TemplateRef`.

---

## Services

### `MlvTabsService`

**File:** `libs/core/tabs/src/lib/tabs.service.ts`

**Scope:** Provided by `MlvTabGroup` (NOT `providedIn: 'root'`). Each `MlvTabGroup` instance gets its own `MlvTabsService`.

**Purpose:** Tracks all registered `MlvTab` instances; computes which tabs are visible vs. in the overflow; manages the "forced visible" state when a user selects a tab from the overflow popup.

#### Signals

| Signal               | Type                 | Description                                                                                                                                                        |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `tabs`               | `signal<MlvTab[]>`   | All registered tab components in DOM order.                                                                                                                        |
| `maxVisibleCount`    | `signal<number>`     | `-1` means no overflow (all tabs fit). A positive number limits the visible set.                                                                                   |
| `forcedVisibleValue` | `signal<string       | null>`                                                                                                                                                             | When a user picks an overflow tab, its value is stored here to swap it into the visible slot. |
| `visibleTabs`        | `computed<MlvTab[]>` | Subset of `tabs` that are displayed in the header. Implements swap logic: if a forced tab is beyond `maxVisibleCount`, it replaces the last naturally-visible tab. |
| `overflowTabs`       | `computed<MlvTab[]>` | Tabs not shown in the header. Complement of `visibleTabs`.                                                                                                         |

#### Methods

| Method         | Signature               | Description                                                                                               |
| -------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `register`     | `(tab: MlvTab): void`   | Appends the tab to the `tabs` signal. Called by `MlvTab.ngOnInit`.                                        |
| `unregister`   | `(tab: MlvTab): void`   | Removes the tab and clears `forcedVisibleValue` if it matched the removed tab's value. Called on destroy. |
| `forceVisible` | `(value: string): void` | Sets `forcedVisibleValue` to the given value (swaps it into visible area).                                |

---

## Injection Token

### `TAB_GROUP`

**File:** `libs/core/tabs/src/lib/tab-group-token.ts`

```ts
const TAB_GROUP = new InjectionToken<MlvTabGroupAccessor>('TAB_GROUP');
```

Provided via `useExisting: MlvTabGroup` inside `MlvTabGroup.providers`. Allows deeply nested components to access the parent tab group without importing `MlvTabGroup` directly.

**`MlvTabGroupAccessor` interface:**

```ts
interface MlvTabGroupAccessor {
  readonly activeTab: Signal<string>;
  readonly orientation: Signal<MlvTabOrientation>;
  selectTab(value: string): void;
  isActive(value: string): boolean;
}
```

---

## Usage Examples

### Basic horizontal tabs

```html
<mlv-tab-group [(activeTab)]="selectedTab">
  <mlv-tab value="overview">
    <ng-template mlvTabDef>Overview</ng-template>
    <ng-template mlvTabContent>
      <p>Overview content</p>
    </ng-template>
  </mlv-tab>

  <mlv-tab value="details">
    <ng-template mlvTabDef>Details</ng-template>
    <ng-template mlvTabContent>
      <p>Details content</p>
    </ng-template>
  </mlv-tab>

  <mlv-tab value="history" [disabled]="true">
    <ng-template mlvTabDef>History</ng-template>
    <ng-template mlvTabContent>
      <p>History content</p>
    </ng-template>
  </mlv-tab>
</mlv-tab-group>
```

### Vertical tabs

```html
<mlv-tab-group orientation="vertical" [(activeTab)]="selectedTab">
  <!-- ... mlv-tab children ... -->
</mlv-tab-group>
```

### Boxed appearance (Phase A)

`appearance` is orthogonal to `orientation` — combine freely:

```html
<mlv-tab-group appearance="boxed" [(activeTab)]="selectedTab">
  <!-- ... mlv-tab children ... -->
</mlv-tab-group>

<!-- boxed + vertical -->
<mlv-tab-group appearance="boxed" orientation="vertical" [(activeTab)]="selectedTab">
  <!-- ... -->
</mlv-tab-group>
```

### Content density

```html
<mlv-tab-group mlvDensity="compact" [(activeTab)]="selectedTab">
  <!-- ... -->
</mlv-tab-group>
```

### Routable tabs (Phase A2)

Put Angular's native `[routerLink]` on `<mlv-tab>`; the active tab is derived from the URL. Import `RouterLink` in the consuming component. `linkActiveOptions` mirrors `RouterLinkActive.routerLinkActiveOptions`:

```html
<mlv-tab-group appearance="boxed">
  <mlv-tab value="examples" routerLink="/button" [linkActiveOptions]="{ exact: true }">
    <ng-template mlvTabDef>Examples</ng-template>
    <ng-template mlvTabContent>…</ng-template>
  </mlv-tab>
  <mlv-tab value="api" routerLink="/button/api">
    <ng-template mlvTabDef>API</ng-template>
    <ng-template mlvTabContent>…</ng-template>
  </mlv-tab>
</mlv-tab-group>
```

Tabs with **no** `routerLink` keep today's click-driven `activeTab` behaviour (this is the default — every existing consumer is unaffected).

### Detecting overflow context in tab label

The `$implicit` variable in `mlvTabDef` is `true` when the tab is rendered inside the overflow popup:

```html
<mlv-tab value="reports">
  <ng-template mlvTabDef let-hidden> @if (hidden) { Rep. } @else { Reports } </ng-template>
  <ng-template mlvTabContent>...</ng-template>
</mlv-tab>
```

### Importing in a standalone component

```ts
import { MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef } from '@malva-ui/core/tabs';

@Component({
  imports: [MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef],
  // ...
})
export class MyComponent {}
```

---

## Dependencies

| Dependency              | Usage                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@angular/core`         | Signals, DI, component lifecycle                                                                                                                                                     |
| `@angular/common`       | `NgTemplateOutlet`                                                                                                                                                                   |
| `@malva-ui/cdk/density` | `MlvDensityDirective` (host directive) + `MLV_DENSITY_ELEMENT` — `mlvDensity` input on `mlv-tab-group`                                                                               |
| `@angular/router`       | (Phase A2) `Router` / `NavigationEnd` (routed-mode active detection + navigation) in `mlv-tab-group`; `RouterLink` optionally self-injected by `mlv-tab` as a URL carrier            |
| `@angular/aria/tabs`    | `Tabs` / `TabList` / `Tab` / `TabPanel` / `TabContent` (`ngTabs`/`ngTabList`/`ngTab`/`ngTabPanel`/`ngTabContent`) — headless roving focus, selection and ARIA wiring for the tablist |
| `@malva-ui/core/popup`  | `MlvPopup`, `MlvPopupContent`, `MlvPopupTrigger` — used for the overflow "More" popup                                                                                                |
| `@malva-ui/core/list`   | `MlvList`, `MlvListItem` — used to render items in the overflow popup                                                                                                                |
