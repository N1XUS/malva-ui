---
# Library: drawer

Internal drawer-section controls explicitly use `type="button"` to remain
form-safe.

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

`@malva-ui/core/drawer` provides a slide-in overlay panel (drawer) that renders over the rest of the UI using the Angular CDK Overlay. It supports two usage patterns:

1. **Template-based** (`MlvDrawer` + `MlvDrawerContent`): Declare the drawer inline in a host component's template. The drawer is controlled via a two-way `opened` model signal.
2. **Imperative / service-based** (`MlvDrawerService`): Programmatically open any Angular component inside a drawer overlay by calling `MlvDrawerService.open()`. Useful for lazy, dynamic content.
3. **Route-driven** — use `mlvGenerateRoutableDrawerRoute()` to create a route that opens a component in a drawer when activated; when the drawer closes, the router navigates back to the parent route.

Additionally, the library ships `MlvDrawerSection` and `MlvDrawerSections` for dividing a drawer body into labeled scroll-tracked sections with a navigation pop-up.

---

## Public API

Exported from `libs/core/drawer/src/index.ts`:

| Export                           | Kind                      | Description                                                                                                              |
| -------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `MlvDrawer`                      | Component                 | The inline template-based drawer host                                                                                    |
| `MlvDrawerContent`               | Directive                 | Marks the `<ng-template>` whose content fills the drawer panel                                                           |
| `MlvDrawerPosition`              | Type alias                | `'left' \| 'right' \| 'top' \| 'bottom'`                                                                                 |
| `MlvDrawerHeader`                | Directive                 | Applies `mlv-drawer__header` class to a child element                                                                    |
| `MlvDrawerBody`                  | Component                 | Scrollable drawer body backed by `mlv-scrollbar` — `[mlvDrawerBody]`                                                     |
| `DrawerBodyDirective`            | Compatibility alias       | Backwards-compatible export alias for `MlvDrawerBody`                                                                    |
| `MlvDrawerFooter`                | Directive                 | Applies `mlv-drawer__footer` class to a child element                                                                    |
| `MlvDrawerService`               | Service                   | Imperatively opens a component in a drawer overlay                                                                       |
| `DRAWER_DATA`                    | `InjectionToken<unknown>` | Token to inject data passed via `MlvDrawerConfig.data` in the opened component                                           |
| `MlvDrawerConfig`                | Interface                 | Configuration object for `MlvDrawerService.open()`                                                                       |
| `MlvDrawerRef`                   | Class                     | Reference to an imperatively opened drawer; exposes `close()`, `afterClosed()`, `beforeClose()`                          |
| `MlvDrawerSection`               | Component                 | An intersection-observer-tracked, labeled section within a drawer body                                                   |
| `MlvDrawerSectionsService`       | Service                   | Scoped service managing section registration and scroll-active tracking                                                  |
| `MlvDrawerSections`              | Component                 | Navigation pop-up listing all registered sections                                                                        |
| `mlvGenerateRoutableDrawerRoute` | Function                  | Creates a `Route` that opens a component inside a drawer when activated; accepts eager class or lazy `() => import(...)` |

`MlvDrawerResize` remains an implementation detail and is intentionally
absent from the public barrel. Drawer-section DOM lookup is scoped to the owning
`.mlv-drawer` instance so multiple drawers cannot select one another's body.

---

## Components

### `MlvDrawer`

**Selector:** `mlv-drawer`

**File:** `libs/core/drawer/src/lib/drawer/drawer.ts`

**Purpose:** Inline template-based drawer. Renders its content inside an Angular CDK Overlay when opened. Handles enter/leave CSS animations, focus trapping, backdrop click / Escape key dismissal.

