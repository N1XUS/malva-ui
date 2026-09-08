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
| `MlvDrawerHeader`                | Component                 | Header row: title, projected controls, `mlv-button-close` — `mlv-drawer-header` or `[mlvDrawerHeader]`                   |
| `MlvDrawerTitleLevel`            | Type alias                | `1 \| 2 \| 3 \| 4 \| 5 \| 6` — heading level of the header's `title` input                                               |
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

| Name                   | Type                       | Default   | Description                                                                                                                                                                                                                                                                                      |
| ---------------------- | -------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `opened`               | `model<boolean>`           | `false`   | Two-way bindable; `true` opens the drawer, `false` closes it                                                                                                                                                                                                                                     |
| `position`             | `input<MlvDrawerPosition>` | `'right'` | Which edge of the viewport the drawer slides from                                                                                                                                                                                                                                                |
| `size`                 | `input<string>`            | `'300px'` | Width (left/right) or height (top/bottom) of the panel; used as initial size when `resizable=false`                                                                                                                                                                                              |
| `hasBackdrop`          | `input<boolean>`           | `true`    | Whether a dim backdrop is shown behind the drawer                                                                                                                                                                                                                                                |
| `closeOnBackdropClick` | `input<boolean>`           | `true`    | Whether clicking the backdrop closes the drawer                                                                                                                                                                                                                                                  |
| `closeOnEscape`        | `input<boolean>`           | `true`    | Whether pressing Escape closes the drawer                                                                                                                                                                                                                                                        |
| `restoreFocus`         | `input<boolean>`           | `true`    | Inherited coerced boolean. Restores the connected pre-open focus target after disposal; composed owners can disable it.                                                                                                                                                                          |
| `resizable`            | `input<boolean>`           | `false`   | When true, renders a drag handle; enables drag-to-resize and swipe-to-dismiss                                                                                                                                                                                                                    |
| `snapPoints`           | `input<number[]>`          | `[]`      | Sorted viewport-percentage snap points (0–100); panel snaps to nearest after drag. Empty = free resize                                                                                                                                                                                           |
| `defaultSnap`          | `input<number>`            | `100`     | Initial snap point percentage applied when the drawer opens (only when `resizable=true`)                                                                                                                                                                                                         |
| `minSize`              | `input<string>`            | `'0px'`   | CSS min-size floor for the sizing axis, bound as `min-width` / `min-height` so a drag resize can never shrink the panel below it. Honoured on the fixed-`size` path too, and clamped to the viewport like `maxSize` (`min-*` beats `max-*`, so an unclamped floor would undo the viewport clamp) |
| `maxSize`              | `input<string>`            | `'100%'`  | CSS max-size ceiling for the sizing axis. Honoured **whether or not** `resizable` is set, and always additionally clamped to the viewport                                                                                                                                                        |
| `initialFocus`         | `MlvOverlayInitialFocus`   | `'auto'`  | Inherited from `MlvOverlayHostBase`. `'auto'` skips the close button and the body scroll viewport — see [libs-overlay.md](libs-overlay.md)                                                                                                                                                       |
| `ariaLabel`            | `input<string>`            | —         | Accessible name for the `role="dialog"` surface. Used as `aria-label` when `ariaLabelledBy` is unset.                                                                                                                                                                                            |
| `ariaLabelledBy`       | `input<string>`            | —         | Id of a visible element that labels the drawer. Overrides the title `mlv-drawer-header` registers, `ariaLabel` and the i18n fallback via `aria-labelledby`.                                                                                                                                      |

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

1. `ariaLabelledBy` input → bound to `aria-labelledby` (any visible label).
   Suppresses `aria-label`.
2. `ariaLabel` input → bound to `aria-label`. Also suppresses the header title
   below — a consumer naming the drawer by hand wins over the automatic label.
3. The rendered title of a projected `mlv-drawer-header` → `aria-labelledby`.
   The header registers its title id through the internal `_labelBy(id)` /
   `_unlabelBy(id)` pair while the title has text (`_headerLabelIds`, joined
   with spaces when a drawer renders more than one header), so an asynchronous
   title still names the drawer and an empty one never leaves an empty name.
4. i18n fallback → `MLV_DRAWER_I18N.drawer` ("Drawer") via the `_resolvedAriaLabel`
   computed, so the drawer panel always has an accessible name even when nothing is set.

`_resolvedAriaLabelledBy` resolves steps 1–3 and `_resolvedAriaLabel` is null
whenever it resolves, so the two naming methods never conflict. Service-opened
drawers get step 3 through `MlvDrawerRef._labelBy` / `_unlabelBy`, which write
`aria-labelledby` onto the overlay pane, and step 4 through `MlvDrawerService`,
which writes the i18n `drawer` string as `aria-label` on the pane at open. The
ref parks that `aria-label` while a title is registered and puts it back when
the last title withdraws, so the pane is never nameless and the two attributes
never coexist. (`MlvDrawerConfig` has no `ariaLabel`; the header title is the
way to name a service-opened drawer.)

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

