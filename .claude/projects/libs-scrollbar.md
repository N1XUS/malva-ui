---
# Library: scrollbar

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The `scrollbar` library (`@malva-ui/core/scrollbar`) provides a minimalistic custom scrollbar component (`mlv-scrollbar`) that hides the native browser scrollbar and renders a themed overlay track and thumb. Native scroll behaviour is never intercepted — the viewport scrolls exactly as if the component were not present.

The host element must have a defined height (set via a CSS class, inline style, or flex/grid sizing from a parent container).

Two modes:

- **Wrapping** (default) — the component's own viewport is the scroll box and
  the projected content scrolls inside it.
- **Decorating** (`[scroller]`) — an external element stays the scroll box and
  the component renders nothing but the tracks over it. For controls that can
  never delegate scrolling to an ancestor; `mlv-textarea` is the in-repo
  consumer. See [External scroller](#external-scroller-scroller).

---

## Public API

Exported from `libs/core/scrollbar/src/index.ts`:

| Export                    | Kind      | Description                                    |
| ------------------------- | --------- | ---------------------------------------------- |
| `MlvScrollbar`            | Component | `mlv-scrollbar` — the custom scrollbar wrapper |
| `MlvScrollbarOrientation` | Type      | `'vertical' \| 'horizontal' \| 'both'`         |

---

## Components

### `MlvScrollbar`

**File:** `libs/core/scrollbar/src/lib/scrollbar/scrollbar.ts`
**Template:** `libs/core/scrollbar/src/lib/scrollbar/scrollbar.html`
**Styles:** `libs/core/scrollbar/src/lib/scrollbar/scrollbar.scss`

- **Selector:** `mlv-scrollbar`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`

#### Inputs

| Name               | Type                                             | Default      | Description                                                                                                                     |
| ------------------ | ------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `orientation`      | `MlvScrollbarOrientation`                        | `'vertical'` | Which axes to show the custom scrollbar on                                                                                      |
| `scrollbarSize`    | `string`                                         | `'0.75rem'`  | CSS length for track width/height; maps to `--mlv-sb-size`                                                                      |
| `disabled`         | `BooleanInput`                                   | `false`      | Hides custom tracks and restores native scrollbar                                                                               |
| `scroller`         | `HTMLElement \| ElementRef<HTMLElement> \| null` | `null`       | External element to decorate instead of wrapping — see [External scroller](#external-scroller-scroller)                         |
| `ariaLabel`        | `string \| undefined`                            | `undefined`  | Accessible viewport label; falls back to i18n/default text. Written to the DOM only while `viewportTabIndex` is `0` — see below |
| `viewportTabIndex` | `-1 \| 0 \| null`                                | `null`       | Written **verbatim** to the viewport's `tabindex`. `null` emits no attribute at all — see below                                 |

#### Viewport tab stop (WCAG 2.1.1)

`viewportTabIndex` is a **pure passthrough**. The component inspects nothing and
decides nothing — no auto mode, no content scan, no overflow check.

| Value            | `tabindex` attribute | Meaning                                                                                   |
| ---------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `null` (default) | **not emitted**      | No opinion. Keyboard reachability falls to the browser's native scroller focusability.    |
| `0`              | `tabindex="0"`       | Guaranteed tab stop, in every browser. Also emits `role="group"` + the resolved name.     |
| `-1`             | `tabindex="-1"`      | Programmatically focusable, never a tab stop — for widgets that own their keyboard model. |

Positive values are excluded by the type; a positive tabindex is forbidden by
`.claude/rules/accessibility.md`.

**Choosing a value.** With no attribute, Chrome 127+ and Firefox make a scroll
container focusable on their own, but only when it has **no** keyboard-focusable
children. A text-only overflowing region must therefore pass
`[viewportTabIndex]="0"` to be guaranteed keyboard-scrollable everywhere; that
is the only way to satisfy WCAG 2.1.1 without relying on browser behaviour.

Bind it, never write it as a plain attribute: `viewportTabIndex="0"` passes the
**string** `'0'`, which `strictTemplates` rejects against the `-1 | 0 | null`
type.

The previous release shipped an _auto_ mode on this input (default `0`, collapsing
to `-1` whenever the projected content held a tab stop). It was removed — see
[docs/migrations/2026-08-scrollbar-viewport-tabindex.md](../../docs/migrations/2026-08-scrollbar-viewport-tabindex.md).

#### Viewport role and name (WCAG 4.1.2)

The name follows the tab stop — both are keyed on `viewportTabIndex`:

| `viewportTabIndex` | `role`  | `aria-label`              |
| ------------------ | ------- | ------------------------- |
| `0`                | `group` | resolved `ariaLabel`/i18n |
| `-1`               | absent  | absent                    |
| `null` (default)   | absent  | absent                    |

- `aria-label` is **prohibited** on an element with no role (implicit
  `generic`), so a bare labelled `<div>` had its name discarded by AT and
  tripped axe `aria-prohibited-attr`. The label is now only emitted alongside a
  role that permits it.
- `group`, not the landmark `region`: wrapping content in `mlv-scrollbar` must
  never inject a landmark — nor repeat one generic "Scrollable region" landmark
  name — into the host page's landmark navigation.
- A viewport that is not a tab stop is not a control the user can land on, so
  it stays a plain container and the projected content owns its own semantics.
  `-1` and `null` are both "not a tab stop": a `-1` viewport is only ever reached
  under a widget's own keyboard model, which names itself.

Resolved by the protected `_isViewportFocusable`, `_viewportRole` and
`_viewportAriaLabel` computeds. `_isViewportFocusable` reads
`_viewportTabIndex()`, not the raw input — see the external mode below, which
forces all three to nothing.

#### External scroller (`scroller`)

Some controls **cannot** delegate scrolling to an ancestor. A `<textarea>` is
its own `overflow: auto` box sized by `rows`, so it absorbs its overflow
internally: an `mlv-scrollbar` wrapped around one never overflows, both tracks
stay `--hidden` with a 0px box, and if the field also hides its native bar the
content scrolls with **no visible scrollbar at all** (issue #90).

`[scroller]` inverts the relationship. The decorated element stays the scroller;
the component contributes only the overlay tracks, positioned over its host.
(The same shape as Taiga UI's `TuiTextareaContent`, which points
`tui-scroll-controls` at the textarea through a DI token — here it is a plain
signal input, because the target is usually a template reference variable
sitting in the same template.)

```html
<mlv-scrollbar [scroller]="fieldEl" style="max-height: 8rem">
  <textarea #fieldEl rows="3"></textarea>
</mlv-scrollbar>
```

What changes in this mode:

| Concern                             | Behaviour                                                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Metrics, `scroll` listener, drag    | All read/attach to the decorated element. `scroll` does not bubble, so the listener has to sit exactly there.               |
| `ResizeObserver`                    | Observes the decorated element **and** the internal viewport (host resize) **and** the content wrapper **and** both tracks. |
| Internal viewport                   | `mlv-scrollbar--external` makes it `overflow: visible` — it neither scrolls nor clips.                                      |
| `tabindex` / `role` / `aria-label`  | **Never emitted**, whatever `viewportTabIndex` / `ariaLabel` say. The decorated element owns its own semantics.             |
| `viewportElement`                   | Returns the decorated element.                                                                                              |
| Native bar on the decorated element | Not touched. The consumer hides it (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`) if it wants to.      |

