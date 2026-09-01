---
# Library: scrollbar

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The `scrollbar` library (`@malva-ui/core/scrollbar`) provides a minimalistic custom scrollbar component (`mlv-scrollbar`) that hides the native browser scrollbar and renders a themed overlay track and thumb. Native scroll behaviour is never intercepted — the viewport scrolls exactly as if the component were not present.

The host element must have a defined height (set via a CSS class, inline style, or flex/grid sizing from a parent container).

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

| Name               | Type                      | Default      | Description                                                                                                                     |
| ------------------ | ------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `orientation`      | `MlvScrollbarOrientation` | `'vertical'` | Which axes to show the custom scrollbar on                                                                                      |
| `scrollbarSize`    | `string`                  | `'0.75rem'`  | CSS length for track width/height; maps to `--mlv-sb-size`                                                                      |
| `disabled`         | `BooleanInput`            | `false`      | Hides custom tracks and restores native scrollbar                                                                               |
| `ariaLabel`        | `string \| undefined`     | `undefined`  | Accessible viewport label; falls back to i18n/default text. Written to the DOM only while `viewportTabIndex` is `0` — see below |
| `viewportTabIndex` | `-1 \| 0 \| null`         | `null`       | Written **verbatim** to the viewport's `tabindex`. `null` emits no attribute at all — see below                                 |

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

Resolved by the protected `_isViewportFocusable` (`viewportTabIndex() === 0`),
`_viewportRole` and `_viewportAriaLabel` computeds.

#### Public properties

| Property          | Type          | Description                                                                                                        |
| ----------------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `viewportElement` | `HTMLElement` | The native scrollable viewport. Lets wrapping components (e.g. `main[mlvPage]`) attach their own scroll observers. |

#### Host Bindings

```ts
host: {
  'class': 'mlv-scrollbar',
  '[class.mlv-scrollbar--disabled]': 'disabled()',
  '[class.mlv-scrollbar--dragging]': '_isDragging()',
  '[class.mlv-scrollbar--scrolling]': '_isScrolling()',
  '[style.--mlv-sb-size]': 'scrollbarSize()',
}
```

#### Template Structure

```html
<div class="mlv-scrollbar__viewport" #viewport [attr.tabindex]="viewportTabIndex()" [attr.role]="_viewportRole()" [attr.aria-label]="_viewportAriaLabel()">
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

| Class                               | Role                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `.mlv-scrollbar`                    | Host — relative grid sizing context for the viewport and overlay tracks    |
| `.mlv-scrollbar__viewport`          | Scrollable inner container — `overflow: auto; scrollbar-width: none`       |
| `.mlv-scrollbar__content`           | Content wrapper observed by `ResizeObserver`                               |
| `.mlv-scrollbar__track`             | Base track styles                                                          |
| `.mlv-scrollbar__track--vertical`   | Right-edge vertical track                                                  |
| `.mlv-scrollbar__track--horizontal` | Bottom-edge horizontal track                                               |
| `.mlv-scrollbar__track--hidden`     | Applied when no overflow on that axis                                      |
| `.mlv-scrollbar__thumb`             | The scroll position indicator; `top`/`height` or `left`/`width` set inline |

#### Modifiers

| Modifier                   | Applied when                                            |
| -------------------------- | ------------------------------------------------------- |
| `mlv-scrollbar--disabled`  | `disabled()` is `true`                                  |
| `mlv-scrollbar--dragging`  | User is actively dragging a thumb                       |
| `mlv-scrollbar--scrolling` | Scroll events are in-flight (cleared after 150 ms idle) |

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

#### Scroll listener (registered imperatively, not in the template)

The viewport's scroll handler is bound with `addEventListener('scroll', …,
{ passive: true })` from `afterNextRender`, inside `runOutsideAngular`, and torn
down from `DestroyRef.onDestroy`. There is **no `(scroll)` binding** in
`scrollbar.html`, and `_onScroll` is `private`.

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

#### ResizeObserver

A native `ResizeObserver` watches both the viewport element (host resize) and the content wrapper (content size changes). When either resizes, overflow state and thumb geometry are recalculated. In SSR/test environments without `ResizeObserver`, initial rendering and native scrolling remain available while geometry observation is skipped. The i18n token is optional, with `"Scrollable region"` as the accessible-label fallback.

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
| An overflow flip, cross-axis                             | The corner-avoidance rule shortens each track by one `--mlv-sb-size` while the _other_ track is visible.                                                                                            |
| A `scrollbarSize` change (an `effect`)                   | Same corner rule; the tracks themselves are not observed, and neither the viewport nor the content resizes when this input moves.                                                                   |
| An `orientation` / `disabled` change (the same `effect`) | `--hidden` is bound to `!_showX() \|\| !_hasXOverflow()`, so these turn the same corner rule on and off with **no** overflow signal moving and no resize — the cross-axis flip check cannot see it. |

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
```

---

## Dependencies

| Dependency              | Version   | Notes                                       |
| ----------------------- | --------- | ------------------------------------------- |
| `@angular/core`         | `^22.0.0` | Signals, DI, `afterNextRender`, `viewChild` |
| `@angular/cdk/coercion` | `^22.0.0` | `BooleanInput`, `coerceBooleanProperty`     |