| Name    | Type                       | Required                         | Default                           | Description                                                      |
| ------- | -------------------------- | -------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `label` | `input.required<string>()` | Yes                              | —                                 | Section heading text                                             |
| `id`    | `input<string>()`          | **Yes, in practice** — see below | `mlvNextId('mlv-drawer-section')` | Section key. Must be written as a **static `id="…"` attribute**. |

**`id` must be a static attribute, not a binding.** `MlvDrawerSectionsService`
keys `sections` by the **input** (`section.id()`) and `intersectedSections` by
the **DOM attribute** (`entry.target.id`), and `currentScrolledSection()` looks
one up in the other — so they only meet when the element actually carries a
matching `id` attribute. A static `id="meta"` is simultaneously a DOM attribute
and a static input binding, which is why it is the only shape that works and
what all 11 in-repo consumers ship:

```html
<section mlvDrawerSection id="meta" label="Meta">…</section>
```

`[id]="'meta'"` binds the **input only** — a property binding is consumed by the
directive input and writes no attribute — and omitting `id` leaves the default
`mlvNextId(...)` in the input with an empty `entry.target.id` on the element.
Either way the lookup misses, `currentScrolledSection()` stays `null`, and the
`mlv-drawer-sections` trigger renders with no text — an unnamed button, a WCAG
4.1.2 failure. Writing the attribute from the directive host instead
(`host: { '[attr.id]': 'id()' }`) would change emitted DOM for every consumer
and is deliberately not done here; it is the #223 follow-up.

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
      <mlv-list-item itemRole="menuitem" [hostRole]="'menuitem'" (mlvClick)="navigateToSection(section.elementRef)">{{ section.label() }}</mlv-list-item>
      }
    </mlv-list>
  </ng-template>
</mlv-popup>
```

The section-navigation popover is a **menu**: the trigger button advertises `aria-haspopup="menu"` (via `MlvPopupTrigger`'s `ariaHasPopup` input), the wrapping `mlv-popup` stays roleless, and the semantic role lives on the projected content — `mlv-list` gets `[listRole]="'menu'"` and each `mlv-list-item` its `menuitem` role.

Each row writes that role **twice**, and both are load-bearing (#223).
`MlvListItem.itemRole` and `MlvClick.hostRole` are both host `[attr.role]`
bindings on the same element. Neither has a fixed precedence: each is
dirty-checked against its own previous value and writes only on a pass where
that value changed, and the directive's bindings run after the component's — so
`MlvClick` wins a same-pass **tie**. First render is always a tie, so
`itemRole="menuitem"` on its own resolved to `role="button"` and axe raised
`aria-required-children` on the `role="menu"` list. `[hostRole]="null"` is
**not** the fix — a `null` host binding removes the attribute rather than
deferring to `itemRole`, leaving the row roleless and the violation standing.
Writing `menuitem` through both is what makes the row correct regardless of
which binding writes last, here and on any later pass. Pinned by
`drawer-sections.spec.ts` (resolved `role`, `tabindex`, Enter activation and a
full axe sweep of the open menu); the ordering contract itself is pinned by
`click.spec.ts`, whose fourth row changes the component's role after first
render and shows the component winning.

The trigger opens on `['hover', 'click']`, not on hover alone.
`MlvPopupTrigger.onClick()` gates on `hasTrigger('click')`, so a hover-only
trigger was a no-op for every keyboard path and the menu could only be reached
with a pointer (WCAG 2.1.1, level A). The trigger is a real `<button>`, so
`click` is also its Enter/Space activation. `focus` is deliberately excluded:
its `blur` half would close the panel the moment focus moved toward the rows.
The rows are plain `tabindex="0"` tab stops rather than the roving-tabindex
WAI-ARIA menu model — see the follow-up note under _Known gaps_ below.

**Public methods:**

- `navigateToSection(section: ElementRef): void` — Smooth-scrolls `.mlv-drawer__body` to the target element with an 80 px top offset.

**Dependencies:** `@malva-ui/core/popup`, `@malva-ui/core/button`, `@malva-ui/core/list`, `@lucide/angular`, `@malva-ui/cdk/accessibility`.

**Known gaps (follow-up owed, #223):** the panel claims `role="menu"` but does
not implement the WAI-ARIA menu keyboard model. There is no roving tabindex, no
arrow-key / `Home` / `End` navigation between rows, no `Escape` back to the
trigger and no focus move into the panel on open — every row is an independent
`tabindex="0"` tab stop, and the portaled panel sits at the end of `<body>`, so
the tab order is wrong even though the menu is operable. `MlvMenuItem`
(`@malva-ui/core/menu`) already implements the correct model; rebuilding on it
adds a `core-drawer → core-menu` dependency and is out of scope for #223. axe
cannot detect any of this, so the sweep below being clean is not evidence
against it.

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

**Selector:** `mlv-drawer-header, [mlvDrawerHeader]`

**File:** `libs/core/drawer/src/lib/drawer-header.ts`

**Purpose:** The drawer's header row — the title, any projected controls and
the close button — rendered as one 36px control row. Use it as an element
(`<mlv-drawer-header title="…">`) or as an attribute on a container
(`<div mlvDrawerHeader>`); never on a heading — project the heading instead.

**Inputs:**

| Name         | Type                         | Default | Description                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------ | ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`      | `input<string>`              | —       | Plain-text title rendered as a heading with `class="mlv-drawer__title"` (level from `level`). Wins over a projected heading.                                                                                                                                                                                                                                                                |
| `level`      | `input<MlvDrawerTitleLevel>` | `2`     | Heading level (`1`–`6`) of the element the `title` input renders; `level="4"` (attribute) and `[level]="4"` both work, out-of-range falls back to `2`. Pass `4` above `[mlvDrawerSection]` headings (`<h5>`) so the outline skips no level. Ignored for a projected heading.                                                                                                                |
| `closable`   | `input<boolean>`             | `true`  | Whether the trailing `mlv-button-close` is rendered. Coerced, so `closable="false"` works. Also omitted when the header is rendered outside a drawer.                                                                                                                                                                                                                                       |
| `mlvDensity` | `MlvDensity` (host dir)      | —       | Density projected to the header's content through `MLV_DENSITY_CONTEXT`. Unset, the header **pins `compact`** (it does not inherit an app-wide density) so projected `mlvButton`s sit on the same 36px row as the close button. The context also reaches the `mlv-drawer-sections` popup (its content keeps the header's injector), so the section menu renders compact in any app density. |