The a11y rule is deliberate and not configurable: a second named, tabbable
region wrapped around a control that already names and focuses itself is a
regression, not an addition. `_viewportTabIndex` collapses to `null` in this
mode, and `_viewportRole` / `_viewportAriaLabel` follow it.

`scroller` is **read once**, when the listener and observer are attached from
`afterNextRender`. It must be resolvable by the first render (a template
reference variable is) and is treated as fixed for the component's lifetime —
the same contract the internal `#viewport` has always had. Swapping it at
runtime is not supported and would leave the listener on the previous element.

#### `remeasure()` — the stale-track contract

In the default mode the content wrapper is observed, so any content growth is
reported. In external mode there may be **nothing to observe**: a textarea's
border box does not change when a line of text is added, and the element has no
child to observe. Typing therefore moves `scrollHeight` with no `scroll` event
and no `ResizeObserver` callback, and the track goes stale — wrong thumb size,
or no track at all until the user happens to scroll.

The owner of the content closes that gap by calling `remeasure()` whenever the
content changes. `mlv-textarea` does it from an `afterRenderEffect` on `value`.

`remeasure()` no-ops before the first render, which also makes it SSR-safe:
`afterNextRender` — the only place the flag is set — never runs on the server.

The alternative was Taiga's `.t-ghost`: a transparent mirror of the value
carrying `view-timeline`, whose resize the observer _can_ see. Rejected — it
costs a second copy of the text in the DOM plus duplicated typography that has
to track every density / theme / font change to stay honest, and a
scroll-driven-animation dependency, all to report something the content's owner
already knows for certain.

