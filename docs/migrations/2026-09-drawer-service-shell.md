# 2026-09 — service and routable drawers render in the drawer component shell

**Packages:** `@malva-ui/core/drawer` (`MlvDrawerService`, `mlvGenerateRoutableDrawerRoute`, `MlvDrawerRef`, `MlvDrawer`); `@malva-ui/cdk/overlay` (`MlvOverlayServiceBase`, `MlvOverlayRef`: additive protected hooks only).
**Kind:** breaking, **behaviour only**. No exported symbol, selector, input, output, token, i18n key or BEM class was renamed, removed or retyped. Fixes #305.

---

## Why

A drawer could be opened three ways, and they did not render the same thing:

- `<mlv-drawer>` rendered a `<div class="mlv-drawer" role="dialog">` inside the CDK pane. Its component carried `drawer.scss`, the resize handle and a `MlvDrawerSectionsService`.
- `MlvDrawerService.open()` and every `mlvGenerateRoutableDrawerRoute()` route had no such component. The service attached the opened component straight to the CDK pane and wrote the drawer classes, the size and `role="dialog"` onto **the pane itself**. So:
  - **No stylesheet.** Angular injects a component's styles with its first instance. `MlvDrawer` was never constructed on this path, so an app that opened drawers only through the service rendered them with no panel background, no shadow and unstyled header, body and footer. It looked right only when some `<mlv-drawer>` happened to be alive elsewhere on the page — which is the case on the drawer docs page.
  - **`resizable`, `snapPoints` and `defaultSnap` were inert.** They are documented on `MlvDrawerConfig`, but no handle was rendered and the panel opened at `size`.
  - **`[mlvDrawerSection]` / `mlv-drawer-sections` threw `NG0201`** (`No provider found for MlvDrawerSectionsService`). Through the service it threw out of `open()`; through a route it was an unhandled error in the route's RxJS pipeline, and no drawer opened.
  - **The merged bottom-sheet band** never matched: its selector expects the header as a direct child of `.mlv-drawer`.

## What changed

- A new internal component, `MlvDrawerPanel` (`div[mlvDrawerPanel]`), is the one panel every path renders. It owns:
  - the `.mlv-drawer` element and its classes, `role="dialog"`, `aria-modal`;
  - the geometry (the same function on every path);
  - the resize handle;
  - `drawer.scss` (moved off `MlvDrawer`, which now has no `styleUrl`), minus the header row rules, which moved to `drawer-header.scss` on `MlvDrawerHeader` itself;
  - a `MlvDrawerSectionsService` for service-opened content.
- `<mlv-drawer>` renders it in its overlay template. The rendered markup is the same as before, apart from the `mlvdrawerpanel` attribute.
- `MlvDrawerService` attaches it to the pane, sets its inputs from the config and creates the opened component inside it. The opened component's host gets `mlv-drawer__content`.
  - **The panel, not the pane, is now the dialog surface.** It carries `role`, `aria-modal`, `tabindex="-1"`, the `aria-label` fallback, the header-title `aria-labelledby`, the focus trap, the enter / leave classes and the guarded `animationend`.
- `MlvOverlayServiceBase` gains an overridable `_attachContent()` hook, which returns the dialog surface, and a `_applyContentLayout()` helper.
  - `MlvOverlayRef` plays the leave on the element the hook returned (`_panelElement`).
  - Both are protected or `@internal`, and the hook is overridable, not abstract. No subclassing contract gained a required member.
- The merged bottom-sheet band also matches `…:has(> .mlv-drawer__content > .mlv-drawer__header)`, the service-path shape.

## Before / after

Service-opened or routable drawer (`MlvDrawerService.open(C, config)` / `mlvGenerateRoutableDrawerRoute(C, config)`):

| Observable                                                                                            | Before                                              | After                                                                                               |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Element carrying `.mlv-drawer`, `.mlv-drawer--<position>`                                             | the CDK pane (`.cdk-overlay-pane`)                  | a `<div>` inside the pane                                                                           |
| `role`, `aria-modal`, `tabindex`, `aria-label`, `aria-labelledby`                                     | on the pane                                         | on that `<div>`; the pane carries none                                                              |
| `mlv-drawer--enter` / `--leave`, `--mlv-drawer-hidden-transform`, inline `width` / `height` / `max-*` | on the pane                                         | on that `<div>`                                                                                     |
| Parent of the opened component's host                                                                 | the pane                                            | the `<div>`; the host also gets `class="mlv-drawer__content"`                                       |
| `drawer.scss`                                                                                         | present only if some `<mlv-drawer>` was constructed | present whenever a drawer is open                                                                   |
| Header row styles (`mlv-drawer-header`)                                                               | present only if some `<mlv-drawer>` was constructed | present whenever a header renders (`drawer-header.scss`)                                            |
| `resizable: true`                                                                                     | ignored: no handle, opened at `size`                | handle (drag, keyboard, swipe-to-dismiss); opens at `defaultSnap` (default **100**), `size` ignored |
| Initial focus, `resizable: true`, `initialFocus` unset                                                | first control in the content                        | the resize handle, as with `<mlv-drawer resizable>`                                                 |
| Inline `min-width` / `min-height`                                                                     | absent                                              | `0px`                                                                                               |
| `[mlvDrawerSection]` / `mlv-drawer-sections` in the content                                           | `NG0201`                                            | work                                                                                                |

