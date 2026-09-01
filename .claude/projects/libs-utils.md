---
# Library: utils

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Utils library (`@malva-ui/cdk/utils`) provides common Angular utilities: autofocus, a flex spacer component, resize observer service/directive, animation token defaults, breakpoint helpers, and pure helper functions (`range`, `clamp`, `mlvNextId`, `normalizeForMatch`).

## Public API

Exported from `libs/cdk/utils/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvAutofocus` | Directive | Auto-focus tabbable element — `[mlvAutofocus]` |
| `MlvSpacer` | Component | Flex spacer — `mlv-spacer` |
| `MlvResizeObserverService` | Service | Observe element resize events |
| `MlvResizeObserverFactory` | Service | Factory for creating `ResizeObserver` |
| `MlvResizeObserver` | Directive | Template-based resize observation — `[mlvResizeObserver]` |
| `UI_ANIMATION_DEFAULTS` | Token | `InjectionToken<MlvUiAnimationDefaults>` |
| `provideUiAnimationDefaults` | Function | Provider factory |
| `MlvUiAnimationDefaults` | Interface | `{ enterDuration?: string; leaveDuration?: string }` |
| `range` | Function | `range(length, mapFn?)` — build a `0..n-1` array, optionally mapped |
| `clamp` | Function | `clamp(value, min, max)` — constrain a number to an inclusive range |
| `mlvNextId` | Function | `mlvNextId(prefix)` — process-unique `<prefix>-<n>` id string (module counter) |
| `normalizeForMatch` | Function | `normalizeForMatch(text)` — pure text normaliser: NFD-fold, strip diacritics, lower-case, with an ASCII fast path (excluding `^` / `` ` ``, the two ASCII `Diacritic=Yes` characters) that collapses to `toLowerCase()`. Moved from `@malva-ui/core/dropdown`, which still re-exports it |
| `MlvBreakpoint` | Type | `'sm' \| 'md' \| 'lg'` — breakpoint tier name |
| `MlvBreakpointConfig` | Interface | `{ md: number; lg: number }` — pixel thresholds |
| `MLV_BREAKPOINT_CONFIG` | Token | `InjectionToken<MlvBreakpointConfig>` — root-provided with defaults `{ md: 768, lg: 1200 }` |
| `provideMlvBreakpoints` | Function | Provider factory for custom breakpoint thresholds |
| `BREAKPOINT_ORDER` | Constant | `readonly ['sm', 'md', 'lg']` — ordered tier list for comparisons |
| `MlvBreakpointService` | Service | Signal-based viewport breakpoint service wrapping CDK `BreakpointObserver` |
| `MlvBreakpointUp` | Directive | Structural directive — renders template at or above a given breakpoint (`*mlvBreakpointUp`) |
| `MlvBreakpointDown` | Directive | Structural directive — renders template below a given breakpoint (`*mlvBreakpointDown`) |
| `MlvNavItem` | Interface | Shared navigation item model for sidebar and bottom-nav |
| `MlvDirection` | Type | `'ltr' | 'rtl'` document direction |
| `MlvArrowKey` | Type | Angular CDK arrow-key code union returned by `MlvRtlService` |
| `MlvRtlService` | Service | Signal-based direction state, document/CDK `Directionality` synchronization, RTL-aware arrow-key normalization, and scoped direction resolution |
| `MlvDirectionTarget` | Type | `Element \| ElementRef<Element> \| null \| undefined` accepted by the scoped direction helpers |

---

## Components

### `MlvSpacer`

**Files:**

- `libs/cdk/utils/src/lib/spacer.ts`
- `libs/cdk/utils/src/lib/spacer.scss`

**Selector:** `mlv-spacer` | **Change Detection:** `OnPush` | **Encapsulation:** `None`
**Host class:** `mlv-spacer`
**Styles:** `.mlv-spacer { flex: 1 1 auto; }`

Grows to fill available space in flex containers.

---

## Directives

### `MlvAutofocus`

**File:** `libs/cdk/utils/src/lib/autofocus.ts`
**Selector:** `[mlvAutofocus]`

Automatically focuses the first (or last) tabbable element within the host after view init.

#### Inputs

| Name           | Type           | Default | Description                                  |
| -------------- | -------------- | ------- | -------------------------------------------- |
| `mlvAutofocus` | `BooleanInput` | `true`  | Enable/disable autofocus                     |
| `focusLast`    | `BooleanInput` | `false` | Focus last tabbable element instead of first |

#### Implementation

Uses Angular `effect()` — triggers focus when both `mlvAutofocus()` and `_initComplete()` are `true`. `_initComplete` is set in `ngAfterViewInit`.

Delegates to `MlvTabbableElementService` from `@malva-ui/cdk/accessibility`.

```html
<!-- Focus first -->
<div mlvAutofocus>
  <input type="text" />
  <!-- auto-focused -->
  <button>Submit</button>
</div>

<!-- Focus last -->
<div [mlvAutofocus]="true" [focusLast]="true">
  <button>First</button>
  <input type="text" />
  <!-- auto-focused -->
</div>
```

---

### `MlvResizeObserver`

**File:** `libs/cdk/utils/src/lib/observers/resize-observer.ts`
**Selector:** `[mlvResizeObserver]`
**Export as:** `mlvResizeObserver`

#### Properties

- `resizeEvents$: Observable<ResizeObserverEntry[]>` — observable stream
- `resized: output<ResizeObserverEntry[]>` — output from `outputFromObservable(resizeEvents$)`

```html
<div mlvResizeObserver (resized)="onResize($event)">Observe me</div>
```

---

## Services

### `MlvResizeObserverService`

**File:** `libs/cdk/utils/src/lib/observers/resize-observer.service.ts` | **Provided in:** `root`

#### `observe(element: Element | ElementRef): Observable<ResizeObserverEntry[]>`

Returns an observable that emits whenever the element's size changes. Automatically unobserves on unsubscribe. Shares a single `ResizeObserver` per element across subscriptions.

Cleans up all observers on `ngOnDestroy`.

---

### `MlvResizeObserverFactory`

**File:** Same as above | **Provided in:** `root`

#### `create(callback: ResizeObserverCallback): ResizeObserver | null`

Safe factory — returns `null` in environments without `ResizeObserver` support.

### `MlvRtlService`

**File:** `libs/cdk/utils/src/lib/rtl/rtl.service.ts` | **Provided in:** `root`

Owns the current document direction and keeps the document root plus Angular
CDK `Directionality` synchronized. `direction()` returns `'ltr'` or `'rtl'`,
and `rtl()` is its boolean form. `setDirection()`, `setRtl()`, and `toggle()`
update all three surfaces synchronously.

#### `normalizeArrowKey(event: KeyboardEvent): MlvArrowKey | null`

Converts the browser's arrow-key name or legacy numeric key code to Angular CDK
constants (`LEFT_ARROW`, `RIGHT_ARROW`, `UP_ARROW`, `DOWN_ARROW`). In RTL it
swaps only the horizontal constants; Up/Down and non-arrow keys are unchanged
or return `null`. Use this result for manual arrow-key switches. For a CDK
`FocusKeyManager`, pass `direction()` to `withHorizontalOrientation()` so the
manager can mirror its own navigation.

#### `resolveDirection(target: MlvDirectionTarget): MlvDirection`

Resolves the direction that actually applies to `target` by walking to the
nearest ancestor carrying an explicit `dir="ltr"`/`dir="rtl"` (`dir="auto"` is
transparent and the walk continues past it), falling back to the global
`direction()`. Crosses shadow boundaries via the host element.

**Direction is scoped**, so this is not the same as `direction()`: an element
inside a `[dir="rtl"]` subtree is RTL even while the document is LTR. This
matters most for overlays — a CDK overlay is portaled to the container on
`<body>`, outside whatever scope its trigger sits in, so the trigger's
direction has to be passed explicitly on the overlay config. Every Malva UI
overlay surface does this (see the table below).

#### `elementDirection(target: MlvDirectionTarget): Signal<MlvDirection>`

A signal of the direction applying to `target`, recomputed when the global
direction changes **and** when any `dir` attribute changes anywhere in the
document (one shared `MutationObserver`, started lazily and torn down with the
calling injection context — so call it in an injection context).

The shared observer is gated on `isPlatformBrowser(PLATFORM_ID)`, not on
`typeof MutationObserver`: an SSR process with a DOM shim loaded passes the
`typeof` test, and `observe()` then rejects the server document's element
because it is not a browser `Node`, throwing out of the server render. On the
server the signal simply resolves once from the static `dir` attributes.
Covered by `libs/core/src/ssr-smoke.spec.ts`.

Use it as an explicit dependency for anything that must be re-derived on a
direction flip, above all **JS-measured geometry**. Mirroring a container moves
its children without changing their size, so no `ResizeObserver` fires and no
item query changes — nothing else tells the component to re-measure:

```ts
private readonly _direction = inject(MlvRtlService).elementDirection(
  inject(ElementRef<HTMLElement>),
);

constructor() {
  effect(() => {
    this.activeItem();
    this._direction(); // re-measure when the inline axis flips
    this._measureIndicator();
  });
}
```

#### Consumers

| Surface                                              | What it uses the direction for                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `MlvPopupService`, `MlvTooltip`, `MlvAutocomplete`   | `direction` on the CDK overlay config, resolved from the trigger element                                   |
| `MlvOverlayServiceBase` (drawer), `MlvDialogService` | `direction` resolved from the focused element at open time; overridable via the config's `direction` field |
| `MlvOverlayHostBase`                                 | `direction` resolved from the component host                                                               |
| `MlvAbstractToastService`                            | global `direction()` — toast stacks are document-level                                                     |
| `MlvTabGroup`, `MlvSegmented`                        | re-measure the sliding indicator / pill on a direction flip                                                |
| `MlvSlider`, `MlvRating`, `MlvSplitPane`             | mirror pointer-coordinate → value mapping                                                                  |

---

## Helper Functions

### `range(length, mapFn?)`

**File:** `libs/cdk/utils/src/lib/range.util.ts`

Builds an array `[0, 1, …, length-1]`, optionally transformed by `mapFn`. Useful for fixed-count `@for` iteration in templates.

### `clamp(value, min, max)`

**File:** `libs/cdk/utils/src/lib/clamp.util.ts`

Returns `value` constrained to the inclusive range `[min, max]` (`Math.min(Math.max(value, min), max)`). Shared by numeric/geometry components (number-input, slider, sidebar, split-pane, time-picker, pin-input, approval-flow).

### `mlvNextId(prefix)`

**File:** `libs/cdk/utils/src/lib/id.util.ts`

Returns a process-unique id of the form `<prefix>-<n>`, where `<n>` is a monotonically increasing module counter. Preferred over random uuids for DOM `id`/`for`/`aria-*` wiring (stable, no SSR-hydration mismatch). Used by form controls, radio-group, pagination, breadcrumb, tooltip, drawer-section, and file-upload.

### `normalizeForMatch(text)`

**File:** `libs/cdk/utils/src/lib/normalize-for-match.ts`

Case- and diacritic-insensitive normalisation: NFD-folds `text`, strips combining diacritics (`\p{Diacritic}+`), and lower-cases — so `"Café"` folds to `"cafe"`.

**ASCII fast path.** When `text` carries neither a code unit >= `U+0080` nor one of the two ASCII characters `^` / `` ` `` (module-scope ``NEEDS_FULL_FOLD = /[\u0080-\uffff^`]/``, deliberately un-`g`-flagged so `lastIndex` cannot alternate results across `.test()` calls) the whole pipeline collapses to `text.toLowerCase()`: every ASCII code point is NFD-stable and ASCII `toLowerCase()` is a 1:1, length-preserving map. Measured ~2.5x cheaper than the three-step pipeline on a 40-char ASCII label, with no measurable cost on the full-fold branch.

**Why `^` and `` ` `` are excluded.** `U+005E` and `U+0060` are the **only** two ASCII code points with `Diacritic=Yes`, so `\p{Diacritic}` strips them — "ASCII" does _not_ imply "nothing to strip". A guard keyed on non-ASCII alone makes `normalizeForMatch('x^2')` return `'x^2'` instead of `'x2'`, silently changing results in every consumer (`MlvArrayDataSource` search, `filter-expression`, `smart-filter-bar`, `view-variant`, and all option controls) and breaking `matchSegments`' index alignment. Both characters therefore take the full pipeline.

The 1:1 length guarantee on the fast path is what lets `matchSegments` slice the original label directly. `normalize-for-match.spec.ts` pins both branches against a verbatim copy of the pre-fast-path implementation (ASCII, ASCII punctuation, `^` and `` ` ``, precomposed and decomposed accents, emoji, Turkish dotted/dotless I, German ß, Greek final sigma, lone combining mark, the U+007F/U+0080 boundary).

Moved down from `@malva-ui/core/dropdown`'s `option-matcher.ts` so CDK-only libraries (e.g. `@malva-ui/cdk/data-source`) can share it without importing `@malva-ui/core/*`; `@malva-ui/core/dropdown` re-exports it unchanged for existing consumers (`defaultOptionMatcher`, `rankPrefixMatchesFirst`, `matchSegments`, `smart-filter-bar`, `data-table`'s `MlvDataSource`).

---

## Injection Tokens

### `UI_ANIMATION_DEFAULTS`

```ts
export const UI_ANIMATION_DEFAULTS = new InjectionToken<MlvUiAnimationDefaults>('UI_ANIMATION_DEFAULTS');

export interface MlvUiAnimationDefaults {
  enterDuration?: string; // e.g. '200ms'
  leaveDuration?: string; // e.g. '150ms'
}
```

---

## Provider Function

```ts
export function provideUiAnimationDefaults(defaults: MlvUiAnimationDefaults): Provider;
```

```ts
// App bootstrap
bootstrapApplication(AppComponent, {
  providers: [provideUiAnimationDefaults({ enterDuration: '250ms', leaveDuration: '150ms' })],
});

// In component
animationDefaults = inject(UI_ANIMATION_DEFAULTS);
```

---

---

## Breakpoint System

### `MlvBreakpointService`

**File:** `libs/cdk/utils/src/lib/breakpoint/breakpoint.service.ts` | **Provided in:** `root`

Signal-based viewport breakpoint service. Wraps Angular CDK `BreakpointObserver` and exposes the current breakpoint tier as Angular signals. No manual unsubscription is required — cleanup is handled by `toSignal()`.

#### Signals

| Property     | Type                    | Description                                                            |
| ------------ | ----------------------- | ---------------------------------------------------------------------- |
| `breakpoint` | `Signal<MlvBreakpoint>` | Current active tier: `'sm'`, `'md'`, or `'lg'`. Initial value: `'sm'`. |
| `isSm`       | `Signal<boolean>`       | `true` when viewport is below the md threshold.                        |
| `isMd`       | `Signal<boolean>`       | `true` when viewport is between md and lg thresholds.                  |
| `isLg`       | `Signal<boolean>`       | `true` when viewport is at or above the lg threshold.                  |

#### Methods

| Method                      | Returns           | Description                                         |
| --------------------------- | ----------------- | --------------------------------------------------- |
| `isUp(bp: MlvBreakpoint)`   | `Signal<boolean>` | `true` when current breakpoint is at or above `bp`. |
| `isDown(bp: MlvBreakpoint)` | `Signal<boolean>` | `true` when current breakpoint is below `bp`.       |

#### Usage

```ts
// Inject and read in component class
readonly bp = inject(MlvBreakpointService);

// In template
// @if (bp.isSm()) { <mlv-bottom-nav [items]="navItems" /> }
// @if (bp.isLg()) { <mlv-sidebar /> }
```

#### Configuration

Default thresholds are `{ md: 768, lg: 1200 }`. Override to match SCSS customizations:

```ts
// app.config.ts
providers: [provideMlvBreakpoints({ md: 900, lg: 1440 })];
```

---

### `MlvBreakpointUp`

**File:** `libs/cdk/utils/src/lib/breakpoint/breakpoint-up.ts`
**Selector:** `[mlvBreakpointUp]`

Structural directive that renders its template when the viewport is **at or above** the given breakpoint. Content is created/destroyed in the DOM — not hidden via CSS.

#### Input

| Name              | Type            | Required | Description                                        |
| ----------------- | --------------- | -------- | -------------------------------------------------- |
| `mlvBreakpointUp` | `MlvBreakpoint` | ✅       | Minimum breakpoint at which to render the content. |

#### Usage

```html
<!-- Render sidebar only on tablet and above -->
<mlv-sidebar *mlvBreakpointUp="'md'" />

<!-- Render desktop toolbar only on large screens -->
<mlv-toolbar *mlvBreakpointUp="'lg'">...</mlv-toolbar>
```

```ts
@Component({
  imports: [MlvBreakpointUp],
})
```

---

### `MlvBreakpointDown`

**File:** `libs/cdk/utils/src/lib/breakpoint/breakpoint-down.ts`
**Selector:** `[mlvBreakpointDown]`

Structural directive that renders its template when the viewport is **below** the given breakpoint. Content is created/destroyed in the DOM — not hidden via CSS.

#### Input

| Name                | Type            | Required | Description                                   |
| ------------------- | --------------- | -------- | --------------------------------------------- |
| `mlvBreakpointDown` | `MlvBreakpoint` | ✅       | Breakpoint below which to render the content. |

#### Usage

```html
<!-- Render mobile hamburger button only below md -->
<button *mlvBreakpointDown="'md'" mlvButton (click)="openDrawer()">
  <svg lucideMenu [size]="20" />
</button>

<!-- Render bottom nav only on mobile -->
<mlv-bottom-nav *mlvBreakpointDown="'md'" [items]="navItems" />
```

```ts
@Component({
  imports: [MlvBreakpointDown],
})
```

---

## Navigation Model

### `MlvNavItem`

**File:** `libs/cdk/utils/src/lib/navigation/nav-item.ts`

Shared interface for navigation items. A single data source can drive both `mlv-sidebar` (desktop) and `mlv-bottom-nav` (mobile) so that navigation state stays in one place.

```ts
export interface MlvNavItem {
  /** Lucide icon name (e.g., 'home', 'search', 'settings'). */
  icon: string;
  /** Visible label for the navigation item. */
  label: string;
  /** Router path (e.g., '/home', '/settings'). */
  route: string;
  /** Optional badge count displayed on the item. */
  badge?: number;
  /** When true the item is visually muted and non-interactive. */
  disabled?: boolean;
}
```

#### Usage

```ts
// Define once in the app shell
readonly navItems: MlvNavItem[] = [
  { icon: 'home',     label: 'Home',     route: '/home' },
  { icon: 'search',   label: 'Search',   route: '/search' },
  { icon: 'settings', label: 'Settings', route: '/settings', badge: 3 },
];
```

```html
<!-- Share data between desktop sidebar and mobile bottom nav -->
<mlv-sidebar *mlvBreakpointUp="'md'">
  <!-- sidebar items wired manually via mlv-sidebar-item directives -->
</mlv-sidebar>
<mlv-bottom-nav *mlvBreakpointDown="'md'" [items]="navItems" />
```

---

## Dependencies

- `@malva-ui/cdk/accessibility` — `MlvTabbableElementService` (used by `MlvAutofocus`)
- `@angular/cdk/coercion` — `coerceElement`, `BooleanInput`
- `@angular/cdk/layout` — `BreakpointObserver` (used by `MlvBreakpointService`)
- `rxjs` — `Observable`, `Subject`