Cost: one forced layout plus one style recalculation per call, because
`_updateGeometry()` drops the track-metric cache. On a textarea that is one per
keystroke, on an element whose layout the keystroke already invalidated.

#### Public properties

| Property          | Type          | Description                                                                                                                                                                             |
| ----------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `viewportElement` | `HTMLElement` | **The element that actually scrolls** — the decorated `scroller()` when one is set, the component's own viewport otherwise. Lets wrapping components attach their own scroll observers. |

It follows `scroller()` rather than always returning the internal `<div>`
because every caller uses it as _the element that scrolls_ — to attach a
`scroll` listener (`main[mlvPage]`, `mlv-chat`), to read
`scrollTop`/`scrollHeight` or write `scrollTop` (`mlv-chat`), or to resolve the
paging sentinel's scroll owner (`mlv-dropdown-panel`). Returning the inert inner
`<div>` in external mode would reproduce issue #73: a listener on a node that
never receives the event, silently doing nothing. No existing caller sets
`scroller`, so all of them keep the previous element.

#### Public methods

| Method      | Signature  | Description                                                                                                                         |
| ----------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `remeasure` | `(): void` | Recomputes overflow state and thumb geometry from the scroller's current metrics. No-ops before the first render and on the server. |

#### Host Bindings

```ts
host: {
  'class': 'mlv-scrollbar',
  '[class.mlv-scrollbar--disabled]': 'disabled()',
  '[class.mlv-scrollbar--external]': '_hasExternalScroller()',
  '[class.mlv-scrollbar--dragging]': '_isDragging()',
  '[class.mlv-scrollbar--scrolling]': '_isScrolling()',
  '[style.--mlv-sb-size]': 'scrollbarSize()',
}
```

#### Template Structure

```html
<div class="mlv-scrollbar__viewport" #viewport [attr.tabindex]="_viewportTabIndex()" [attr.role]="_viewportRole()" [attr.aria-label]="_viewportAriaLabel()">
  <div class="mlv-scrollbar__content" #content>
    <ng-content />
  </div>
</div>
<div class="mlv-scrollbar__track mlv-scrollbar__track--vertical" #trackV>
  <div class="mlv-scrollbar__thumb" [style.top.px]="_thumbTop()" [style.height.px]="_thumbHeight()" (pointerdown)="_onThumbPointerDown($event, 'vertical')"></div>
</div>
<div class="mlv-scrollbar__track mlv-scrollbar__track--horizontal" #trackH>
  <div class="mlv-scrollbar__thumb" [style.left.px]="_thumbLeft()" [style.width.px]="_thumbWidth()" (pointerdown)="_onThumbPointerDown($event, 'horizontal')"></div>
</div>
```