**Extends:** `MlvOverlayHostBase` from `@malva-ui/cdk/overlay`. The `opened` model, `hasBackdrop`/`closeOnBackdropClick`/`closeOnEscape`/`restoreFocus` inputs, `afterOpened`/`afterClosed` outputs, `animationState` signal, `open()`/`close()`/`onAnimationEnd()` methods, optional focus restoration, and overlay create/destroy lifecycle are inherited from the shared base. `MlvDrawer` adds only the drawer-specific position/size/resize surface and supplies the backdrop class + edge position strategy. The `opened` + `afterOpened`/`afterClosed` shape is intentionally consistent with `mlv-popup`. The dialog no longer shares it: its open state moved to `ng-template[mlvDialog]` / `MlvDialogService` on `@angular/cdk/dialog`, and `mlv-dialog` is now only the presentational surface — no `opened` model, no `afterOpened`/`afterClosed`.

**Inputs (`input()` / `model()`):**

| Name                   | Type                       | Default   | Description                                                                                                                                                       |
| ---------------------- | -------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opened`               | `model<boolean>`           | `false`   | Two-way bindable; `true` opens the drawer, `false` closes it                                                                                                      |
| `position`             | `input<MlvDrawerPosition>` | `'right'` | Which edge of the viewport the drawer slides from                                                                                                                 |
| `size`                 | `input<string>`            | `'300px'` | Width (left/right) or height (top/bottom) of the panel; used as initial size when `resizable=false`                                                               |
| `hasBackdrop`          | `input<boolean>`           | `true`    | Whether a dim backdrop is shown behind the drawer                                                                                                                 |
| `closeOnBackdropClick` | `input<boolean>`           | `true`    | Whether clicking the backdrop closes the drawer                                                                                                                   |
| `closeOnEscape`        | `input<boolean>`           | `true`    | Whether pressing Escape closes the drawer                                                                                                                         |
| `restoreFocus`         | `input<boolean>`           | `true`    | Inherited coerced boolean. Restores the connected pre-open focus target after disposal; composed owners can disable it.                                           |
| `resizable`            | `input<boolean>`           | `false`   | When true, renders a drag handle; enables drag-to-resize and swipe-to-dismiss                                                                                     |
| `snapPoints`           | `input<number[]>`          | `[]`      | Sorted viewport-percentage snap points (0–100); panel snaps to nearest after drag. Empty = free resize                                                            |
| `defaultSnap`          | `input<number>`            | `100`     | Initial snap point percentage applied when the drawer opens (only when `resizable=true`)                                                                          |
| `minSize`              | `input<string>`            | `'0px'`   | CSS min-size floor for resize                                                                                                                                     |
| `maxSize`              | `input<string>`            | `'100%'`  | CSS max-size ceiling for the sizing axis. Honoured **whether or not** `resizable` is set, and always additionally clamped to the viewport                         |
| `initialFocus`         | `MlvOverlayInitialFocus`   | `'auto'`  | Inherited from `MlvOverlayHostBase`. `'auto'` skips the close button and the body scroll viewport — see [libs-overlay.md](libs-overlay.md)                        |
| `ariaLabel`            | `input<string>`            | —         | Accessible name for the `role="dialog"` surface. Used as `aria-label` when `ariaLabelledBy` is unset.                                                             |
| `ariaLabelledBy`       | `input<string>`            | —         | Id of a visible element (e.g. a projected `[mlvDrawerHeader]`) that labels the drawer. Takes precedence over `ariaLabel`/the i18n fallback via `aria-labelledby`. |

**Outputs (`output()`):**

| Name          | Type                     | Description                                                  |
| ------------- | ------------------------ | ------------------------------------------------------------ |
| `afterOpened` | `OutputEmitterRef<void>` | Fires once the overlay is created and enter animation begins |
| `afterClosed` | `OutputEmitterRef<void>` | Fires once the overlay is destroyed (after leave animation)  |

**Public methods:**

- `open(): void` — Sets `opened` to `true`.
- `close(): void` — Sets `opened` to `false` and triggers the leave animation.
- `onAnimationEnd(): void` — Called by the template's `animationend` event to destroy the overlay after leave animation.

**Internal signals:**

- `animationState: Signal<'enter' | 'leave' | 'idle'>` — Drives CSS animation classes on the drawer panel.
- `hiddenTransform: Signal<string>` — Computed CSS transform string applied as a CSS variable for the slide-out keyframe.

**Template structure (`drawer.html`):**

```
<ng-template #drawerTemplate>
  <div class="mlv-drawer mlv-drawer--{position}" role="dialog" aria-modal="true"
       cdkTrapFocus [cdkTrapFocusAutoCapture]="false"
       [class.mlv-drawer--enter] [class.mlv-drawer--leave]
       [style.width] [style.height]
       [style.max-width] [style.max-height]
       [style.--mlv-drawer-hidden-transform]
       (animationend)="onAnimationEnd()">
    @if (contentRef()) {
      <ng-template [ngTemplateOutlet]="contentRef()!.templateRef" />
    }
  </div>
