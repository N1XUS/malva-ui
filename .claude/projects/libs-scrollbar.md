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

| Name               | Type                      | Default      | Description                                                                                                                      |
| ------------------ | ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `orientation`      | `MlvScrollbarOrientation` | `'vertical'` | Which axes to show the custom scrollbar on                                                                                       |
| `scrollbarSize`    | `string`                  | `'0.75rem'`  | CSS length for track width/height; maps to `--mlv-sb-size`                                                                       |
| `disabled`         | `BooleanInput`            | `false`      | Hides custom tracks and restores native scrollbar                                                                                |
| `ariaLabel`        | `string \| undefined`     | `undefined`  | Accessible viewport label; falls back to i18n/default text. Written to the DOM only while the viewport is a tab stop — see below |
| `viewportTabIndex` | `number`                  | `0`          | **`0` means auto** (see below); any non-zero value is applied verbatim                                                           |

#### Viewport tab stop (WCAG 2.1.1)

The default `0` is an _auto_ mode, not a literal tabindex: the viewport is a tab
stop only while the scrolled content holds nothing tabbable.

- Text-only region → `tabindex="0"`, so keyboard users can still scroll it.
- Region containing controls → `tabindex="-1"`, so the region does not add a
  redundant stop (and a focus ring around the whole body) in front of them. This
  is what made a service-opened dialog capture focus onto its entire body.

Tabbability is re-read after first render and on every content mutation
(`MutationObserver` over the content wrapper: `childList`, `subtree`, and the
`tabindex`/`disabled`/`hidden`/`href`/`type` attributes), confirmed with the
CDK's `InteractivityChecker` under `{ ignoreVisibility: true }` (the geometric
visibility test never passes before first paint, nor under jsdom). The resolved
value lives in the protected `_effectiveViewportTabIndex` computed.

#### Viewport role and name (WCAG 4.1.2)

The name follows the tab stop — both are driven by `_effectiveViewportTabIndex`:

| Viewport tab stop | `role`  | `aria-label`              |
| ----------------- | ------- | ------------------------- |
| yes (`>= 0`)      | `group` | resolved `ariaLabel`/i18n |
| no (`-1`)         | absent  | absent                    |

- `aria-label` is **prohibited** on an element with no role (implicit
  `generic`), so a bare labelled `<div>` had its name discarded by AT and
  tripped axe `aria-prohibited-attr`. The label is now only emitted alongside a
  role that permits it.
- `group`, not the landmark `region`: wrapping content in `mlv-scrollbar` must
  never inject a landmark — nor repeat one generic "Scrollable region" landmark
  name — into the host page's landmark navigation.
- A viewport that is not a tab stop is not a control the user can land on, so
  it stays a plain container and the projected content owns its own semantics.

Resolved by the protected `_isViewportFocusable`, `_viewportRole` and
`_viewportAriaLabel` computeds.

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
<div class="mlv-scrollbar__viewport" #viewport [attr.tabindex]="_effectiveViewportTabIndex()" [attr.role]="_viewportRole()" [attr.aria-label]="_viewportAriaLabel()" (scroll)="_onScroll()">
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

#### ResizeObserver

A native `ResizeObserver` watches both the viewport element (host resize) and the content wrapper (content size changes). When either resizes, overflow state and thumb geometry are recalculated. In SSR/test environments without `ResizeObserver`, initial rendering and native scrolling remain available while geometry observation is skipped. The i18n token is optional, with `"Scrollable region"` as the accessible-label fallback.

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
```

---

## Dependencies

| Dependency              | Version   | Notes                                                             |
| ----------------------- | --------- | ----------------------------------------------------------------- |
| `@angular/core`         | `^22.0.0` | Signals, DI, `afterNextRender`, `viewChild`                       |
| `@angular/cdk/coercion` | `^22.0.0` | `BooleanInput`, `coerceBooleanProperty`                           |
| `@angular/cdk/a11y`     | `^22.0.0` | `InteractivityChecker` — confirms projected content is a tab stop |