#### BEM Structure

| Class                               | Role                                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `.mlv-scrollbar`                    | Host — relative grid sizing context for the viewport and overlay tracks                                                     |
| `.mlv-scrollbar__viewport`          | Scrollable inner container — `overflow: auto; scrollbar-width: none`; `overflow: visible` under its own host's `--external` |
| `.mlv-scrollbar__content`           | Content wrapper observed by `ResizeObserver`                                                                                |
| `.mlv-scrollbar__track`             | Base track styles — `opacity: 0` at rest, lifted by the reveal states below                                                 |
| `.mlv-scrollbar__track--vertical`   | Right-edge vertical track                                                                                                   |
| `.mlv-scrollbar__track--horizontal` | Bottom-edge horizontal track                                                                                                |
| `.mlv-scrollbar__track--hidden`     | Applied when no overflow on that axis                                                                                       |
| `.mlv-scrollbar__thumb`             | The scroll position indicator; `top`/`height` or `left`/`width` set inline                                                  |

#### Modifiers

| Modifier                   | Applied when                                            |
| -------------------------- | ------------------------------------------------------- |
| `mlv-scrollbar--disabled`  | `disabled()` is `true`                                  |
| `mlv-scrollbar--external`  | `scroller()` is set — the viewport stops scrolling      |
| `mlv-scrollbar--dragging`  | User is actively dragging a thumb                       |
| `mlv-scrollbar--scrolling` | Scroll events are in-flight (cleared after 150 ms idle) |

#### Track reveal — why the states target the track, not the thumb

`.mlv-scrollbar__track` rests at `opacity: 0`, and the thumb is a **DOM child**
of it, so the two opacities composite. Lifting only the thumb while the track is
transparent paints nothing (`1 x 0`) — which is why `--scrolling` was dead code
until issue #96: scrolling without hovering showed no scrollbar at all.

Three states reveal the track, in one rule declared **after** the base
`opacity: 0` so the track's opacity story reads in one direction:

| State     | Selector                        | Why                                                                                                         |
| --------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Hover     | `.mlv-scrollbar:hover > …`      | Pointer is over the host.                                                                                   |
| Scrolling | `.mlv-scrollbar--scrolling > …` | Any scroll — wheel, touch, keyboard, programmatic `scrollTop` — for 150 ms after the last event.            |
| Dragging  | `.mlv-scrollbar--dragging > …`  | Its own reveal: pointer capture keeps a drag alive after the pointer leaves the host, where `:hover` drops. |

The **child** combinator is load-bearing. Scrollbars nest: `main[mlvPage]` wraps
all page content in one, and that content brings its own (`mlv-chat`, an
external-scroller `mlv-textarea`). With a descendant combinator a state on the
outer host reaches every inner track too, so one PageDown on the page would fade
in three scrollbars of which only one scrolled — and a thumb drag would hold all
of them lit for the whole gesture. Both tracks are template top level, i.e.
direct children of the host, so `>` costs nothing.

Fading back out is the track's own
`transition: opacity var(--mlv-duration-normal) var(--mlv-ease-default)` —
dropping a modifier is the whole mechanism, with no bespoke delay or timer. The
existing `mixins.reduced-motion('mlv-scrollbar')` already collapses that
duration under `prefers-reduced-motion: reduce`.

The reveal paints no rail: `--mlv-sb-track-bg` defaults to `transparent` and
nothing in the repo overrides it, so lifting the track only stops suppressing
the thumb, which keeps its own opacity ramp (0.5 rest / 0.8 hover / 1 while
scrolling or dragging). `--hidden` (`display: none`) still wins on an axis with
no overflow, and `opacity` changes nothing about layout or hit-testing.

#### Every host-state rule is child-scoped (issue #98)

The same reasoning covers every rule in the sheet that a host state aims at one
of its parts. All of them were descendant-combined and all were scoped in issue
#98; a new rule of this shape must be written the same way.