**Template order is fixed:** title → `<ng-content>` → close.

- **Title.** `title` input → `<h{level}>` (`<h2>` by default; a `@switch`
  over `level`, one id across levels); otherwise a `div.mlv-drawer__title`
  wrapper that projects `h1`–`h6` or any element carrying a `mlvDrawerTitle`
  attribute (`<ng-content select="h1, h2, h3, h4, h5, h6, [mlvDrawerTitle]">`),
  so `<div mlvDrawerHeader><h4>Edit</h4>…</div>` keeps working and the heading
  level stays the consumer's. The wrapper is `display: none` while `:empty`.
  A projected heading takes the row's type (`font: inherit`, ui-l 16px medium);
  `[mlvTitle]` headings keep their own `data-level` size and are not intended
  here.
- **Accessible name.** The title element carries `id="mlv-drawer-title-<n>"`
  and is registered with the drawer (`MlvDrawer` in template mode, reached
  through the content template's declaration site; `MlvDrawerRef` in the
  service path) after every render while it has text. See the `MlvDrawer`
  accessible-name precedence above. A header with no title registers nothing.
  When **both** are in scope — a service drawer opened with an `injector`
  from inside a declarative drawer's content (a routable drawer from a drawer
  body), or a declarative drawer nested in a service-opened component — the
  ref owns the header only while its pane contains the header element
  (`MlvDrawerRef._paneElement`); otherwise the declarative drawer does. The
  owner is resolved lazily (after the portal has attached the host element)
  and cached, so `_unlabelBy` reaches the drawer `_labelBy` did.
- **Close.** `<mlv-button-close class="mlv-drawer__close" mlvDensity="comfortable" shape="circle" variant="transparent">`,
  labelled by `MLV_DRAWER_I18N.closeDrawer`, calling `close()` on the drawer
  or ref. Pinned at `comfortable` on purpose: `mlv-button-close` is one density
  step **below** `mlvButton` at every level (36 / 28 / 24 vs 44 / 36 / 28), so
  the close at its default and a compact `mlvButton` both resolve
  `--mlv-height-s` — the only pairing that puts the two flush. `mlv-drawer-sections`
  pins `mlvDensity="compact"` on its trigger for the same reason.
  **Optically hung:** the header and body share one inline padding, so the
  button box ends where a full-width field ends, but the visible X stops
  ~12px inside a transparent 36px circle. `.mlv-drawer__close > .mlv-button`
  therefore carries `margin-inline-end: calc((icon − height) / 2 − icon × 5/24)`
  from the button's own `--mlv-icon-font-size` / `--mlv-btn-height` (the 5/24
  is the blank rim inside Lucide's `x` path), so the strokes sit on the field
  edge and the hover halo overshoots into the padding instead.