</ng-template>
```

The focus trap keeps Tab inside the panel but **does not auto-capture**: taking
the first tabbable node landed on the leftmost `mlv-button-close`, popping its
"Close" tooltip on every open. `MlvOverlayHostBase` applies the `initialFocus`
strategy instead. With the inherited `restoreFocus=true` default, focus returns
to the connected pre-open target on close. Set `restoreFocus=false` when a
composed parent owns the logical focus lifecycle; disposal then leaves focus
untouched. Reopening during leave cancels disposal and keeps the Drawer rendered.

**Viewport clamping:** `drawerDimensions` emits `maxWidth`/`maxHeight` alongside
`width`/`height`. The sizing axis resolves to `min(<maxSize>, 100dvw|100dvh)`
(the `'100%'` default collapses to the bare viewport ceiling), and the cross axis
fills the viewport. Without this a fixed `size="36rem"` rendered 576 px wide on a
375 px phone. `.mlv-drawer` also carries `max-inline-size: 100dvw` /
`max-block-size: 100dvh` as the declarative-path floor.

**Accessible name (the `role="dialog"` is never nameless):** the panel resolves its
name in this precedence order, mirroring how a dialog labels itself from the
title id `mlv-dialog-header` publishes (`<dialogId>-title-<n>`):

1. `ariaLabelledBy` input → bound to `aria-labelledby` (point it at a projected
   `[mlvDrawerHeader]` id or any visible label). Suppresses `aria-label`.
2. `ariaLabel` input → bound to `aria-label`.
3. i18n fallback → `MLV_DRAWER_I18N.drawer` ("Drawer") via the `_resolvedAriaLabel`
   computed, so the drawer panel always has an accessible name even when nothing is set.

The previous dangling `_titleId` `aria-labelledby` (which pointed at an element that
was never rendered) remains removed.

The `<ng-template>` is projected into a CDK `TemplatePortal` when opened.

**Host bindings:** None on the host element itself — the panel is rendered into an overlay container via CDK.

**Providers:** `MlvDrawerSectionsService` (component-scoped).

**CSS variables:**

| Variable                      | Default                                                        | Description                                            |
| ----------------------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| `--mlv-drawer-enter-duration` | `300ms`                                                        | Duration of backdrop fade-in                           |
| `--mlv-drawer-enter-easing`   | `ease-in-out`                                                  | Easing of backdrop fade-in                             |
| `--mlv-drawer-leave-duration` | `300ms`                                                        | Duration of backdrop fade-out                          |
| `--mlv-drawer-leave-easing`   | `ease-in-out`                                                  | Easing of backdrop fade-out                            |
| `--mlv-drawer-current-size`   | _(unset)_                                                      | Live height/width set by `MlvDrawerResize` during drag |
| `--mlv-drawer-snap-duration`  | `var(--mlv-duration-slow)` (300ms)                             | Duration of the post-drag spring snap animation        |
| `--mlv-drawer-snap-easing`    | `var(--mlv-ease-spring)` (`cubic-bezier(0.34, 1.56, 0.64, 1)`) | Easing of the spring snap animation                    |

**CSS classes (panel element `mlv-drawer`):**

| Class                               | Applied when                                          |
| ----------------------------------- | ----------------------------------------------------- |
| `mlv-drawer--left/right/top/bottom` | Always, matches `position` input                      |
| `mlv-drawer--enter`                 | During open animation                                 |
| `mlv-drawer--leave`                 | During close animation                                |
| `mlv-drawer--resizable`             | When `resizable=true`                                 |
| `mlv-drawer--dragging`              | While a pointer drag is active (disables transitions) |
| `mlv-drawer--snapping`              | During post-drag spring snap animation                |

`mlv-drawer--snapping` declares its `transition` inside
`@media (prefers-reduced-motion: no-preference)`, so under reduced motion the
panel has no transition and fires no `transitionend` — and neither does a snap
onto the size the panel already holds. `MlvDrawerResize` therefore races the
event against a 1s fallback timer (`race(fromEvent(panel, 'transitionend'),
timer(…)).pipe(take(1), takeUntilDestroyed(…))`) instead of waiting on it. Before
that (fixed in #76) the class latched on the panel permanently in both cases and
one `transitionend` listener accumulated per snap gesture.

**Styling tokens used (`drawer.scss`):**

- `--mlv-background-elevation-1`, `--mlv-shadow-medium`, `--mlv-text-primary`, `--mlv-padding-l`, `--mlv-border-normal`

---

### `MlvDrawerSection`

**Selector:** `[mlvDrawerSection]` (attribute selector — applied to block-level elements)

**File:** `libs/core/drawer/src/lib/drawer-section/drawer-section.ts`

**Purpose:** Wraps a section of the drawer body with a heading and content area. Registers itself with the scoped `MlvDrawerSectionsService` so the `MlvDrawerSections` can track which section is in view using `IntersectionObserver`.

**Inputs:**

| Name    | Type                       | Required | Default    | Description                                 |
| ------- | -------------------------- | -------- | ---------- | ------------------------------------------- |
| `label` | `input.required<string>()` | Yes      | —          | Section heading text                        |
| `id`    | `input<string>()`          | No       | `uuidv4()` | Unique ID used by the intersection observer |

**Template (`drawer-section.html`):**

```html
<div class="mlv-drawer-section__heading">
  <h5 class="mlv-text-h5">{{ label() }}</h5>