| Rule                                      | Selector                                                                            | What a leak did                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Disabled hides the track                  | `.mlv-scrollbar--disabled > .mlv-scrollbar__track`                                  | `main[mlvPage] scroll="none"` sets `[disabled]` on the page scrollbar, stripping the track off every nested one — and an `mlv-textarea` also suppresses its native bar, so its content scrolled with none.                                                                                 |
| Disabled restores the native bar          | `.mlv-scrollbar--disabled > .mlv-scrollbar__viewport` (+ its `::-webkit-scrollbar`) | Compounded with the row above: a nested scrollbar lost its themed track and got handed an unthemed OS bar in the same breath.                                                                                                                                                              |
| External frees the viewport               | `.mlv-scrollbar--external > .mlv-scrollbar__viewport`                               | Turned a nested viewport into a non-scrolling, non-clipping box whose tracks never left `--hidden`. Latent — `mlv-textarea` is the only `[scroller]` consumer — but `[scroller]` is public API.                                                                                            |
| Thumb ramp (hover / scrolling / dragging) | `… > .mlv-scrollbar__track > .mlv-scrollbar__thumb` — the thumb is a **grandchild** | Painted every nested thumb with the outer scrollbar's state. `:hover` outranks an inner `--scrolling` / `--dragging`, so it _overrode_ the nested scrollbar's own appearance; `--dragging` is the only rule that sets `--mlv-sb-thumb-bg` and `cursor: grabbing`, which nothing wins back. |
| Corner avoidance                          | `:has(> …)` on both probes, `> .mlv-scrollbar__track--…` on both targets            | A `:has()` argument is descendant-relative, so a vertical-only scrollbar answered "both axes are showing" on the tracks of an `orientation="both"` one nested inside it, then shortened every nested track.                                                                                |

The thumb ramp was only cosmetically harmless while the reveal was hover-only:
before issue #96 an inner track could not be lit unless an ancestor was hovered
too, so the outer state painted into `1 x 0`. The reveal above made an inner
track visible from the _inner_ scrollbar's own `--scrolling` / `--dragging`,
with no pointer near it — which is when the outer's paint started landing on
something.

Two rules of this shape live outside this library and were scoped with them,
both in `libs/core/page/src/lib/page/page.scss`:
`.mlv-page__scrollbar > .mlv-scrollbar__viewport` (`overflow-x: hidden`, which
otherwise killed the horizontal axis of every nested scrollbar on a page) and
`.mlv-page--scroll-none .mlv-page__scrollbar > .mlv-scrollbar__viewport`
(`overflow: clip`, which otherwise left the very region `scroll="none"` exists
to empower unable to scroll).

The two thumb _axis_ rules (`.mlv-scrollbar__track--vertical .mlv-scrollbar__thumb`
and its horizontal twin) keep their descendant combinators on purpose: projected
content lands in `__viewport > __content` and never inside a track, so a track
can only ever contain its own thumb.

Regression coverage: `scrollbar-track-visibility.spec.ts` asserts the
**computed** track opacity per state, and — in a nested fixture — that every
host state above leaves the inner scrollbar's part alone while the inner host's
own state still applies. Both directions are asserted for each rule: a spec that
only checked the inner part was untouched would pass if the rule stopped working
altogether. The corner-avoidance rule is asserted the same way but by a
different technique — nwsapi cannot match `:has(… :not(…))` at all, so its spec
evaluates the `:has()` predicate by hand over `element.children` and matches the
declaration half with the `:has()` clauses stripped. A class-only assertion passed for the whole life of issue #96 and is
not sufficient. The page-side rules have their own guard in
`libs/core/page/src/lib/page/page-nested-scrollbar.spec.ts`.

Three jsdom traps that spec works around, worth knowing before editing either
file:

