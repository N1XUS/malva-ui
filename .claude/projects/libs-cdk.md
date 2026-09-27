---
# Library: cdk

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

`@malva-ui/cdk` is the published infrastructure family package for the Malva UI design system. It provides low-level, reusable building blocks that other libraries depend on and now acts as the grouped public entry for several foundational subpackages. The root package currently contains:

- **ResizeObserver utilities** — a service and directive for observing element size changes using the native `ResizeObserver` browser API.
- **MlvFade** — a scroll-aware component that applies CSS mask-based fade effects to indicate overflowed content in horizontal or vertical directions.
- **MlvRtlService** — signal-based document direction state synchronized with CDK `Directionality`, plus RTL-aware arrow-key normalization.

Secondary public imports are also available:

- `@malva-ui/cdk/accessibility`
- `@malva-ui/cdk/data-source` — shared `MlvDataSource`/`MlvArrayDataSource` primitives for the data table and the option controls (see `libs-cdk-data-source.md`)
- `@malva-ui/cdk/density`
- `@malva-ui/cdk/floating-container` — sticky floating-footer container with a gradient-masked backdrop (see `libs-floating-container.md`)
- `@malva-ui/cdk/shrink-wrap` — pure-CSS box-shrink-to-content primitive (see `libs-shrink-wrap.md`)
- `@malva-ui/cdk/utils`

This library has no UI opinions of its own; it provides infrastructure primitives consumed by other `@malva-ui/*` libraries.

---

## Public API

Exported from `libs/cdk/src/index.ts`:

| Export                                                                                                                                                             | Kind                                | Description                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `MlvResizeObserver`                                                                                                                                                | Directive                           | Attaches a `ResizeObserver` to the host element and exposes resize events as an output.                                                                                                                                                                                        |
| `MlvResizeObserverService`                                                                                                                                         | Service                             | Singleton service that manages shared `ResizeObserver` instances.                                                                                                                                                                                                              |
| `MlvResizeObserverFactory`                                                                                                                                         | Service                             | Factory service that creates `ResizeObserver` instances (allows easy overriding in tests).                                                                                                                                                                                     |
| `MlvFade`                                                                                                                                                          | Component                           | Attribute component that adds CSS mask fade effects to a scrollable container.                                                                                                                                                                                                 |
| `MlvOrientation`                                                                                                                                                   | Type alias                          | `'horizontal'                                                                                                                                                                                                                                                                  | 'vertical'`— used by`MlvFade`. |
| `MlvDirection`, `MlvArrowKey`, `MlvRtlService`                                                                                                                     | Type aliases + service              | Re-exported from `@malva-ui/cdk/utils` — direction state, document/CDK `Directionality` synchronization, and RTL-aware arrow-key normalization.                                                                                                                                |
| `MlvClick`                                                                                                                                                         | Directive                           | Re-exported from `@malva-ui/cdk/accessibility` for keyboard-accessible click semantics.                                                                                                                                                                                        |
| `MlvTabbableElementService`                                                                                                                                        | Service                             | Re-exported from `@malva-ui/cdk/accessibility` for locating focusable descendants.                                                                                                                                                                                             |
| `MlvDensityDirective` / `MlvDensityRootDirective` / `MlvDensityService`                                                                                            | Directives + service                | Re-exported from `@malva-ui/cdk/density` to expose density infrastructure from the grouped family root.                                                                                                                                                                        |
| `MlvOverlayHostBase`, `MlvOverlayServiceBase`, `MlvOverlayRef`, `MlvBaseOverlayConfig`, `MlvOverlayAnimationState`                                                 | Abstract classes + interface + type | Re-exported from `@malva-ui/cdk/overlay` — shared modal-overlay abstractions extended by `@malva-ui/core/dialog` and `@malva-ui/core/drawer`. See [libs-overlay.md](libs-overlay.md).                                                                                          |
| `MlvDataSource`, `MlvArrayDataSource`, `MlvDataSourceState`, `MlvSortDirection`, `MlvSortState`, `MlvDataSourceFilterOperator`, `MlvFilterState`, `MlvSearchState` | Abstract class + class + types      | Re-exported from `@malva-ui/cdk/data-source` — the signal-based data-source contract shared by `@malva-ui/core/data-table` and the option controls. See [libs-cdk-data-source.md](libs-cdk-data-source.md).                                                                    |
| `MlvShrinkWrap`, `MlvShrinkWrapContent`                                                                                                                            | Directive + Component               | Re-exported from `@malva-ui/cdk/shrink-wrap` — pure-CSS pair (`[mlvShrinkWrap]` outer box + `mlv-shrink-wrap` inner content) that hugs a box to its widest balanced text line via scroll-driven animations, no JS measurement. See [libs-shrink-wrap.md](libs-shrink-wrap.md). |
| `MlvAutofocus`, `MlvSpacer`, `MlvChromeColor`, `range`, `UI_ANIMATION_DEFAULTS`, `provideUiAnimationDefaults`, `MlvUiAnimationDefaults`                            | Utilities                           | Selected non-conflicting utility re-exports from `@malva-ui/cdk/utils`.                                                                                                                                                                                                        |