- **Projected content** is where `mlv-drawer-sections`, an `mlv-spacer` and
  action buttons go. Without a spacer the close still sits at the inline end
  (`.mlv-drawer__close { margin-inline-start: auto }`).
- **Outside a drawer** (no `MlvDrawer` and no `MlvDrawerRef` resolvable) the
  header is a plain styled row: no close button, no label registration.

**Host bindings:** `class: 'mlv-drawer__header'`, `[attr.title]: null` (strips
the native `title` attribute the element form leaves behind). Host directive
`MlvDensityDirective` with the `mlvDensity` input; the header itself carries no
density modifier class.

**Styles (`drawer.scss`):** `.mlv-drawer__header` is a `gap: var(--mlv-spacing-2)`
flex row with `--mlv-padding-l` and a block-end hairline (61px with 36px
controls). `.mlv-drawer__title` truncates with an ellipsis.

**Side rail.** A resizable `left` / `right` drawer parks its handle in a
full-height 48px gutter at the inward edge: the handle is `position: absolute`
(`inset-block: 0; inline-size: 3rem`) and the panel reserves the gutter with
`padding-right` / `padding-left`. The sides are **physical** on purpose —
`MlvDrawerPosition` names a viewport edge — and carry `// physical:` comments.
(An in-flow `height: 100%` handle in the panel's flex column took a row of
its own and pushed the header below the panel.)

**Merged bottom-sheet band.** In `.mlv-drawer--bottom.mlv-drawer--resizable:has(> .mlv-drawer__header)`
the 48px drag handle is `position: absolute` across the top of the panel
(`.mlv-drawer` is `position: relative`), its pill at `--mlv-spacing-2` from
the edge, and the header lifts its content with
`padding-block-start: var(--mlv-spacing-5)` — one 69px band instead of a 48px
strip stacked on a 69px header. The header is `pointer-events: none` with
`> * { pointer-events: auto }` (and the title back to `none`), so its empty
space falls through to the handle while controls keep their hit areas. A sheet
without a header keeps the in-flow handle. `:has()` is Baseline 2023; where it
is unsupported (Firefox < 121) the four merged-band rules drop and the sheet
degrades to the stacked 48px strip above the header.

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

`.mlv-drawer__body` is `overflow: clip`, not `hidden`. A hidden-overflow box is
still a scroll container that `focus()`, `scrollIntoView()` and `:target` move
silently; the viewport inside is the only scroller the body may have. The case
that forced it: a visually-hidden native input (switch / checkbox / radio /
file-upload) whose containing block was the scrollbar host outside the viewport
scrolled the body ~2000px on a click — content gone, viewport unmoved. Those
controls now position themselves (`position: relative` on the block) so the
input stays inside them; `clip` is the drawer's own guarantee that no other
descendant can do the same.

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

`aria-valuenow` is backed by a signal (`_currentPercent`) — the pointer path
writes it from a `fromEvent` listener, which schedules no change detection
under zoneless, so a plain field left the attribute stale after a drag. After a
free-resize gesture (no snap points) and after every key step the value is
re-read from the rendered box (`_syncPercentToBox`), so a `minSize` / `maxSize`
clamp is what gets announced rather than the size that was asked for; the raw
request still lives in `--mlv-drawer-current-size`. A zero-sized box (no
layout) leaves the value alone.

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
        <!-- title names the drawer; the close button is built in -->
        <mlv-drawer-header title="My Title" />
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
    <mlv-drawer-header title="Share item" />
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
    <mlv-drawer-header title="Settings">
      <mlv-drawer-sections />
      <mlv-spacer />
      <button mlvButton type="submit" form="settings-form">Save</button>
    </mlv-drawer-header>
    <div mlvDrawerBody>
      <section mlvDrawerSection label="General">...</section>
      <section mlvDrawerSection label="Advanced">...</section>
    </div>
  </ng-template>
</mlv-drawer>
```

---

## Direction (RTL)

- **Scoped, not per-document.** `MlvDrawerResize`'s `_onKeydown` passes a cached `elementDirection(host)` signal to `MlvRtlService.normalizeArrowKey(event, direction)` — the handle lives inside the drawer pane, so host and pane agree by construction. A drawer inside a `[dir="rtl"]` subtree therefore mirrors its resize stepping while the document stays LTR, and an LTR island under an RTL document does not.
- The same host feeds the pointer maths, so the keyboard and geometry halves of the resize cannot disagree.
- A bottom-sheet drawer resizes on the block axis and never mirrors. `Home` / `End` mean first / last in both directions.
- Regressions in `drawer.spec.ts`.

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