- The cascade resolves by document order and **ignores specificity**, so the
  reveal rule's position after the base rule is load-bearing. It also means
  `getComputedStyle` cannot answer "did this rule reach the element?" for any
  declaration the base rule repeats further down the file — `overflow`,
  `scrollbar-width`, thumb `opacity` and `cursor` all read the base value
  whatever the state rule did. Those specs go through `isTargetedBy()`, which
  asks the selector engine (`element.matches()`) instead and fails loudly when
  the declaration it looks for is no longer in the sheet. The ones that _can_ be
  read from the cascade are: the track's `display` under `--disabled`, and the
  thumb's `--mlv-sb-thumb-bg` under `--dragging` (jsdom does not inherit custom
  properties, so a value there means a rule set it on that element).
- nwsapi mis-resolves `:scope` on a nested host
  (`querySelector(':scope > .mlv-scrollbar__track--vertical')` on the outer host
  returns the _inner_ track), so the nested specs walk `element.children`
  instead. Selector _matching_ handles the child combinator correctly.
- nwsapi cannot match `:has(… :not(…))` at all — `element.matches()` answers a
  silent `false` — and jsdom's CSSOM re-serialises it with the outer `:has(`
  dropped, after which every `getComputedStyle` call throws. `attachStylesheet()`
  therefore deletes those rules, and the corner rule's scoping is guarded by
  asserting the **compiled selector text** instead of the DOM.

jsdom also never enters `:hover`, so `matches()` answers `false` for every
`:hover` selector. `isTargetedBy()` swaps the pseudo-class for a marker class
put on the host the pointer would be over, leaving the combinator under test
untouched — otherwise the hover leak spec would pass whatever the selector said.

#### CSS Custom Properties

| Variable                  | Default                    | Description                                  |
| ------------------------- | -------------------------- | -------------------------------------------- |
| `--mlv-sb-size`           | `0.75rem`                  | Track width/height                           |
| `--mlv-sb-inset`          | `0.25rem`                  | Cross-axis padding inside track around thumb |
| `--mlv-sb-edge-padding`   | `0.1875rem`                | Padding from track start/end edges           |
| `--mlv-sb-thumb-bg`       | `var(--mlv-border-strong)` | Thumb background color                       |
| `--mlv-sb-thumb-opacity`  | `0.5`                      | Thumb opacity at rest                        |
| `--mlv-sb-track-bg`       | `transparent`              | Track background                             |
| `--mlv-sb-radius`         | `var(--mlv-radius-full)`   | Thumb and track border-radius                |
| `--mlv-sb-min-thumb-size` | `1.75rem`                  | Minimum thumb length                         |

#### Drag Scroll

Thumb drag is supported. On `pointerdown`, the thumb captures the pointer via `setPointerCapture`, then translates `pointermove` deltas into viewport `scrollTop`/`scrollLeft` updates. Released on `pointerup` or `pointercancel`.

#### Scroll listener (an `rxjs` stream, not a template binding)

The scroll handler is bound as
`fromEvent(scrollerEl, 'scroll', { passive: true })` from `afterNextRender`,
inside `runOutsideAngular`, and torn down with
`takeUntilDestroyed(this._destroyRef)` — the `DestroyRef` is passed explicitly
because an `afterNextRender` callback is not an injection context. There is
**no `(scroll)` binding** in `scrollbar.html`, and `_onScroll` is `private`.

A template listener is wrapped by Angular in
`wrapListenerIn_markDirtyAndPreventDefault`, which marks the whole ancestor view
chain dirty and notifies the change-detection scheduler _before_ it can know
whether the handler changed anything — one full change-detection pass per scroll
event, at input frequency, for a handler whose signals usually land back on the
values they already held. Under zoneless change detection (the docs app, and any
consumer on `provideZonelessChangeDetection()`) that scheduler notification is
the entire cost, which is why `runOutsideAngular` alone would not have fixed it;
the wrapper had to go. `runOutsideAngular` is kept because this is a published
library and consumers may still run zone-based change detection, where the zone
would schedule its own tick on top.