---

## Components

### `MlvFade`

**File:** `libs/cdk/utils/src/lib/fade/fade.ts`

**Selector:** `[mlvFade]` (attribute selector — applied to any existing element)

**Purpose:** Wraps a scrollable container and uses CSS `mask-image` to render a fade effect at the start and/or end of the overflow axis. Detects scroll position and element resize to reactively show or hide the fades. Supports both horizontal (default) and vertical orientations. Resize and scroll observation starts only in a browser, so server rendering creates no DOM observer subscriptions.

#### Inputs

| Input           | Type                   | Default        | Description                                                                                                                                                                                                                                             |
| --------------- | ---------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mlvFade`       | `MlvOrientation \| ''` | `'horizontal'` | Overflow axis. `'horizontal'` fades the inline-start / inline-end edges and mirrors under any `[dir="rtl"]` ancestor; `'vertical'` fades top / bottom. The bare attribute binds `''`, which behaves as `'horizontal'`. A change re-measures on its own. |
| `mlvFadeHeight` | `string \| null`       | `null`         | Explicit line-height value applied to both the `line-height` CSS property and the `--mlv-line-height` CSS custom property. Controls the height of the fade mask in horizontal mode.                                                                     |
| `mlvFadeSize`   | `string`               | `'1.5em'`      | Size of the fade gradient. Mapped to `--mlv-fade-size`.                                                                                                                                                                                                 |
| `mlvFadeOffset` | `string`               | `'0em'`        | Offset of the fade gradient from the edge. Mapped to `--mlv-fade-offset`.                                                                                                                                                                               |

#### Outputs

None. In a browser, the component observes its host through
`MlvResizeObserverService`; during server rendering it does not subscribe.

#### Template

Inline: `<ng-content />` — renders host element content as-is; all visual behavior is achieved through host CSS class bindings and custom properties.

#### Host Bindings

| Binding                     | Value                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `class`                     | `mlv-fade` (always)                                                                            |
| `[class.mlv-fade--end]`     | `_isEnd()` signal — truthy when content overflows toward the end                               |
| `[class.mlv-fade--start]`   | `_isStart()` signal — truthy when scrolled away from the start                                 |
| `[attr.data-orientation]`   | Value of `mlvFade()` input — drives CSS selector targeting                                     |
| `[style.line-height]`       | `mlvFadeHeight()`                                                                              |
| `[style.--mlv-line-height]` | `mlvFadeHeight()`                                                                              |
| `[style.--mlv-fade-size]`   | `mlvFadeSize()`                                                                                |
| `[style.--mlv-fade-offset]` | `mlvFadeOffset()`                                                                              |
| `[style.transition]`        | `'none'` until the first measurement of a laid-out box has painted (`_settling()`), else unset |

#### Resize lifecycle

- `MlvResizeObserverService` observes the host element only when
  `isPlatformBrowser()` is true.
- Scroll and resize events retain the existing animation-frame coalescing and
  are torn down with the component.
- A change of `mlvFade` schedules one measurement (an `effect`), so switching
  axis updates the classes without a scroll or resize.
- `--start` reads `Math.abs(scrollLeft)`: RTL `scrollLeft` runs `0 → negative`,
  and a subpixel offset at the start floors to 0 in both directions.
- **Mount does not slide** (#341). The mask starts in its rest position and the
  first measurement usually moves it to an overflow edge, which is not a scroll.
  The host carries an inline `transition: none` until that measurement is
  painted; when it changed a class, an `afterNextRender` `earlyRead` flushes
  style before the `write` removes it, so both changes never share one style
  recalc. A zero-size box (not laid out, `display: none`) does not settle — its
  first real measurement still jumps. Chromium resets `scrollLeft` to 0 and fires
  `scroll` when an ancestor's `dir` flips on a scrolled box (probed), so the
  classes stay right without a direction dependency.

#### CSS / Styling

**File:** `libs/cdk/utils/src/lib/fade/fade.scss`

- Block class: `mlv-fade`
- `ViewEncapsulation.None` — styles are global.
- The element is styled with `overflow: auto`, `scrollbar-width: none`, and `flex-shrink: 1`.
- Uses CSS `mask-image` with three gradients (start fade, end fade, content fill) positioned via `mask-position`. CSS transitions animate the mask position.
- `data-orientation` attribute controls whether horizontal or vertical overflow mode is active.
- Modifier classes `mlv-fade--start` and `mlv-fade--end` shift the relevant mask gradient to the edge, revealing or hiding the fade.
- **Horizontal mode mirrors in RTL** (#341): `mask-position` and gradient direction have no logical keywords, so both edge layers are placed by the sign `d` = `--mlv-inline-direction` — inline-start image at `calc(50% - 50% * d)`, inline-end image at `calc(50% + 50% * d)`, a hidden layer a further `size + offset - 1px` outside its edge — and the gradients use `mixins.inline-distance(±90deg)`. Follows a scoped `[dir]` at any depth; LTR values are unchanged (`fade-styles.spec.ts` evaluates both). Vertical mode is block-axis and untouched.
- `dir="auto"` is transparent to `--mlv-inline-direction` (`.claude/rules/rtl.md`), so under a `dir="auto"` that resolves to RTL the fade still points LTR and masks the reader's first letters.
- **Known cosmetic:** `_settling` covers mount only. A direction flip on a mounted, scrolled fade changes `--mlv-inline-direction`, and the mask position animates across the box once over `--mlv-duration-slow` (e.g. toggling Direction in the docs preferences with an avatar label or the editor toolbar scrolled). Accepted; re-arming `_settling` on an `elementDirection(host)` change would remove it.
- Relies on CSS custom properties: `--mlv-fade-size`, `--mlv-fade-offset`, `--mlv-line-height`, `--mlv-inline-direction`, `--mlv-duration-slow`, `--mlv-ease-out`.

---

## Directives

### `MlvResizeObserver`

**File:** `libs/cdk/src/lib/observers/resize-observer.ts`

**Selector:** `[mlvResizeObserver]`

**Export as:** `mlvResizeObserver`

**Purpose:** Attaches to a host element and exposes an Angular output that emits `ResizeObserverEntry[]` whenever the element is resized. Can also be consumed programmatically via the `resizeEvents$` observable property.

#### Inputs

None.

#### Outputs

| Output    | Type                               | Description                                                                                                                   |
| --------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `resized` | `OutputRef<ResizeObserverEntry[]>` | Emits an array of `ResizeObserverEntry` objects whenever the host element's size changes. Created via `outputFromObservable`. |

#### Public Properties

| Property        | Type                                | Description                                                                                                                                   |
| --------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `elementRef`    | `ElementRef<HTMLElement>`           | Reference to the host element.                                                                                                                |
| `resizeEvents$` | `Observable<ResizeObserverEntry[]>` | Observable that emits on every resize. Use this for programmatic subscriptions inside other directives/components that inject this directive. |

#### Host Bindings

None.

---

## Services

### `MlvResizeObserverService`

**File:** `libs/cdk/src/lib/observers/resize-observer.service.ts`

**Provided in:** `root`

**Purpose:** Manages a shared pool of `ResizeObserver` instances. Multiple callers can observe the same element without creating redundant observers — the service uses a reference count per element and tears down the observer once the last subscriber unsubscribes.

#### Public Methods

| Signature                                                                                  | Description                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `observe(elementOrRef: Element \| ElementRef<Element>): Observable<ResizeObserverEntry[]>` | Returns a cold Observable that emits `ResizeObserverEntry[]` on every resize of the given element. Cleans up the underlying `ResizeObserver` automatically on unsubscription. |

---

### `MlvResizeObserverFactory`

**File:** `libs/cdk/src/lib/observers/resize-observer.service.ts`

**Provided in:** `root`

**Purpose:** Creates native `ResizeObserver` instances. Returns `null` if `ResizeObserver` is not available in the current environment (e.g. server-side rendering or old browsers). Can be overridden in tests to provide a mock implementation.

#### Public Methods

| Signature                                                          | Description                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `create(callback: ResizeObserverCallback): ResizeObserver \| null` | Creates and returns a new `ResizeObserver`, or `null` if unsupported. |

---

## Usage Examples

### MlvResizeObserver — template binding

```html
<div mlvResizeObserver (resized)="onResize($event)">Resize me</div>
```

```typescript
onResize(entries: ResizeObserverEntry[]): void {
  console.log(entries[0].contentRect.width);
}
```

### MlvResizeObserverService — programmatic subscription

```typescript
import { inject, ElementRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MlvResizeObserverService } from '@malva-ui/cdk';

