---
# Library: utils

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Utils library (`@malva-ui/cdk/utils`) provides common Angular utilities: autofocus, a flex spacer component, resize observer service/directive, animation token defaults, breakpoint helpers, and pure helper functions (`range`, `clamp`, `mlvNextId`, `normalizeForMatch`, `defaultCompareWith`).

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
| `defaultCompareWith` | Function | `defaultCompareWith(a, b)` — the shared `===` default behind every selection surface's `compareWith` (`mlv-select`, `mlv-combobox`, `MlvSelectionService`). A single module-level reference so callees can **recognise** it and take a keyed fast path. Moved from `@malva-ui/core/dropdown`, which still re-exports it |
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
| `MlvChromeColor` | Directive | Paints an element as application chrome in an arbitrary colour and picks a readable foreground — `[mlvChromeColor]` |

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

### `MlvChromeColor`

**File:** `libs/cdk/utils/src/lib/chrome/chrome-color.ts`
**Selector:** `[mlvChromeColor]`
**Export as:** `mlvChromeColor`

Paints an element as application chrome in an arbitrary colour and picks a
foreground that stays readable on it.

A brand-coloured surface is the case every design system gets wrong twice: once
by asking the author to name the text colour as well, and once by deriving it
from a token map that cannot see a `var()` the consumer wrote. The directive
resolves the colour **in the host's own cascade** — so `var(--brand-500)`, a
`color-mix()`, a `light-dark()` or a bare keyword all work — composites it over
what is actually behind it when it is translucent, and chooses the foreground
by contrast ratio.

#### Inputs

| Name               | Type             | Default | Description                                                                                                             |
| ------------------ | ---------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `mlvChromeColor`   | `string \| null` | `null`  | The chrome background. Any CSS colour the host's own cascade can resolve, custom properties and `color-mix()` included. |
| `chromeForeground` | `string \| null` | `null`  | Overrides the automatically chosen foreground. Set it only when the contrast pick is wrong for a specific brand colour. |

#### Published

| Property / signal         | Value                                        |
| ------------------------- | -------------------------------------------- |
| `--mlv-chrome-background` | The resolved background, as an opaque colour |
| `--mlv-chrome-foreground` | The foreground chosen for it                 |
| `background()`            | The same background, as a signal             |
| `foreground()`            | The same foreground, as a signal             |

It also paints the element itself (`background` / `color`), so it is useful
standalone — a stylesheet reading the two properties is the extra, not the
point.

Both custom properties are **absent, not empty**, while no colour is set, so a
stylesheet's `var(…, fallback)` is what applies and the element keeps whatever
it had. `--mlv-page-shell-chrome-background` is exactly that fallback: see
[libs-page.md](libs-page.md) → _`MlvPageShell` → Chrome colour_.

```html
<nav mlvActionBar [mlvChromeColor]="brand()">…</nav>
<mlv-page-shell color="var(--brand-700)">…</mlv-page-shell>
```

The resolution re-runs when the colour inputs change **and** whenever anything
in the host's ancestor chain changes `class`, `style`, `data-theme` or
`mlvTheme`: a theme flip changes what a `var()` resolves to without changing a
single binding, which no signal can see. One `MutationObserver` watches the
whole chain, and the CSS reads are coalesced into one animation frame.

It lives in `@malva-ui/cdk/utils` rather than inside `mlv-page-shell`, where it
started, because contrast-derived chrome is useful on any dark surface — a
standalone action bar, a sidebar in a bespoke layout, a marketing header — and
welding it into the shell made it reachable only by adopting the whole shell.
`MlvPageShell` now composes it through `hostDirectives`, aliasing the two
inputs back to the `color` / `foreground` names it always had.

---

## Services

### `MlvResizeObserverService`

**File:** `libs/cdk/utils/src/lib/observers/resize-observer.service.ts` | **Provided in:** `root`

#### `observe(element: Element | ElementRef): Observable<ResizeObserverEntry[]>`

Returns an observable that emits whenever the element's size changes. Automatically unobserves on unsubscribe. Shares a single `ResizeObserver` per element across subscriptions.

Cleans up all observers on `ngOnDestroy`.

Contract pinned by `resize-observer.spec.ts` — the load-bearing parts for any future change to how observers are allocated:

- **Per-element stream isolation.** A subscriber for element `E` receives only batches reported for `E`. Consumers depend on it: `mlv-avatar-group`, `mlv-copy-to-clipboard`, `mlv-data-table`, `mlv-page-content`, `mlv-editor-toolbar`, `mlv-editor-zoom` and two docs examples index `entries[0]` / `entries[entries.length - 1]` and treat it as their own element's rect. A shared observer forwarding whole batches — as CDK's private `SharedResizeObserver` does — silently breaks all of them.
- **Per-element refcount.** Observing one element twice allocates one `ResizeObserver`; the first unsubscribe leaves the second subscriber receiving; the last disconnects. Unobserving one element never disturbs another's.
- **`MlvResizeObserverFactory` is the only path to the platform.** No global `ResizeObserver` is ever touched, so a server render (factory returns `null`) subscribes and tears down without emitting or throwing.