Measured in `scrollbar-scroll-listener.spec.ts`: 20 scroll events over an
unchanged layout cost **0** change-detection passes; the template binding cost
**20**. `MlvScrollbar` still exposes **no `scroll` output** — wrapping components
attach their own listener to the public `viewportElement`, as `main[mlvPage]`
and `mlv-chat` do.

`scroll` does **not** bubble, so the listener must sit on the element that
scrolls — the decorated `scroller()` in external mode, never the host and never
the inert internal viewport. `scrollbar-external-scroller.spec.ts` asserts the
registration target and dispatches at all three nodes, because `dispatchEvent`
runs a node's own listeners regardless of bubbling and a test aimed at the wrong
node passes vacuously (that is what hid issue #73).

#### ResizeObserver

A native `ResizeObserver` watches the scroller (its own resize), the viewport element (host resize — the same element in the default mode, a separate one under `[scroller]`), the content wrapper (content size changes) and **both track elements** (their own box, which moves when `--mlv-sb-edge-padding` / `--mlv-sb-edge-gap` or the root font size re-resolve — see [Track-only notifications](#track-only-notifications-69)). When any of the first three resizes, overflow state and thumb geometry are recalculated; a batch of track entries alone takes the narrower path described there. Content that grows **without** resizing any of them — text inside a decorated `<textarea>` — is not covered; see [`remeasure()`](#remeasure--the-stale-track-contract). In SSR/test environments without `ResizeObserver`, initial rendering and native scrolling remain available while geometry observation is skipped. The i18n token is optional, with `"Scrollable region"` as the accessible-label fallback.

#### Track-metric cache (scroll fast path)

`_updateThumbPositions()` runs on every scroll event. It reads **only** the
viewport's own scroll state (`scrollTop`/`scrollLeft`,
`clientHeight`/`clientWidth`, `scrollHeight`/`scrollWidth`). Each track's
padding (`--mlv-sb-edge-padding`) and usable extent are cached per axis by the
private `_trackMetrics(axis)`, because reading them costs a style recalculation
(`getComputedStyle`) plus a forced layout (`offsetHeight`/`offsetWidth`) and
neither can change as a result of scrolling. `_onThumbPointerDown` shares the
same cache.

The cache is dropped when — and only when — the tracks can have been laid out
differently:

| Trigger                                                  | Why                                                                                                                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_updateGeometry()` (ResizeObserver)                     | The host or content resized, so a track may have resized with it.                                                                                                                                   |
| A **track-only** ResizeObserver batch (#69)              | A track's own box moved while the viewport and the content wrapper stood still — see below.                                                                                                         |
| An overflow flip, cross-axis                             | The corner-avoidance rule shortens each track by one `--mlv-sb-size` while the _other_ track is visible.                                                                                            |
| A `scrollbarSize` change (an `effect`)                   | Same corner rule. Kept as an `effect` even now that the tracks are observed, because an input change is known before layout — cheaper than waiting for the observer to report the resulting resize. |
| An `orientation` / `disabled` change (the same `effect`) | `--hidden` is bound to `!_showX() \|\| !_hasXOverflow()`, so these turn the same corner rule on and off with **no** overflow signal moving and no resize — the cross-axis flip check cannot see it. |

##### Track-only notifications (#69)

`--mlv-sb-edge-padding` and `--mlv-sb-edge-gap` are consumer-facing custom
properties, and a theme swap or an ancestor class toggle re-resolves either
without changing the size of the viewport or the content wrapper. Before #69
those were the only boxes observed, so nothing invalidated the cache and the
thumb stayed laid out against the old padding until the next genuine resize.
The same held for a **root font-size or text-only zoom** change, since both
values — and the default `0.1875rem` padding — are rem.

Both tracks are now observed as well. The default observed box is the
**content** box, which is what makes this work: padding sits inside the track's
border box, so a border-box observation would miss an edge-padding change
entirely. An edge-gap change moves the track's own insets and a rem
re-resolution moves both, so the one observation covers all three.

A batch carrying **nothing but track entries** is serviced by
`_invalidateTrackMetrics()` + `_updateThumbPositions()` rather than by
`_updateGeometry()`. That split is what makes observing the tracks safe:
`_updateGeometry()` writes the visibility classes that size these very tracks,
so servicing a track notification with it would feed the observer back into
itself — the `ResizeObserver loop completed with undelivered notifications`
risk that kept the tracks unobserved. `_updateThumbPositions()` writes only the
thumb signals, and the thumbs are not observed, so this branch cannot resize
anything it is watching. The overflow decision is derived purely from the
viewport's scroll metrics, so a track resize cannot have moved it.

An empty batch is deliberately **not** treated as tracks-only: `every` is
vacuously true on an empty array, and the specs' `resize()` helper delivers no
entries precisely in order to exercise the full pass.

A measurement is only cached when the track was genuinely laid out
(`extent > 0`, finite padding). A track with no overflow carries
`.mlv-scrollbar__track--hidden` (`display: none`, so extent `0`), and
`_updateGeometry()` measures **synchronously**, before Angular re-renders the
class binding it has just invalidated — so on the frame where overflow first
appears the track is still hidden and still measures `0`. That measurement is
used for the current frame (keeping the maths identical to the uncached
implementation) but deliberately not cached; the next read re-measures the
now-visible track. Caching it would pin the thumb to a zero-length track for
the lifetime of the component.

---

## Usage Examples

```html
<!-- Vertical (default) -->
<mlv-scrollbar style="height: 12rem">
  <p>Long content…</p>
</mlv-scrollbar>

<!-- Horizontal -->
<mlv-scrollbar orientation="horizontal" style="width: 20rem">
  <div style="width: 60rem">Wide content…</div>
</mlv-scrollbar>

<!-- Both axes -->
<mlv-scrollbar orientation="both" style="height: 12rem; width: 20rem">
  <div style="height: 30rem; width: 60rem">…</div>
</mlv-scrollbar>

<!-- Disabled -->
<mlv-scrollbar [disabled]="true" style="height: 8rem">
  <!-- native scrollbar shown -->
</mlv-scrollbar>

<!-- Custom size -->
<mlv-scrollbar scrollbarSize="0.5rem" style="height: 10rem"> … </mlv-scrollbar>

<!-- Guaranteed keyboard-scrollable text region: opt in to the tab stop.
     This also emits role="group" + the resolved aria-label. -->
<mlv-scrollbar [viewportTabIndex]="0" ariaLabel="Release notes" style="height: 12rem">
  <p>Long prose with nothing focusable inside…</p>
</mlv-scrollbar>

<!-- Composite widget that owns its own keyboard model: never a tab stop. -->
<mlv-scrollbar [viewportTabIndex]="-1" style="height: 12rem">
  <mlv-list selectable>…</mlv-list>
</mlv-scrollbar>

<!-- Decorate a control that must stay its own scroller. No tabindex / role /
     aria-label is emitted on the viewport in this mode. -->
<mlv-scrollbar [scroller]="fieldEl" style="max-height: 8rem">
  <textarea #fieldEl rows="3"></textarea>
</mlv-scrollbar>
```

```ts
// Content that grows without resizing anything observable must say so.
readonly scrollbar = viewChild.required(MlvScrollbar);

afterRenderEffect(() => {
  this.value();
  this.scrollbar().remeasure();
});
```

---

## Dependencies

| Dependency              | Version   | Notes                                       |
| ----------------------- | --------- | ------------------------------------------- |
| `@angular/core`         | `^22.0.0` | Signals, DI, `afterNextRender`, `viewChild` |
| `@angular/cdk/coercion` | `^22.0.0` | `BooleanInput`, `coerceBooleanProperty`     |