class MyComponent {
  private resizeService = inject(MlvResizeObserverService);
  private el = inject(ElementRef);

  constructor() {
    this.resizeService
      .observe(this.el)
      .pipe(takeUntilDestroyed())
      .subscribe((entries) => {
        console.log(entries[0].contentRect);
      });
  }
}
```

### MlvFade

```html
<!-- Horizontal fade (default) -->
<div mlvFade mlvFadeSize="2em" style="width: 200px; white-space: nowrap;">Very long content that will overflow...</div>

<!-- Vertical fade -->
<div [mlvFade]="'vertical'" style="height: 200px;">
  <p>Line 1</p>
  <p>Line 2</p>
  <!-- ... many lines ... -->
</div>
```

```typescript
import { MlvFade } from '@malva-ui/cdk';

@Component({
  imports: [MlvFade],
  // ...
})
```

---

## Build Notes

- `libs/cdk/tsconfig.lib.json` intentionally excludes secondary-entry e2e/testing-e2e files and Playwright configs so production typecheck/build targets do not pull Node-only testing helpers into the browser/library compilation.
- Production builds use Angular partial compilation so the package is safe to
  distribute to applications.
- The source package manifest uses release placeholders for its own version and
  root-managed peer versions. Nx Release versions only the workspace root;
  `scripts/publish.mjs` resolves the built manifest from that root before npm
  publication.

---

## Dependencies

### Angular

- `@angular/core`
- `@angular/cdk/coercion` — `coerceElement` used in `MlvResizeObserverService`

### Internal (`@malva-ui/*`)

- `@malva-ui/cdk/accessibility` — surfaced via subpath and selected root re-exports
- `@malva-ui/cdk/density` — surfaced via subpath and selected root re-exports
- `@malva-ui/cdk/floating-container` — surfaced via subpath and root re-exports (sticky floating-footer container)
- `@malva-ui/cdk/overlay` — surfaced via subpath and root re-exports (shared modal-overlay abstractions)
- `@malva-ui/cdk/shrink-wrap` — surfaced via subpath and root re-exports (pure-CSS box-shrink-to-content primitive)
- `@malva-ui/cdk/utils` — surfaced via subpath and selected root re-exports

### Third-party

- `rxjs` — `Observable`, `Subject`, `Observer`, `merge`, `fromEvent`, `startWith`, `filter`