</div>
<div class="mlv-drawer-section__content">
  <ng-content />
</div>
```

**Host bindings:** None declared (attribute selector applied to host).

**CSS classes (`drawer-section.scss`, block `mlv-drawer-section`):**

- `mlv-drawer-section__heading` — flex row with bottom border, `--mlv-padding-m` vertical padding, `--mlv-text-primary` color.
- `mlv-drawer-section__content` — wraps projected content.

**Lifecycle:** Calls `MlvDrawerSectionsService.register(this)` on init and `unregister(this)` on destroy.

---

### `MlvDrawerSections`

**Selector:** `mlv-drawer-sections`

**File:** `libs/core/drawer/src/lib/drawer-sections/drawer-sections.ts`

**Purpose:** Renders a compact navigation control (a button + popup list) that shows the currently-scrolled section and allows clicking any section label to smooth-scroll to it within `.mlv-drawer__body`.

**Renders nothing below two sections.** The whole template is gated on the
protected `_hasMultipleSections` computed — a single registered section produced
a dropdown whose only entry was the section already on screen.

**Inputs:** None.

**Template (`drawer-sections.html`):**

```html
<button mlvButton [mlvPopupTrigger]="popup" [ariaHasPopup]="'menu'" triggerOn="hover" size="small" variant="transparent">
  {{ sectionsService.currentScrolledSection()?.label() }}
  <svg lucideChevronDown size="20" />
</button>
<mlv-popup #popup [(opened)]="isOpen">
  <ng-template mlvPopupContent>
    <mlv-list [listRole]="'menu'">
      @for (section of sectionsService.normalizedSections(); track section) {
      <mlv-list-item itemRole="menuitem" (mlvClick)="navigateToSection(section.elementRef)">{{ section.label() }}</mlv-list-item>
      }
    </mlv-list>
  </ng-template>
