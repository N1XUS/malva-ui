# Library: overlay (`@malva-ui/cdk/overlay`)

> **Keep this file up to date.** Always update this file whenever you change the shared overlay abstractions, their public API, packaging, or dependency wiring.

## Overview

`@malva-ui/cdk/overlay` is a headless CDK leaf library that provides the shared,
surface-agnostic building blocks for template-based and imperative modal
overlays (today: the drawer), plus the initial-focus strategy every Malva
overlay shares.

It contains **no components with selectors** — only abstract base classes that
concrete surfaces extend. `MlvDrawer`, `MlvDrawerService`, and `MlvDrawerRef`
build on these bases. The shared service base deliberately attaches component
portals only; surface-level services may normalize richer public content APIs
first, and may render the opened component inside a surface component of their
own through the `_attachContent` hook (`MlvDrawerService` renders the same
panel component `<mlv-drawer>` does, #305).

**The dialog no longer extends these bases.** `@malva-ui/core/dialog` was
rebuilt on `@angular/cdk/dialog` (see
[docs/migrations/2026-08-dialog-composition.md](../../docs/migrations/2026-08-dialog-composition.md))
and now consumes exactly two exports from this library —
`MlvOverlayInitialFocusResolver` and `MlvOverlayInitialFocus` — so `'auto'`
focus behaves identically on both surfaces.

It is registered as a secondary entry point of the `@malva-ui/cdk` package
(alongside `accessibility`, `density`, `infinite-scroll`, `utils`) and is
re-exported from `@malva-ui/cdk`.

## Public API

Exported from `libs/cdk/overlay/src/index.ts`:

| Export                                    | Kind                          | Description                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MlvOverlayHostBase`                      | Abstract `@Directive()` class | Base for template-based overlay host **components** (drawer). Owns the `opened` model, `hasBackdrop`/`closeOnBackdropClick`/`closeOnEscape`/`restoreFocus` inputs, `afterOpened`/`afterClosed` outputs, `animationState` signal, the open/close `effect()`, optional focus restoration, and overlay create/destroy lifecycle. |
| `MlvOverlayServiceBase<TConfig, TRef>`    | Abstract class                | Base for imperative overlay **services** (drawer). Owns the component-portal `open()` flow: overlay creation, child injector, modal semantics, focus trap/restore, enter animation, and backdrop/Escape close wiring.                                                                                                         |
| `MlvOverlayRef<R>`                        | Abstract class                | Base for imperative overlay **references** (drawer). Owns idempotent `close()`/`afterClosed()`/`beforeClose()`, leave animation, and `animationend`-with-fallback disposal.                                                                                                                                                   |
| `MlvBaseOverlayConfig`                    | Interface                     | Shared config fields (`data`, `closeOnBackdrop`, `closeOnEscape`, `injector`, `initialFocus`, `direction`), extended by `MlvDrawerConfig`.                                                                                                                                                                                    |
| `MlvOverlayAnimationState`                | Type alias                    | `'enter' \| 'leave' \| 'idle'` — the `animationState` signal's value type.                                                                                                                                                                                                                                                    |
| `MlvOverlayInitialFocus`                  | Type alias                    | `'auto' \| 'container' \| 'first-tabbable' \| HTMLElement \| string` (any other string is a CSS selector).                                                                                                                                                                                                                    |
| `MlvOverlayInitialFocusResolver`          | Service (`providedIn: root`)  | Resolves and applies an overlay's initial focus target. Shared by the drawer host, the imperative services, and the dialog's CDK container.                                                                                                                                                                                   |
| `MLV_OVERLAY_AUTOFOCUS_SELECTOR`          | `const string`                | `'[mlvAutofocus]'` — the opt-in `'auto'` wins on. Matched by attribute so the CDK layer needs no dependency on `@malva-ui/cdk/utils`.                                                                                                                                                                                         |
| `MLV_OVERLAY_INITIAL_FOCUS_SKIP_SELECTOR` | `const string`                | Elements `'auto'` refuses to focus: `.mlv-button-close`, `.mlv-button--close`, `.mlv-scrollbar__viewport`, `[data-mlv-initial-focus-skip]`.                                                                                                                                                                                   |

## Initial focus

`MlvOverlayInitialFocusResolver` answers "what gets focus when this opens?" for
both the declarative and imperative paths, replacing the CDK focus trap's
auto-capture (which always took the first tabbable node — the drawer's close
button, or the dialog body's scroll viewport).

| Value              | Resolves to                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `'auto'` (default) | `[mlvAutofocus]` if projected → first tabbable **not** matching the skip selector → the container.                    |
| `'container'`      | The container. `focus()` stamps `tabindex="-1"` first when the element has none, so the call is not silently a no-op. |
| `'first-tabbable'` | First tabbable in DOM order, nothing skipped.                                                                         |
| `HTMLElement`      | That element.                                                                                                         |
| other `string`     | `container.querySelector(value)`.                                                                                     |

The skip selector is matched **per element**, never with `closest()` — a skipped
node's descendants stay candidates, which is the whole point for the scroll
viewport whose children are the form controls that should get focus.

Tabbability is tested with `InteractivityChecker` under
`{ ignoreVisibility: true }` plus an own declared-state hidden check
(`hidden`/`aria-hidden`/`inert`/computed `display`/`visibility`): the CDK's
visibility test is geometric, and an overlay is measured before its first paint
— and never at all under jsdom.

Both hosts apply focus from `afterNextRender`, because `attach()` only creates
the view: `@if`-guarded content does not exist in the DOM until change
detection has run.

## Direction on the portaled pane

Every overlay created by these bases passes `direction` on the CDK overlay
config, resolved through `MlvRtlService.resolveDirection()`:

- `MlvOverlayHostBase` — from the component host (`_vcr.element`).
- `MlvOverlayServiceBase` — from the element focused when `open()` was called
  (the trigger, in practice), overridable via `MlvBaseOverlayConfig.direction`.

This is required, not cosmetic: the pane is portaled to the overlay container on
`<body>`, so it never inherits a `[dir]` scope its trigger sits in. The config
value also drives `start`/`end` mirroring inside the position strategy.

## Abstract members subclasses implement

### `MlvOverlayHostBase`

| Member                       | Kind                               | Purpose                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_backdropClass`             | abstract readonly `string`         | Backdrop base class; `{class}--leaving` is added on close.                                                                                                                                                                                                                                                   |
| `_getOverlayTemplate()`      | abstract                           | Returns the `TemplateRef` to attach (usually a `viewChild` template).                                                                                                                                                                                                                                        |
| `_buildPositionStrategy()`   | abstract                           | Builds the CDK `PositionStrategy`.                                                                                                                                                                                                                                                                           |
| `_buildExtraOverlayConfig()` | overridable (default `{}`)         | Extra `OverlayConfig` merged in (size, panel class — e.g. `mlv-search-field`'s full-viewport pane).                                                                                                                                                                                                          |
| `_leaveFallbackMs`           | overridable `number` (default 350) | Fallback delay after which a pending leave is force-completed when the panel's `animationend` never fires (`prefers-reduced-motion` strips the animation; hidden tabs throttle it). Armed by `_startLeaveAnimation()`, cleared on disposal. Mirrors `MlvOverlayRef._leaveFallbackMs` on the imperative path. |
| `_getFocusContainer()`       | overridable                        | The element initial focus is resolved against. Defaults to the pane's `[role="dialog"]` descendant, falling back to the pane itself.                                                                                                                                                                         |

Provided by the base (inherited public API): `opened` (`model`), `hasBackdrop`,
`closeOnBackdropClick`, `closeOnEscape`, `restoreFocus` (coerced boolean,
default `true`), `initialFocus` (inputs), `afterOpened`, `afterClosed` (outputs),
`animationState` (signal), `open()`, `close()`,
`onAnimationEnd()`, `ngOnDestroy()`, and the protected `_overlay`, `_vcr`,
`_injector`, `_initialFocusResolver`, `_overlayRef`, `_triggerElement` members
plus `_createOverlay()`/`_startLeaveAnimation()`/`_destroyOverlay()` and the
template-facing `_onPanelAnimationEnd(event)`.

#### The panel's `animationend` is target-guarded

A subclass template binds `(animationend)="_onPanelAnimationEnd($event)"` on the
element that plays its enter/leave keyframes — **not** `onAnimationEnd()`.
`animationend` bubbles, so a descendant finishing a finite CSS animation inside
the leave window reaches the panel's listener too; bound raw, `onAnimationEnd()`
called `_destroyOverlay()` on it — disposing the overlay mid-animation, restoring
focus early and emitting `afterClosed` before the leave had played. Same defect
#231 fixed in `mlv-popup`, one layer down. Reachable with Malva's own
components, not only consumer content: `mlv-message` (rendered by `mlv-input`,
`mlv-select`, `mlv-combobox`) plays a finite `mlv-slide-down` over
`--mlv-duration-normal` via `animate.enter`, `mlv-expand` a finite
`--mlv-duration-slow` expand/collapse, and a drawer body or search overlay holds
arbitrary consumer content besides. Only the `infinite` animations
(`mlv-loader`, `mlv-skeleton`, `mlv-status-indicator`) never fire
`animationend`.

- `_onPanelAnimationEnd` admits the event only when `event.target ===
event.currentTarget` — exactly the bound element's own keyframes. It reads
  `currentTarget` synchronously inside the dispatch, where it is still set.
- **Do not delete the guard as redundant, and do not move it into
  `onAnimationEnd()`.** `onAnimationEnd()` has a second, event-less caller: the
  leave fallback timer `_startLeaveAnimation()` arms, which force-completes a
  leave whose `animationend` never came (reduced motion, a throttled background
  tab). Filtering inside it would silently disable that path. Hence two
  methods, one filtered and one not — the same split as `MlvPopup` (see
  `.claude/projects/libs-popup.md` § _The panel's `animationend` is
  target-guarded_) and the same comparison as `MlvDialog._onAnimationEnd`.
- The guard only works if the keyframes run **on the bound element**. Both
  in-repo subclasses satisfy that: `mlv-drawer--leave` is on `.mlv-drawer`,
  `mlv-search-field__overlay--leaving` on `.mlv-search-field__overlay`. A
  subclass whose leave animation plays on a _child_ of the bound element would
  fall through to the fallback timer — bind the listener on the animated
  element instead.
- **Consumer subclasses see no change until they opt in.** `onAnimationEnd()`
  keeps its name, signature and behaviour, so a subclass template binding it raw
  keeps the unguarded behaviour; rebinding to `_onPanelAnimationEnd($event)` is
  the fix. `_onPanelAnimationEnd` is `_`-prefixed, so `VERSIONING.md` §2 does not
  count it as public — the same standing as the `_backdropClass` /
  `_getOverlayTemplate()` / `_buildPositionStrategy()` members every subclass
  already has to implement. A subclass declaring its own member of that name now
  collides with it. `VERSIONING.md` contradicts itself on the standing of
  `_`-prefixed abstract members — tracked in #279.
- Pinned in `overlay.spec.ts` (`MlvOverlayHostBase › animationend target`),
  whose test host binds the guarded handler too — on the raw handler the base's
  own suite would exercise a path no shipped subclass takes.

`restoreFocus=true` preserves the default declarative-overlay behavior: after
leave disposal, focus returns to the connected element active before open.
Composed controls that own a larger logical focus lifecycle may set it to
`false`; disposal then leaves focus untouched. Reopening while leave is pending
cancels the fallback and leave state so the attached overlay remains rendered.

### `MlvOverlayServiceBase<TConfig, TRef>`

| Member                                                         | Kind                       | Purpose                                                                                                                                                    |
| -------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_enterAnimationClass`                                         | abstract readonly `string` | Panel enter class; added then removed on the surface's **own** `animationend` (target-guarded, see below).                                                 |
| `_buildPositionStrategy(config)`                               | abstract                   | Builds the CDK `PositionStrategy`.                                                                                                                         |
| `_buildOverlayConfig(config)`                                  | abstract                   | Surface `OverlayConfig` (backdrop class, panel class, size).                                                                                               |
| `_createRef(overlayRef, config)`                               | abstract                   | Constructs the concrete `TRef`.                                                                                                                            |
| `_createProviders(ref, config)`                                | abstract                   | Surface-specific static providers for the opened component's child injector (for example ref, data, and config tokens).                                    |
| `_decoratePanel(panelEl, config)`                              | abstract                   | Applies surface classes/styles to the dialog surface (`panelEl` is what `_attachContent` returned).                                                        |
| `_attachContent(overlayRef, component, injector, ref, config)` | overridable                | Attaches the content and returns the **dialog surface**. Default: `ComponentPortal` straight into the pane, `_applyContentLayout(host)`, returns the pane. |
| `_applyContentLayout(hostEl)`                                  | protected helper           | Makes the opened component's host a flex pass-through (`display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0`).                            |

**The dialog surface.** `open()` applies `role="dialog"`, `aria-modal`,
`tabindex="-1"`, `_decoratePanel()`, the focus trap, the initial focus and
the enter class to whatever `_attachContent` returns, and records it on the ref
as `_surfaceElement` (`null` when it is the pane) so `MlvOverlayRef` plays the
leave and waits for `animationend` on the **same** element. Override the hook
to render content inside a component of your own; the returned element must stay
inside the pane for the life of the overlay, and the hook runs synchronously
inside `open()`. Overridable rather than abstract, so no subclassing contract
grew a required member. Before #305 the pane was always the surface, which is
why a service-opened drawer rendered without the drawer component's stylesheet,
handle or sections provider.

`open<T>(component, config?)` is inherited and shared. It accepts an Angular
component type and defaults `config` to `{}`. Content polymorphism is a concrete
surface concern rather than part of this modal-lifecycle abstraction.

The service captures the focused element before creating the overlay, traps
focus in the dialog surface, resolves the initial focus target through
`MlvOverlayInitialFocusResolver` from `afterNextRender` (the trap's own
auto-capture is deliberately unused), destroys the trap after close, and
restores focus to that captured element. Concrete services remain responsible
for any additional accessible naming applied in `_decoratePanel()`.

The enter-class listener is **target-guarded** for the same reason as the
host's (see _The panel's `animationend` is target-guarded_): consumer content
finishing its own animation during the enter would otherwise strip the class
and cut the surface's enter short. It is **not** `once: true` any more — an
ignored descendant event would spend a one-shot listener and latch the enter
class for the life of the surface — so the handler removes itself on the
surface's own event. With a surface of its own the pane is an **ancestor**, so a
pane `animationend` never reaches the listener at all. `overlay.spec.ts` pins
both halves, for the default hook and for a surface override.

### `MlvOverlayRef<R>`

| Member                  | Kind                       | Purpose                                                                                                                                                           |
| ----------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_backdropLeavingClass` | abstract readonly `string` | Class added to the backdrop on close.                                                                                                                             |
| `_panelLeaveClass`      | abstract readonly `string` | Class added to the panel on close.                                                                                                                                |
| `_leaveFallbackMs`      | abstract readonly `number` | Fallback dispose delay when `animationend` never fires.                                                                                                           |
| `_surfaceElement`       | `@internal` field          | The dialog surface when it is not the pane; written once by `MlvOverlayServiceBase.open()`, cleared when the ref disposes the overlay.                            |
| `_panelElement`         | protected getter           | `null` once the pane is gone, else `_surfaceElement ?? overlayRef.overlayElement` — where the leave plays. `MlvDrawerRef` also writes its `aria-labelledby` here. |

Inherited public API: `close(result?)`, `afterClosed()`, `beforeClose()`.
`close()` is idempotent: the first request owns the before-close event, leave
listener/fallback timer, disposal, and result emission; later requests are
ignored.

The leave listener on the panel (`_panelElement`) is **target-guarded**: only
the panel's own `animationend` disposes — neither the content's nor, with a
surface of its own, the pane's — so a drawer body's finite animation finishing inside the
leave window no longer disposes the overlay early and emits `afterClosed` before
the leave played. Like the enter listener it is not `once: true` (an ignored
event would spend it and strand the leave on the fallback timer); `dispose()`
removes it explicitly, whichever of the two paths wins.

`_panelElement` is gated on the **pane**, not on `_surfaceElement` alone. The
CDK overlay can be disposed by something other than the ref (a direct
`OverlayRef.dispose()`), and a surface that outlived its pane is detached and
can never fire `animationend`: a late `close()` would wait out the whole
fallback instead of completing at once. Both of the ref's own disposal paths
also clear `_surfaceElement`, so a ref kept in a component field does not keep
the detached surface's DOM alive. `overlay.spec.ts` pins both.

## Concrete subclasses (in `@malva-ui/core`)

| Base                    | Drawer subclass                                                |
| ----------------------- | -------------------------------------------------------------- |
| `MlvOverlayHostBase`    | `MlvDrawer` (`mlv-drawer`)                                     |
| `MlvOverlayServiceBase` | `MlvDrawerService`                                             |
| `MlvOverlayRef`         | `MlvDrawerRef` (adds `position`/`animationDuration` ctor args) |

The public API of each subclass (selectors, inputs, outputs, methods, generics,
class names) is unchanged by the extraction.

`@malva-ui/core/dialog` used to subclass all three. It now runs on
`@angular/cdk/dialog` and only injects `MlvOverlayInitialFocusResolver` (from
its own CDK container subclass). Bringing the drawer onto the CDK engine the
same way is a possible follow-up; nothing here depends on the dialog.

## Dependencies

| Package                | Usage                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@angular/core`        | `Directive`, signals (`input`/`model`/`output`/`signal`/`effect`), `inject`, `Injector`, `ViewContainerRef` |
| `@angular/cdk/overlay` | `Overlay`, `OverlayRef`, `OverlayConfig`, `PositionStrategy`                                                |
| `@angular/cdk/portal`  | `TemplatePortal`, `ComponentPortal`                                                                         |
| `@angular/cdk/a11y`    | `ConfigurableFocusTrapFactory`, `InteractivityChecker` (initial-focus resolution)                           |
| `rxjs`                 | `Subject`, `Observable` backing the ref observables                                                         |

No new external peer dependencies — all are already peers of `@malva-ui/cdk`.

## Testing

`libs/cdk/overlay/src/lib/overlay.spec.ts` covers all three non-trivial source
files with concrete test doubles: `MlvOverlayRef` (close lifecycle, duplicate
close/result protection, animationend vs fallback disposal, a descendant
`animationend` ignored while the listener stays armed for the pane's own — the
`once: true` regression pin — its removal on disposal, no-panel path),
`MlvOverlayHostBase` (open/afterOpened, leave animation, focus restore,
afterClosed via a real CDK overlay, the `initialFocus` default/keyword/
selector paths, and the `animationend` target guard — a descendant's event
ignored, the panel's own disposing, the fallback still force-completing after an
ignored one), and `MlvOverlayServiceBase` (dialog semantics, enter-animation
class lifecycle, backdrop-click teardown, service-path focus restore,
`config.initialFocus`, and the enter/leave target guards against the live
`OverlayContainer`), plus _content surface_: the default hook's pane-as-surface
layout, and a `_attachContent` override whose surface — not the pane — gets the
dialog semantics, the enter and leave classes, the disposing `animationend` and
`initialFocus: 'container'`. The `animationend` events are plain bubbling `Event`s —
jsdom implements no `AnimationEvent` — which is exact for handlers that read only
`target` / `currentTarget`. `overlay-initial-focus.spec.ts` covers the resolver
itself against the DOM shape a service dialog actually produces. `overlay-config.ts`
is a plain interface (no test).

## File Structure

```
libs/cdk/overlay/src/
  index.ts                     — public API barrel
  test-setup.ts
  lib/
    overlay-config.ts               — MlvBaseOverlayConfig
    overlay-initial-focus.ts        — MlvOverlayInitialFocus(+Resolver), skip/autofocus selectors
    overlay-initial-focus.spec.ts   — resolver unit tests
    overlay-ref.ts                  — MlvOverlayRef<R>
    overlay-host-base.ts            — MlvOverlayHostBase, MlvOverlayAnimationState
    overlay-service-base.ts         — MlvOverlayServiceBase<TConfig, TRef>
    overlay.spec.ts                 — unit tests
```