`<mlv-drawer>`:

| Observable                                             | Before                                       | After                                               |
| ------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------- |
| Panel markup                                           | `<div class="mlv-drawer …">`                 | the same `<div>`, plus a `mlvdrawerpanel` attribute |
| `drawer.scss` while every `<mlv-drawer>` is **closed** | present                                      | absent until a drawer opens                         |
| `mlv-drawer-header` rendered outside any drawer        | styled only while some `<mlv-drawer>` exists | always styled (`drawer-header.scss`)                |

Unchanged on every path: the accessible name, compact header density, the pane's `dir`, the backdrop and its classes, `afterClosed` / `beforeClose` timing, the 350 ms fallback, and `MlvDrawerRef`'s API.

Two differences between the paths remain, both deliberate:

- the service path's `tabindex="-1"` on the panel;
- the opened component's host sitting between the panel and a header.

`<mlv-drawer>` also still renders an empty, unstyled `.mlv-drawer__backdrop` `<div>` beside the panel. It is a BEM class, so removing it is its own change.

## Who is affected

- **Affected:**
  - CSS or DOM queries that treat the **pane** as the drawer: `.cdk-overlay-pane.mlv-drawer`, `.cdk-overlay-pane[role="dialog"]`, `overlayRef.overlayElement.getAttribute('aria-label')`, `.cdk-overlay-pane > app-my-content`.
  - Service or routable callers passing `resizable: true`. They previously got a fixed `size` drawer with no handle. They now get the handle, open at `defaultSnap` (default 100 % of the viewport) and focus the handle first.
  - `[mlvDrawerBody]` or `[mlvDrawerFooter]` rendered **outside** any open drawer that relied on a closed `<mlv-drawer>` on the page to load the stylesheet. `mlv-drawer-header` is not affected: it now carries its own stylesheet, so a standalone header is styled whether or not a drawer exists — before, it was styled only while some `<mlv-drawer>` did.
- **Not affected:**
  - `<mlv-drawer>` consumers: same element, same classes, same behaviour.
  - Service and routable callers without `resizable`, apart from the move of the classes and ARIA from the pane to the panel. Selectors written against `.mlv-drawer` itself — `.mlv-drawer`, `.mlv-drawer--right`, `.mlv-drawer > app-x`, `.mlv-drawer[role="dialog"]` — keep matching.
  - In this repository: nothing changes. No `libs/` or `apps/` code targets the pane, and neither docs service example passes `resizable`.

## What you have to do

| Case                                                                            | Edit                                                                                                     |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A selector or query targets the pane as the drawer                              | Target `.mlv-drawer` (or `.mlv-drawer[role="dialog"]`) instead. It is inside the pane on every path now. |
| A test reads `role` / `aria-*` / drawer classes off `overlayRef.overlayElement` | Read them off `document.querySelector('.mlv-drawer')`.                                                   |
| `resizable: true` and you want the old opening size                             | Pass `defaultSnap` as the viewport percentage you want. Drop `resizable` if you do not want a handle.    |
| `resizable: true` and focus must not start on the handle                        | Pass `initialFocus` (a selector, or `[mlvAutofocus]` on the control).                                    |
| Body or footer parts rendered outside any drawer                                | Render them in a drawer, or style them yourself. A closed `<mlv-drawer>` no longer loads `drawer.scss`.  |

## Versioning

**Classified major** under VERSIONING.md §3, which lists "Changed **default behaviour** at an unchanged API — ordering, timing, emitted events, focus, ARIA, what a value means" as major. On the service and routable paths:

- the ARIA moves off the pane;
- the drawer classes move element;
- initial focus changes for `resizable` drawers;
- `resizable` changes what `size` means.

The issue proposed the "bug fix that restores documented behaviour" row (patch). That row fits part of the change:

- `resizable` / `snapPoints` / `defaultSnap` doing what `MlvDrawerConfig` documents;
- sections no longer throwing;
- the stylesheet arriving.

The ARIA, class-location and focus changes are observable at an unchanged API, so the change is classified major and ships as a `fix(drawer)!` commit. On the `0.x` line that `!` does not release a major: Nx demotes it to a minor (`adjustSemverBumpsForZeroMajorVersion`), so from the root's `0.1.15` it releases as **`0.2.0`** (VERSIONING.md §7, docs/RELEASING.md §3.1). A caret range on `0.1.x` already excludes `0.2.0`, so it reaches no consumer unannounced.