</mlv-popup>
```

The section-navigation popover is a **menu**: the trigger button advertises `aria-haspopup="menu"` (via `MlvPopupTrigger`'s `ariaHasPopup` input), the wrapping `mlv-popup` stays roleless, and the semantic role lives on the projected content — `mlv-list` gets `[listRole]="'menu'"` and each `mlv-list-item` `itemRole="menuitem"`.

**Public methods:**

- `navigateToSection(section: ElementRef): void` — Smooth-scrolls `.mlv-drawer__body` to the target element with an 80 px top offset.

**Dependencies:** `@malva-ui/core/popup`, `@malva-ui/core/button`, `@malva-ui/core/list`, `@lucide/angular`, `@malva-ui/cdk/accessibility`.

---

## Directives

### `MlvDrawerContent`

**Selector:** `[mlvDrawerContent]`

**File:** `libs/core/drawer/src/lib/drawer-content.ts`

**Purpose:** Applied to an `<ng-template>` inside `<mlv-drawer>`. Exposes the `TemplateRef` so `MlvDrawer` can project the template into the CDK overlay portal.

**Properties:**

- `templateRef: TemplateRef<unknown>` — injected `TemplateRef` of the host `<ng-template>`.

---

### `MlvDrawerHeader`

**Selector:** `[mlvDrawerHeader]`

**File:** `libs/core/drawer/src/lib/drawer-header.ts`

**Host bindings:** `class: 'mlv-drawer__header'`

**Purpose:** Styles the host element as a drawer header (flex row, bottom border, padding via design tokens).

---

### `MlvDrawerBody` (`DrawerBodyDirective` compatibility alias)

**Selector:** `[mlvDrawerBody]`

**File:** `libs/core/drawer/src/lib/drawer-body.ts`

**Host bindings:** `class: 'mlv-drawer__body'`

**Template:** `<mlv-scrollbar class="mlv-drawer__body-scrollbar"><ng-content /></mlv-scrollbar>`

**Purpose:** Preserves the `[mlvDrawerBody]` selector and legacy `DrawerBodyDirective` import while using the shared Malva scrollbar for declarative and service-opened drawer bodies.

Body padding (`spacing-3` block / `spacing-6` inline) is set on
`.mlv-drawer__body-scrollbar > .mlv-scrollbar__viewport`, i.e. inside the
`overflow-x: hidden` clip box, so full-width controls' focus rings are not
clipped. Do not move it back onto the scrollbar host.

---

### `MlvDrawerFooter`

**Selector:** `[mlvDrawerFooter]`

**File:** `libs/core/drawer/src/lib/drawer-footer.ts`

**Host bindings:** `class: 'mlv-drawer__footer'`

**Purpose:** Marks the host element as the drawer footer area (no additional styles in current SCSS beyond class token; consumers add their own styles).

---

### `MlvDrawerResize` (internal — not exported)

**Selector:** `[mlvDrawerResize]`

**File:** `libs/core/drawer/src/lib/drawer-resize.ts`

**Purpose:** Internal directive applied by `MlvDrawer` to `div.mlv-drawer__handle` when `resizable=true`. Handles pointer-capture drag, velocity measurement, snap-point selection, spring animation, and keyboard resize. Not intended for direct external use.

**Inputs:**

| Name         | Type                | Required | Description                                              |
| ------------ | ------------------- | -------- | -------------------------------------------------------- |
| `position`   | `MlvDrawerPosition` | Yes      | Drawer edge — determines drag axis and dismiss direction |
| `snapPoints` | `number[]`          | No       | Sorted viewport-percentage snap points                   |

**Outputs:**

| Name        | Description                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `dismissed` | Emitted when velocity threshold is exceeded (swipe-to-dismiss) or keyboard navigates to zero size |

**Keyboard support:**

| Key                         | Action                                           |
| --------------------------- | ------------------------------------------------ |
| `Arrow Up` / `Arrow Right`  | Increase size by 10% of viewport                 |
| `Arrow Down` / `Arrow Left` | Decrease size by 10% (or dismiss if at zero)     |
| `Home`                      | Snap to smallest snap point (or dismiss if zero) |
| `End`                       | Snap to largest snap point (or full viewport)    |
| `Escape`                    | Dismiss (close the drawer)                       |

**ARIA attributes:** `role="separator"`, `tabindex="0"`, `aria-label="Resize panel"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`.

---

## Services

### `MlvDrawerService`

**File:** `libs/core/drawer/src/lib/drawer.service.ts`

**Provided in:** `'root'`

**Purpose:** Programmatically opens any Angular component inside a drawer overlay without needing a host template.

**Extends:** `MlvOverlayServiceBase<MlvDrawerConfig, MlvDrawerRef>` from `@malva-ui/cdk/overlay` — the shared `open()` flow (overlay creation, child injector, component-portal attach, `role="dialog"`/`aria-modal`, focus trap, enter animation, backdrop/Escape close) is inherited. `MlvDrawerService` supplies the edge position strategy, backdrop class, `MlvDrawerRef` construction, `MlvDrawerRef`/`DRAWER_DATA` providers, and panel decoration (shell classes, hidden-transform var, width/height).

**Methods:**

```ts
open<T>(component: Type<T>, config?: MlvDrawerConfig): MlvDrawerRef
```

- Creates a CDK `OverlayRef` positioned at the specified edge.
- Creates a child `Injector` providing `MlvDrawerRef` and `DRAWER_DATA`.
- Attaches the component via `ComponentPortal`.
- Animates the backdrop on open.
- Wires up backdrop-click and Escape key to `drawerRef.close()` (unless disabled by config).
- Returns the `MlvDrawerRef` to the caller.

**`MlvDrawerConfig` interface:**

| Property            | Type                     | Default   | Description                                                                       |
| ------------------- | ------------------------ | --------- | --------------------------------------------------------------------------------- |
| `position`          | `MlvDrawerPosition`      | `'right'` | Edge the drawer slides from                                                       |
| `size`              | `string`                 | —         | CSS width or height of the panel                                                  |
| `maxSize`           | `string`                 | —         | Max-size ceiling for the sizing axis; always additionally clamped to the viewport |
| `initialFocus`      | `MlvOverlayInitialFocus` | `'auto'`  | Inherited from `MlvBaseOverlayConfig`                                             |
| `data`              | `unknown`                | —         | Arbitrary data injected as `DRAWER_DATA`                                          |
| `closeOnBackdrop`   | `boolean`                | `true`    | Clicking backdrop closes the drawer                                               |
| `closeOnEscape`     | `boolean`                | `true`    | Pressing Escape closes the drawer                                                 |
| `animationDuration` | `number`                 | `300`     | Animation duration in milliseconds                                                |
| `resizable`         | `boolean`                | `false`   | Renders a drag handle for resize / swipe-to-dismiss                               |
| `snapPoints`        | `number[]`               | `[]`      | Viewport-percentage snap points (0–100)                                           |
| `defaultSnap`       | `number`                 | `100`     | Initial open snap point percentage                                                |

**Injection token:** `DRAWER_DATA` — an `InjectionToken<unknown>`. Inject with `inject(DRAWER_DATA)` in the opened component to receive `config.data`.

---

### `MlvDrawerRef<R>`

**File:** `libs/core/drawer/src/lib/drawer-ref.ts`

**Purpose:** Reference object for an imperatively opened drawer. Handles the close animation and exposes observables for lifecycle hooks.

**Extends `MlvOverlayRef<R>` from `@malva-ui/cdk/overlay`** — `close()`/`afterClosed()`/`beforeClose()` and the `animationend`-with-fallback disposal are inherited. `MlvDrawerRef` supplies the drawer class names (`mlv-drawer-backdrop--leaving`, `mlv-drawer--leave`) and the `350 ms` leave fallback, and keeps its `constructor(overlayRef, position = 'right', animationDuration = 300)` signature.

**Methods:**

```ts
close(result?: R): void
```

Starts the leave animation on both the backdrop and the panel element, then disposes the overlay after `animationDuration` ms and emits the result.

```ts
afterClosed(): Observable<R | undefined>
```

Emits once after the overlay is destroyed and the result (if any) is provided.

```ts
beforeClose(): Observable<void>
```

Emits and completes synchronously when `close()` is called, before the animation starts.

---

### `MlvDrawerSectionsService`

**File:** `libs/core/drawer/src/lib/drawer-sections.service.ts`

**Provided in:** Component-scope on `MlvDrawer` (not `'root'`).

**Purpose:** Tracks registered `MlvDrawerSection` instances and uses `IntersectionObserver` to determine which section has the highest intersection ratio (i.e., the "current" section). Used by `MlvDrawerSections` to power the navigation.

**Signals:**

| Signal                   | Type                                                   | Description                                            |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------ |
| `sections`               | `Signal<Map<string, MlvDrawerSectionState>>`           | All registered sections keyed by id                    |
| `intersectedSections`    | `Signal<Record<string, MlvDrawerSectionIntersection>>` | Latest intersection data per section id                |
| `currentScrolledSection` | `Signal<MlvDrawerSectionState \| null>`                | Computed — section with the highest intersection ratio |
| `normalizedSections`     | `Signal<MlvDrawerSectionState[]>`                      | Computed array of all sections                         |

**Methods:**

```ts
register(section: MlvDrawerSectionState): void
unregister(section: MlvDrawerSectionState): void
initObservers(): void   // Reinitializes IntersectionObserver after sections change
destroyObservers(): void
```

`register`/`unregister` store a **new** `Map` rather than mutating the existing
one. Signals compare with `Object.is`, so returning the same reference from
`update()` was not a change: `normalizedSections` (and the observer effect that
tracks it) could stay frozen at whatever the computed happened to see on its
first read.

`initObservers()` is driven by an **`afterRenderEffect`**, not a constructor
`effect`. A plain `effect` runs during server-side change detection, so
`new IntersectionObserver(...)` threw `ReferenceError` the moment the service
was constructed on a server — Node defines no `IntersectionObserver`. Render
hooks never run on the server, which removes the failure instead of guarding
each construction site. The effect still reads `normalizedSections()` for its
dependency, so the observer is re-initialised as sections register and
unregister. Server rendering therefore produces the section markup with no
scroll tracking, and tracking starts on the first browser render.

**Interfaces exported:**

```ts
interface MlvDrawerSectionState {
  id: Signal<string>;
  label: Signal<string>;
  elementRef: ElementRef;
}
interface MlvDrawerSectionConfig {
  id: string;
  label: string;
  element: ElementRef;
}
interface MlvDrawerSectionIntersection {
  intersecting: boolean;
  threshold: number;
  id: string;
}
```

---

## Usage Examples

### Template-based drawer

```ts
import { MlvDrawer, MlvDrawerContent, MlvDrawerHeader, DrawerBodyDirective, MlvDrawerFooter } from '@malva-ui/core/drawer';