One `ResizeObserver` per distinct element, not one shared across all. Measured (Chrome 152, #15): at the ~12 elements a composed Malva page observes, sharing saves **0.0 ms** per resize round and **~286 bytes**; the delta only becomes measurable past ~200 observed elements (0.1–0.8 ms) — a scale no consumer reaches, since each observes exactly one element.

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

#### `normalizeArrowKey(event: KeyboardEvent, direction?: MlvDirection): MlvArrowKey | null`

Converts the browser's arrow-key name or legacy numeric key code to Angular CDK
constants (`LEFT_ARROW`, `RIGHT_ARROW`, `UP_ARROW`, `DOWN_ARROW`). Only the
horizontal constants swap in RTL; Up/Down and non-arrow keys are unchanged or
return `null`. Use this result for manual arrow-key switches. For a CDK
`FocusKeyManager`, pass the same direction to `withHorizontalOrientation()` so
the manager can mirror its own navigation.

- **The second argument is a resolved direction, not an element.** Resolving
  means walking `parentElement` to the nearest explicit `dir`, and a keydown
  handler runs once per keystroke. `elementDirection(host)` does that walk once
  and caches it behind the shared `dir` `MutationObserver`, so the caller
  resolves in a field initializer and the handler reads the signal:
  `normalizeArrowKey(event, this._direction())`. Most components already hold
  that signal for a horizontal `FocusKeyManager` or for measured geometry —
  reusing it is also what keeps the halves from disagreeing.
- **Pass it whenever the handler branches on `ArrowLeft`/`ArrowRight`.**
  Direction is scoped: a handler inside a `dir="rtl"` subtree, or inside a CDK
  overlay pane (CDK stamps `dir` on every overlay host, and `MlvPopupService`
  resolves that from the trigger), must mirror while the document is still LTR.
  Omitting it there is the #147 defect — mirrored layout, unmirrored keys.
- **Omitting it keeps the global `rtl()` reading**, which is correct only for a
  vertical-only handler — one that never matches the horizontal pair, where
  mirroring is a no-op either way (`focusable-group-base`, `mlv-sidebar`'s
  container nav, the `mlv-tabs` overflow popup, `mlv-autocomplete`,
  `mlv-number-input`, `mlv-search-field`, `mlv-data-table`'s row nav,
  `mlv-menubar`'s own switch — which delegates everything horizontal to its
  `FocusKeyManager`). Every such site carries an inline comment saying so, so a
  reader never has to guess whether the omission was deliberate.
- **Resolve from the element the handler speaks for**, never `event.target`:
  the event is usually handled on a host that is not where the key was pressed,
  and a portaled overlay's pane sits outside its trigger's `[dir]` scope
  entirely.
- **The component's own host is not always that element.** `MlvMenu` is the
  case in the repo: its panel is projected through `<ng-template mlvPopupContent>`
  into an overlay pane whose `dir` comes from the **trigger**
  (`resolveDirection(config.origin)`), while `<mlv-menu>` itself stays at its
  declaration site — routinely outside the trigger's `[dir]` scope, since menus
  are usually declared once at page level. It resolves from `event.currentTarget`
  (the `<mlv-list>` panel, always inside the pane), and because that panel is
  re-created per attach and can be attached from triggers in different scopes,
  it is the **one** handler that calls `resolveDirection()` per event rather
  than reading a cached signal. Components whose host _is_ inside the pane or
  _is_ the popup origin (`MlvMenuItem`, `MlvMenuTrigger`, `mlv-calendar`,
  `mlv-time-picker`, `mlv-breadcrumb`, `mlv-sidebar-group`, the editor's table
  menu, `mlv-drawer`'s resize handle) cache `elementDirection(host)`.

```ts
private readonly _direction = this._rtlService.elementDirection(
  this._elementRef,
);

switch (
  this._rtlService.normalizeArrowKey(event, this._direction()) ?? event.key
) {
```

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
service itself — the root environment injector's lifetime, not the first
caller's, so destroying one component cannot stop every other consumer's signal
from updating).

The shared observer is gated on `isPlatformBrowser(PLATFORM_ID)`, not on
`typeof MutationObserver`: an SSR process with a DOM shim loaded passes the
`typeof` test, and `observe()` then rejects the server document's element
because it is not a browser `Node`, throwing out of the server render. On the
server the signal simply resolves once from the static `dir` attributes.
Covered by `libs/core/src/ssr-smoke.spec.ts`.

Use it as an explicit dependency for anything that must be re-derived on a
direction flip: **JS-measured geometry** (mirroring a container moves its
children without changing their size, so no `ResizeObserver` fires and no item
query changes — nothing else tells the component to re-measure), the direction
handed to `normalizeArrowKey()` and the one handed to a horizontal
`FocusKeyManager`. One signal per component feeds all of them:

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

| Surface                                              | What it uses the direction for                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `MlvPopupService`, `MlvTooltip`, `MlvAutocomplete`   | `direction` on the CDK overlay config, resolved from the trigger element                                                |
| `MlvOverlayServiceBase` (drawer), `MlvDialogService` | `direction` resolved from the focused element at open time; overridable via the config's `direction` field              |
| `MlvOverlayHostBase`                                 | `direction` resolved from the component host                                                                            |
| `MlvAbstractToastService`                            | global `direction()` — toast stacks are document-level                                                                  |
| `MlvTabGroup`, `MlvSegmented`                        | re-measure the sliding indicator / pill on a direction flip                                                             |
| `MlvSlider`, `MlvRating`, `MlvSplitPane`             | mirror pointer-coordinate → value mapping                                                                               |
| Every horizontal arrow handler                       | `normalizeArrowKey(event, this._direction())` — one cached `elementDirection()` per component, so keys and layout agree |

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

### `defaultCompareWith(a, b)`

**File:** `libs/cdk/utils/src/lib/default-compare-with.ts`

`(a, b) => a === b`. The default value-equality predicate behind every Malva UI selection surface: the option controls' `compareWith` **input** (`mlv-select`, `mlv-combobox`) and `MlvSelectionService.compareWith`.

**It exists to be recognised, not merely invoked.** `input()` evaluates its default once per component instance and `signal()` once per service instance, so an inline `(a, b) => a === b` is a fresh function reference per control that no callee can identify. `@malva-ui/core/dropdown`'s `isReconciliationEmit`, `filteredOutCommitted` and `valueIndex` branch on `compare === defaultCompareWith` (via `hazardOf`) to swap a nested pairwise scan for O(1) `Set` / `Map` membership; a caller-supplied comparator keeps the pairwise path unchanged.

**Every re-export must forward the identical binding** (`import` + `export { … }`, as `reconciliation.ts` does). A wrapper compares unequal and silently disables every fast path **without changing a single result** — nothing goes red. `reconciliation.spec.ts` asserts the identity across all three libraries, and pins it end-to-end by counting element reads (1,000 on the keyed path vs 50,000 pairwise).

It is `===`, not `Object.is`: `defaultCompareWith(NaN, NaN)` is `false` and `defaultCompareWith(0, -0)` is `true`. Both quirks are load-bearing — `hazardOf` derives "`NaN` is the one value on which a `Set` may not stand in for this comparator" from the first, so promoting it to `Object.is` would leave that guard checking the wrong hazard. `default-compare-with.spec.ts` pins both against `Object.is` explicitly.

Lives here rather than in the dropdown because `@malva-ui/core/dropdown` depends on `@malva-ui/core/form-utils` (`mlv-dropdown-panel` injects `MlvSelectionService`), so a constant owned by the dropdown could not be shared with the service without inverting that dependency (issue #67). `@malva-ui/core/dropdown` re-exports it, so its public surface is unchanged.

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

| Method                      | Returns           | Description                                                               |
| --------------------------- | ----------------- | ------------------------------------------------------------------------- |
| `isUp(bp: MlvBreakpoint)`   | `Signal<boolean>` | `true` when current breakpoint is at or above `bp`. Memoized — see below. |
| `isDown(bp: MlvBreakpoint)` | `Signal<boolean>` | `true` when current breakpoint is below `bp`. Memoized — see below.       |

##### Memoization

- Both return a **stable instance**: `isDown('md') === isDown('md')`, and an unknown `bp` is a distinct node from `'sm'`. Stable identity is the contract — rely on it.
- Cached per direction, keyed by the resolved `BREAKPOINT_ORDER` **index**, not the name, so every out-of-union value collapses onto the single `-1` entry. Bounded by the `MlvBreakpoint` union plus that `-1` entry (four today); the bound assumes `BREAKPOINT_ORDER` is not mutated at runtime — it is `readonly` to TypeScript but is a plain unfrozen exported array. Root singleton, no eviction policy; the cached signals close over nothing but `breakpoint()` and the captured index.
- `BREAKPOINT_ORDER.indexOf(bp)` resolves at **call** time, not read time. An out-of-union `bp` still yields `-1`, so `isUp` is permanently `true` (`current >= -1`) and `isDown` permanently `false` (`current < -1`). Deliberately neither validated nor thrown on.
- **What this is worth.** No call site in the repo calls these from a template today — all read-and-discard inside a `computed()` body or a field initializer, where a clean read re-runs nothing and allocates nothing. The realized saving is therefore ≈0. The value is the stable-identity contract above and the removed footgun below, not a saving being collected now.
- **The footgun it removes.** A template method call runs on **every** change-detection pass. Before memoization, `@if (bp.isDown('md')()) { … }` allocated one throwaway reactive node per pass (measured: 2,000 passes → 2,000 nodes; now 0). That form is one character from the `bp.isSm()` cached-property form the usage example shows, so it was easy to reach for by accident.

#### Usage

```ts
// Inject and read in component class
readonly bp = inject(MlvBreakpointService);

// In template
// @if (bp.isSm()) { <mlv-bottom-nav [items]="navItems" /> }
// @if (bp.isLg()) { <mlv-sidebar /> }
// @if (bp.isDown('md')()) { ... }   // also fine — the signal is cached
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