@Component({
  imports: [MlvDrawer, MlvDrawerContent, MlvDrawerHeader, DrawerBodyDirective, MlvDrawerFooter],
  template: `
    <button (click)="drawer.open()">Open Drawer</button>

    <mlv-drawer #drawer position="right" size="400px">
      <ng-template mlvDrawerContent>
        <div mlvDrawerHeader>My Title</div>
        <div mlvDrawerBody>Content here</div>
        <div mlvDrawerFooter>Footer actions</div>
      </ng-template>
    </mlv-drawer>
  `,
})
export class MyComponent {}
```

### Two-way binding on `opened`

```html
<mlv-drawer [(opened)]="isOpen" (afterClosed)="onClosed()">
  <ng-template mlvDrawerContent>...</ng-template>
</mlv-drawer>
```

### Service-based drawer

```ts
import { MlvDrawerService, MlvDrawerRef, DRAWER_DATA, MlvDrawerConfig } from '@malva-ui/core/drawer';

// In the host component
@Component({ ... })
export class HostComponent {
  private drawerService = inject(MlvDrawerService);

  openDetails() {
    const ref: MlvDrawerRef<boolean> = this.drawerService.open(DetailsDrawerComponent, {
      position: 'right',
      size: '500px',
      data: { id: 42 },
    });
    ref.afterClosed().subscribe(result => console.log(result));
  }
}

// In the dynamically opened component
@Component({ template: `<button (click)="close()">Close</button>` })
export class DetailsDrawerComponent {
  private ref = inject(MlvDrawerRef);
  data = inject(DRAWER_DATA); // { id: 42 }

  close() { this.ref.close(true); }
}
```

### Bottom sheet (resizable bottom drawer)

```html
<mlv-drawer [(opened)]="isOpen" position="bottom" resizable [snapPoints]="[40, 80, 100]" [defaultSnap]="80">
  <ng-template mlvDrawerContent>
    <div mlvDrawerHeader>Share item</div>
    <div mlvDrawerBody>...</div>
  </ng-template>
</mlv-drawer>
```

### Route-driven drawer via `mlvGenerateRoutableDrawerRoute()`

Define a route that opens a component in a drawer on activation:

```ts
// routes.ts
import type { Routes } from '@angular/router';
import { mlvGenerateRoutableDrawerRoute } from '@malva-ui/core/drawer';

export default [
  {
    path: 'users',
    component: UsersListPage,
    children: [
      mlvGenerateRoutableDrawerRoute(() => import('./user-details.component'), { path: ':id', position: 'right', size: '500px' }),
      // With guards and resolvers
      {
        ...mlvGenerateRoutableDrawerRoute(() => import('./edit.component'), {
          path: ':id/edit',
          size: '600px',
        }),
        canDeactivate: [unsavedChangesGuard],
        resolve: { user: userResolver },
      },
    ],
  },
] satisfies Routes;
```

The opened component can inject `MlvDrawerRef` to close itself and `ActivatedRoute` for route params:

```ts
@Component({ template: `<button (click)="close()">Close</button>` })
export default class UserDetailsComponent {
  private readonly ref = inject(MlvDrawerRef);
  private readonly route = inject(ActivatedRoute);

  close(): void {
    this.ref.close();
  }
}
```

---

### Sections navigation

```html
<mlv-drawer #drawer position="right" size="600px">
  <ng-template mlvDrawerContent>
    <div mlvDrawerHeader>
      <mlv-drawer-sections />
    </div>
    <div mlvDrawerBody>
      <section mlvDrawerSection label="General">...</section>
      <section mlvDrawerSection label="Advanced">...</section>
    </div>
  </ng-template>
</mlv-drawer>
```

---

## Dependencies

| Package                       | Usage                                                                                                                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@angular/cdk/overlay`        | Overlay creation and positioning                                                                                                                                                                                                                |
| `@angular/cdk/portal`         | `TemplatePortal`, `ComponentPortal`                                                                                                                                                                                                             |
| `@angular/cdk/a11y`           | `cdkTrapFocus` focus trap                                                                                                                                                                                                                       |
| `@malva-ui/cdk/overlay`       | `MlvOverlayHostBase` (extended by `MlvDrawer`), `MlvOverlayServiceBase` (extended by `MlvDrawerService`), `MlvOverlayRef` (extended by `MlvDrawerRef`), `MlvBaseOverlayConfig` (extended by `MlvDrawerConfig`) — shared modal-overlay lifecycle |
| `@angular/cdk/coercion`       | `BooleanInput`, `coerceBooleanProperty` for `resizable` input                                                                                                                                                                                   |
| `rxjs`                        | `fromEvent`, `switchMap`, `takeUntil` in `MlvDrawerResize`                                                                                                                                                                                      |
| `@malva-ui/core/popup`        | Used by `MlvDrawerSections` for section navigation popup                                                                                                                                                                                        |
| `@malva-ui/core/button`       | Used by `MlvDrawerSections` for the trigger button                                                                                                                                                                                              |
| `@malva-ui/core/list`         | Used by `MlvDrawerSections` for the section list                                                                                                                                                                                                |
| `@malva-ui/core/scrollbar`    | `MlvScrollbar` used by `[mlvDrawerBody]` for themed drawer-body scrolling                                                                                                                                                                       |
| `@malva-ui/cdk/accessibility` | `MlvClick` used by `MlvDrawerSections`                                                                                                                                                                                                          |
| `@lucide/angular`             | Chevron icon in `MlvDrawerSections`                                                                                                                                                                                                             |
| `lodash-es`                   | `cloneDeep`, `sortBy` in `MlvDrawerSectionsService`                                                                                                                                                                                             |
| `uuid`                        | Auto-generated section IDs in `MlvDrawerSection`                                                                                                                                                                                                |
