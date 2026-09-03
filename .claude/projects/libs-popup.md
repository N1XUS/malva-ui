---
# Library: popup

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Popup library (`@malva-ui/core/popup`) provides a flexible overlay/popover system built on Angular CDK. Supports click/hover/focus trigger types, automatic positioning with fallbacks, optional arrows, animations, focus trapping, and backdrop click.

## Public API

Exported from `libs/core/popup/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvPopup` | Component | Popup panel — `mlv-popup` |
| `MlvPopupContent` | Directive | Content slot — `[mlvPopupContent]` |
| `MlvPopupHeaderContent` | Directive | Full-screen header extension slot — `[mlvPopupHeaderContent]` |
| `MlvPopupPinnedContent` | Directive | Chrome pinned above the scroll region in every mode — `[mlvPopupPinnedContent]` |
| `MlvPopupArrowEdge` | Type | `'top' \| 'bottom' \| 'left' \| 'right'` |
| `MlvPopupArrowAlign` | Type | `'start' \| 'center' \| 'end'` |
| `MlvPopupTrigger` | Directive | Trigger element — `[mlvPopupTrigger]` |
| `MlvPopupTriggerType` | Type | `'click' \| 'hover' \| 'focus'` |
| `MlvPopupContainer` | Component | Programmatic container — `mlv-popup-container` |
| `MlvPopupService` | Service | Low-level overlay API |
| `MlvPopupOpenConfig` | Interface | Config for `MlvPopupService.open()` |
| `MlvPopupHandle` | Interface | `{ overlayRef, close, setPositionOrigin }` |
| `MlvPopupSizeConfig` | Interface | Size options |
| `MlvPopupScrollStrategy` | Type | `'reposition' \| 'close' \| 'block' \| 'noop'` |
| `MlvPopupPositionName` | Type | Union of 12 named positions (`'bottom-end'`, `'top'`, etc.) |
| `POPUP_POSITIONS` | Token | `InjectionToken<ReadonlyMap<MlvPopupPositionName, ConnectedPosition>>` |
| `POPUP_POSITION_MAP` | Const | Default map of all 12 named positions |
| `MlvPopupPositionResolver` | Class | Static helper — `resolve()`, `allPositions()` |
| `providePopupPositions` | Function | Provider factory to override the position map |
| `MENU_POSITIONS` | Const | `ConnectedPosition[]` — dropdown-menu placement sequence (`bottom-start`→`top-start`→`bottom-end`→`top-end`), derived from `POPUP_POSITION_MAP`. Consumed by `@malva-ui/core/menu`'s `MlvMenuTrigger`. |
| `SUBMENU_POSITIONS` | Const | `ConnectedPosition[]` — submenu placement sequence (`right-start`→`left-start`), derived from `POPUP_POSITION_MAP`. Consumed by `MlvMenuTrigger`. |

---

## Components

### `MlvPopup`

**File:** `libs/core/popup/src/lib/popup/popup.ts`
**Template:** `libs/core/popup/src/lib/popup/popup.html`
**Styles:** `libs/core/popup/src/lib/popup/popup.css`

- **Selector:** `mlv-popup`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`

#### Model (two-way binding)

| Name     | Type      | Default |
| -------- | --------- | ------- |
| `opened` | `boolean` | `false` |

> **Open/close API consistency:** `mlv-popup` already exposes the normalized surface — an `opened` two-way model plus `afterOpened`/`afterClosed` outputs — matching `mlv-drawer`. The dialog no longer shares it: its open state moved to `ng-template[mlvDialog]` / `MlvDialogService` on `@angular/cdk/dialog`, and `mlv-dialog` is now only the presentational surface. No change was needed here during the open/close naming normalization (`mlv-expand` was the outlier and was renamed `open` → `opened`). `mlv-popup` keeps its own trigger/positioning architecture and does **not** extend `@malva-ui/cdk/overlay`'s `MlvOverlayHostBase` (which targets centred/edge modal surfaces).

#### Inputs

| Name                     | Type                                                          | Default     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `position`               | `MlvPopupPositionName \| MlvPopupPositionName[] \| undefined` | `undefined` | Named position(s) — resolved from `POPUP_POSITIONS` map. Array = ordered fallbacks. Takes precedence over `positions`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `positions`              | `ConnectedPosition[] \| undefined`                            | `undefined` | Raw CDK positions for advanced use. Used when `position` is not set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `width`                  | `number \| string \| undefined`                               | —           | CSS width of the popup panel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `height`                 | `number \| string \| undefined`                               | —           | CSS height                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `minWidth`               | `number \| string \| undefined`                               | —           | Minimum CSS width                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `minHeight`              | `number \| string \| undefined`                               | —           | Minimum CSS height                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `maxWidth`               | `number \| string \| undefined`                               | —           | Maximum CSS width                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `maxHeight`              | `number \| string \| undefined`                               | —           | Maximum CSS height                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `hasArrow`               | `boolean`                                                     | `false`     | Show arrow pointing to trigger                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `hasShadow`              | `boolean`                                                     | `true`      | Drop shadow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `class`                  | `string`                                                      | —           | Additional CSS classes on the panel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `mlvDensity`             | `MlvDensity \| undefined`                                     | `undefined` | Density for the popup content. The panel is portaled to the CDK overlay container on `<body>`, outside any `mlvDensityRoot`/ancestor density cascade — this input restores it: the resolved density (explicit input, else the nearest ancestor `MLV_DENSITY_CONTEXT`, else `MlvDensityService`) is stamped as a `mlv--{density}` class on the panel (`_panelClasses` computed merges it with `class`), so density-aware descendants (e.g. `mlv-list-item` rows) respond via the standard CSS cascade. Consumers with embedded popups (select, combobox, pagination, menu, breadcrumb) forward their own `mlvDensity` input here. |
| `flexibleDimensions`     | `boolean`                                                     | `false`     | Allow panel to grow to fill viewport                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `panelRole`              | `string \| null`                                              | `null`      | ARIA `role` for the panel. Default `null` — the panel is a neutral chrome/positioning container and the semantic role comes from the projected content (`role="menu"`, `role="listbox"`, `role="tooltip"`). Set to `'dialog'` (with `modal`) for a genuine modal surface.                                                                                                                                                                                                                                                                                                                                                        |
| `modal`                  | `BooleanInput`                                                | `false`     | When `true`, emits `aria-modal="true"` and enables the CDK focus trap (Tab cycles within the panel). When `false` (default), no `aria-modal` and focus is free to leave — correct for menus/listboxes/tooltips whose focus is managed by their trigger / roving tabindex. When `panelRole === 'dialog'` and `modal` is `true`, provide an accessible name via `ariaLabel`.                                                                                                                                                                                                                                                       |
| `ariaLabel`              | `string \| undefined`                                         | `undefined` | Accessible name applied as `aria-label` on the panel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `dismissExcludeElements` | `readonly HTMLElement[]`                                      | `[]`        | Elements treated as "inside" the popup for **click-outside dismissal** in backdrop-less mode (`[hasBackdrop]="false"`). A click within any of these — in addition to the floating panel — does not close the popup. The trigger/anchor lives in normal document flow (outside the panel), so pass it here to stop a click on it dismissing the popup; e.g. `mlv-combobox` passes its input row so caret repositioning keeps the open list open. No effect when a backdrop is used. Forwarded through `MlvPopupContainer` into `MlvPopupService.open`'s `dismissExcludeElements`.                                                 |

> **Breaking change (a11y):** The panel no longer hard-codes `role="dialog" aria-modal="true" cdkTrapFocus`. Panels default to no role, non-modal, no focus trap. Modal-dialog consumers (e.g. `mlv-day-picker`) must opt in via `panelRole="dialog"` + `[modal]="true"`.

#### Mobile fullscreen inputs

Opt-in mechanism that renders the popup as a full-screen mobile sheet (header bar + close button) instead of a trigger-anchored panel. Off by default so existing consumers are byte-identical; the three date/time pickers opt into `mobileMode="auto"`.

| Name               | Type                                 | Default     | Description                                                                                                                                                              |
| ------------------ | ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mobileMode`       | `'auto' \| 'fullscreen' \| 'off'`    | `'off'`     | `'off'` — always anchored (unchanged). `'auto'` — full-screen below `mobileBreakpoint`, anchored above. `'fullscreen'` — always full-screen (useful for demos).          |
| `mobileBreakpoint` | `MlvBreakpoint` (`'sm'\|'md'\|'lg'`) | `'md'`      | Breakpoint below which `mobileMode="auto"` switches to full-screen. Reads `MlvBreakpointService` (SSR-safe CDK `BreakpointObserver`). Default `'md'` = viewport < 768px. |
| `mobileTitle`      | `string \| undefined`                | `undefined` | Optional visible heading rendered in the full-screen header bar. When omitted the header shows only the close button.                                                    |
| `mobileCloseLabel` | `string \| undefined`                | `undefined` | Override for the full-screen close-button accessible name. Falls back to the `MLV_POPUP_I18N` `close` string (`'Close'`).                                                |

Popup content is always rendered inside `.mlv-popup__scrollbar`, a shared `mlv-scrollbar` instance that owns overflow for both anchored popovers and full-screen sheets. In full-screen mode: a global (viewport-filling) CDK position strategy replaces the connected one; a solid backdrop (`.mlv-popup-fullscreen-backdrop`, always on) plus a **block** scroll strategy lock the page behind the sheet without layout shift; the panel gets `.mlv-popup--fullscreen` with safe-area-inset padding, a header (`.mlv-popup__header` with a `.mlv-popup__header-row` for `__title` / `__close`, plus an optional `.mlv-popup__header-content` extension — see below), a scrolling body, and a bottom slide-up animation (fade under `prefers-reduced-motion`). Focus is trapped (`cdkTrapFocus` when `modal() || isFullscreen()`); the close button, backdrop click, and `Escape` all close via the `opened` model so consumer `afterClosed`/focus-restore runs. The overlay decides fullscreen at open time (`MlvPopupService.open`'s `fullscreen` flag, sourced from `isFullscreen()`); the panel chrome tracks the signal reactively.

**Header-content slot (`[mlvPopupHeaderContent]`).** An optional `<ng-template mlvPopupHeaderContent>` is rendered inside the full-screen header, directly beneath the title/close row, via `contentChild(MlvPopupHeaderContent)`. It is **only** stamped while `isFullscreen()` is `true` (and no-ops when the slot is absent), so trigger-anchored popups are byte-identical whether or not the slot is supplied. It exists because the full-screen sheet's solid backdrop + focus trap occlude/block any control that lives outside the overlay panel (in normal document flow): a consumer can move such a control into the sheet by projecting it here. `mlv-combobox` uses it to render an in-sheet search input (and multi-select chips) so type-to-filter keeps working full-screen — see `libs-combobox.md` → _Mobile fullscreen_. The slot sits inside the trapped panel, so projected focusable controls compose with the trap.

**Pinned-content slot (`[mlvPopupPinnedContent]`).** Mode-independent, unlike the header slot: an optional `<ng-template mlvPopupPinnedContent>` is stamped as `.mlv-popup__pinned` directly **above** `.mlv-popup__scrollbar` in both anchored and full-screen panels (in full-screen it lands between `.mlv-popup__header` and the scroll region, still inside the trap). The panel is a flex column and the scrollbar is `flex: 1 1 auto; min-height: 0`, so the pinned block keeps its own height and the scroll region shrinks around it — content can never push it out of view. It carries no padding; the projected block owns its spacing. `mlv-select` uses it for the searchable dropdown's search row (`position: sticky` inside the viewport was fragile — see `libs-select.md` → _Searchable dropdown_).

`isFullscreen: Signal<boolean>` is **public** so consumers with their own inner focus trap (e.g. `mlv-date-range-picker`, whose inner panel carries `cdkTrapFocus`) can disable it via `[cdkTrapFocus]="!popup.isFullscreen()"` and avoid nesting two traps.

#### Outputs

| Name          | Description                    |
| ------------- | ------------------------------ |
| `afterOpened` | Emitted when popup enters view |
| `afterClosed` | Emitted when popup leaves view |

#### Content Children (content slots)

| Query              | Directive               | Stamped where                                                                 |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------- |
| `contentRef`       | `MlvPopupContent`       | `.mlv-popup__inner`, inside the scroll region — every mode                    |
| `headerContentRef` | `MlvPopupHeaderContent` | `.mlv-popup__header-content`, under the title/close row — **fullscreen only** |
| `pinnedContentRef` | `MlvPopupPinnedContent` | `.mlv-popup__pinned`, directly above the scroll region — **every mode**       |

Each is a `contentChild(...)`; an absent slot stamps nothing, so a popup that
declares none is byte-identical to one before the slots existed.

#### Internal Signals

- `animationState: signal<'enter' \| 'leave' \| 'idle'>`
- `arrowEdge: signal<MlvPopupArrowEdge>`
- `arrowAlign: signal<MlvPopupArrowAlign>`
- `isFullscreen: computed<boolean>` — **public**; whether the popup is rendering as a full-screen mobile sheet (see Mobile fullscreen inputs)

#### Leave-animation fallback

Overlay disposal is driven by the panel's `(animationend)` → `leaveAnimationDone$`. Because `prefers-reduced-motion` strips the `.mlv-popup--leave` animation entirely (it is gated in `animations.scss`) and hidden/background tabs throttle CSS animations indefinitely, `animationend` may never fire. `MlvPopup` therefore arms a fallback timer (`POPUP_LEAVE_FALLBACK_MS`, 250 ms — matches the dialog's module-level `LEAVE_FALLBACK_MS` in `dialog-ref.ts`) whenever `animationState` becomes `'leave'`; if the real `animationend` hasn't completed the leave by then, the timer invokes `onAnimationEnd()` so the overlay always disposes. The timer is disarmed on any state change and on destroy. Without it, every popup-based overlay (menu, menubar, select, combobox, pickers) would hang open for reduced-motion users.

#### Enter promotion — `beginEnterAnimation()`

- Overlay owners (`MlvPopupContainer`, `MlvPopupTrigger` standalone mode, `MlvMenuTrigger`) set `animationState` to `'idle'` on attach, then promote to `'enter'` from a `queueMicrotask` so the panel is in the DOM before the keyframes start.
- **Never write `animationState.set('enter')` from that microtask directly** — call `popup.beginEnterAnimation()`, which promotes only while the state is still `'idle'`.
- Why: a close requested in the same tick as the attach (outside-pointer dismissal, immediate option pick) already moved the state to `'leave'`. Overwriting it wedges the overlay permanently — the leave keyframes never play so no `animationend` arrives, the `'enter'` write itself clears the leave fallback timer without re-arming, and the owner's `_closing` latch blocks both the retry path and any re-open (`open()` returns early while a handle exists). The trigger keeps toggling `aria-expanded` while the panel stays on screen — that mismatch is the tell.

#### Detach watchdog

`POPUP_DETACH_WATCHDOG_MS` (350 ms = leave fallback + 100 ms). `MlvPopupContainer` and `MlvPopupTrigger` arm it when a leave starts and clear it on detach/`onClose`/destroy; if the overlay is still attached and still `_closing` when it fires, they force `_detachOverlay()`. Detaching is what resets `_closing`/`_handle`, so a leave that never completes must still end in a detach — otherwise the owner latches with no path back.

---

### `MlvPopupContainer`

**File:** `libs/core/popup/src/lib/popup-container/popup-container.ts`
**Selector:** `mlv-popup-container`

Wrapper for programmatic popup management. Required content child: `MlvPopup`.

#### Methods

- `open()` — Open the popup
- `close()` — Close the popup
- `toggle()` — Toggle state

---

## Directives

### `MlvPopupTrigger`

**File:** `libs/core/popup/src/lib/popup-trigger/popup-trigger.ts`
**Selector:** `[mlvPopupTrigger]`

#### Inputs

| Name              | Type                                           | Default    |
| ----------------- | ---------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `mlvPopupTrigger` | `MlvPopup` (required)                          | —          |
| `triggerOn`       | `MlvPopupTriggerType \| MlvPopupTriggerType[]` | `'click'`  |
| `ariaHasPopup`    | `string \| null`                               | `'dialog'` | Value for the trigger's `aria-haspopup`. Set to `'menu'`, `'listbox'`, etc. to match the popup content's role, or `null` to omit. |

#### Host Events → Methods

- `(click)` → `onClick()` (toggles if `'click'` trigger)
- `(mouseenter)` → `onMouseEnter()` (opens if `'hover'`)
- `(mouseleave)` → `onMouseLeave()` (delayed close if `'hover'`)
- `(focus)` → `onFocus()` (opens if `'focus'`)
- `(blur)` → `onBlur()` (closes if `'focus'`)

---

### `MlvPopupContent`

**Selector:** `[mlvPopupContent]` | Provides `templateRef: TemplateRef` for content rendering.

---

### `MlvPopupHeaderContent`

**Selector:** `[mlvPopupHeaderContent]` | **File:** `libs/core/popup/src/lib/popup-header-content.ts`

Marks an `<ng-template>` as a header extension rendered inside the **full-screen** header, beneath the title/close row (`contentChild(MlvPopupHeaderContent)`). Generic and reusable; only stamped while `isFullscreen()` is `true` and a no-op when absent, so anchored popups are unaffected. Used by `mlv-combobox` for its in-sheet search input. Extends `MlvStructural` (provides `templateRef`).

---

### `MlvPopupPinnedContent`

**Selector:** `[mlvPopupPinnedContent]` | **File:** `libs/core/popup/src/lib/popup-pinned-content.ts`

Marks an `<ng-template>` as chrome pinned above the popup's scroll region (`contentChild(MlvPopupPinnedContent)`), stamped as `.mlv-popup__pinned` directly before `.mlv-popup__scrollbar` in **every** mode — anchored and full-screen alike (in full-screen it sits below `.mlv-popup__header`, inside the sheet's focus trap). Generic and reusable; a no-op when absent. Unlike `[mlvPopupHeaderContent]` — which exists to move outside-the-overlay controls into the full-screen sheet — this slot is about **scroll behaviour**: the projected block keeps its own height while the scroll region shrinks around it, so it can never scroll out of view. Used by `mlv-select` for the searchable dropdown's search row. Extends `MlvStructural` (provides `templateRef`).

---

## Services

### `MlvPopupService`

**File:** `libs/core/popup/src/lib/popup.service.ts` | **Provided in:** `root`

#### `resolvePositions(names: MlvPopupPositionName | MlvPopupPositionName[]): ConnectedPosition[]`

Looks up one or more named positions in the active `POPUP_POSITIONS` map and returns the corresponding `ConnectedPosition[]`. CDK uses the first position in the array that fits in the viewport. Unrecognised names are skipped and a `console.warn` is emitted in dev mode.

```ts
// Single preferred position
positions: this.popupService.resolvePositions('bottom-end');
// Preferred + fallback
positions: this.popupService.resolvePositions(['bottom-end', 'top-end']);
```

#### `open(config: MlvPopupOpenConfig): MlvPopupHandle`

Creates CDK overlay at origin, attaches template portal, subscribes to position changes, backdrop clicks, and Escape key.

```ts
interface MlvPopupOpenConfig {
  origin: ElementRef; // positions the overlay, resolves its direction, owns focus restore
  positionOrigin?: FlexibleConnectedPositionStrategyOrigin; // overrides *only* what the overlay is positioned against
  template: TemplateRef<unknown>;
  vcr: ViewContainerRef;
  positions: ConnectedPosition[];
  size?: MlvPopupSizeConfig;
  fullscreen?: boolean; // full-screen mobile sheet: global position strategy, forced solid backdrop, block scroll-lock; ignores positions/size
  hasBackdrop?: boolean;
  backdropClass?: string;
  scrollStrategy?: MlvPopupScrollStrategy;
  flexibleDimensions?: boolean;
  dismissExcludeElements?: readonly HTMLElement[]; // trigger/anchor elements treated as "inside" for backdrop-less click-outside detection
  onClose: () => void;
  onRequestClose?: () => void;
  onPositionChange?: (change: ConnectedOverlayPositionChange) => void;
}

interface MlvPopupHandle {
  overlayRef: OverlayRef;
  close: () => void;
  setPositionOrigin: (origin: FlexibleConnectedPositionStrategyOrigin, positions?: ConnectedPosition[]) => void;
}
```

`backdropClass` lets consumers replace the default transparent CDK backdrop when they need a styled overlay treatment while keeping the same close behavior.

### Point-anchored overlays — `positionOrigin` / `setPositionOrigin`

`positionOrigin` accepts anything CDK's `flexibleConnectedTo` does, including a
bare `{ x, y }` viewport point. It exists for overlays anchored to a **cursor**
rather than to an element — `MlvContextMenuTrigger` is the built-in consumer.

`origin` is deliberately still required and still an `ElementRef` when
`positionOrigin` is set, because a point carries none of what the rest of `open()`
needs from it:

- `direction` is resolved with `MlvRtlService.resolveDirection(origin)`, which
  walks up the DOM for the nearest explicit `dir` — a scoped `[dir="rtl"]`
  subtree must still mirror a cursor-anchored panel;
- `watchDirection(origin, …)` keeps re-mirroring the portaled pane while open;
- focus restoration and `dismissExcludeElements` are element concepts.

`setPositionOrigin` re-anchors an **already-open** overlay and repositions it
(`FlexibleConnectedPositionStrategy.setOrigin()` + `updatePosition()`). It is a
no-op once disposed, while detached, and in `fullscreen` mode, which runs a
global strategy with no origin. A second right-click on an open context menu goes
through this rather than closing and reopening — reopening does not even work,
because `close()` only _starts_ the leave animation and the immediately following
`open()` bails on the still-`true` open flag.

The optional `positions` argument re-applies `withPositions` in the same call. It
matters when the anchor changes **kind**, not just place: a context menu opened
from the keyboard is anchored to its host element with `MENU_POSITIONS`, whose
entries carry `offsetY: ±8`. Re-anchoring that panel to a cursor without swapping
the list would keep applying the 8px element gap to the point, leaving the panel
hanging below the pointer.

> A point-anchored overlay that must keep seeing pointer events on the page
> **must also open with `hasBackdrop: false`**. The CDK backdrop is `inset: 0`
> with `pointer-events: auto`, so it hit-tests the whole viewport; and a
> right-click fires no `click`, so `backdropClick()` never runs either. With a
> backdrop, a second right-click reaches neither the trigger nor the dismiss
> path — it only loses its `preventDefault()`, and the **native browser menu**
> opens over the panel. Click-outside dismissal still works without a backdrop
> via the document listener `open()` installs.

That listener is a **capture-phase** `click` on the **injected `DOCUMENT`**, and is
a `fromEvent(document, 'click', { capture: true })` stream (converted in #76).
The capture phase is load-bearing — dismissal has to see the click before a
handler inside the page can stop its propagation — and `fromEvent` forwards the
options object to the identical `addEventListener` call, so the phase is
unchanged; `popup.service.spec.ts` pins it with a page handler that calls
`stopImmediatePropagation()`. The subscription belongs to one open overlay and is
released by the `cleanups` list on close, a shorter lifetime than
`takeUntilDestroyed` on a `providedIn: 'root'` service could express.

---

## Named Positions

12 named positions are registered in `POPUP_POSITION_MAP` and resolved via the `POPUP_POSITIONS` token:

| Name           | Side  | Alignment      |
| -------------- | ----- | -------------- |
| `top-start`    | Above | Left-aligned   |
| `top`          | Above | Centered       |
| `top-end`      | Above | Right-aligned  |
| `bottom-start` | Below | Left-aligned   |
| `bottom`       | Below | Centered       |
| `bottom-end`   | Below | Right-aligned  |
| `left-start`   | Left  | Top-aligned    |
| `left`         | Left  | Centered       |
| `left-end`     | Left  | Bottom-aligned |
| `right-start`  | Right | Top-aligned    |
| `right`        | Right | Centered       |
| `right-end`    | Right | Bottom-aligned |

All positions include an 8 px gap between trigger and panel.

**Resolution order** when `resolvedPositions()` is called on `MlvPopup`:

1. `position` input (named, looked up in map)
2. `positions` input (raw CDK)
3. All 12 defaults (CDK auto-picks the first that fits)

**Override globally:**

```ts
// app.config.ts
providers: [providePopupPositions(new Map([...POPUP_POSITION_MAP, ['bottom', { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 4 }]]))];
```

---

## CSS Classes

- `.mlv-popup` — background, border, radius, padding, flex column
- `.mlv-popup--shadow` — `filter: drop-shadow(0 4px 30px rgba(0,0,0,0.16))`
- `.mlv-popup--arrow` + `.mlv-popup--arrow-{edge}` + `.mlv-popup--arrow-{align}` — positioned arrow via `::before` pseudo-element
- `.mlv-popup--enter` / `.mlv-popup--leave` — animation state classes
- `.mlv-popup--fullscreen` — full-screen mobile sheet: fills the pane, no border/radius, safe-area padding, slide-up animation (overrides the `--mlv-popup-*-translate-y` keyframe vars)
- `.mlv-popup__header` (column) / `.mlv-popup__header-row` (title + close flex row) / `.mlv-popup__title` / `.mlv-popup__close` — full-screen header bar
- `.mlv-popup__header-content` — optional header extension stamped beneath the title row when `[mlvPopupHeaderContent]` is supplied
- `.mlv-popup__pinned` — optional non-scrolling block stamped above `.mlv-popup__scrollbar` when `[mlvPopupPinnedContent]` is supplied (`flex: 0 0 auto`, `z-index: 3` so scrolled sticky content passes underneath; no padding of its own)
- `.mlv-popup-fullscreen-pane` (global) — CDK overlay panel class stretching the pane to the viewport (`100dvh`)
- `.mlv-popup-fullscreen-backdrop` (global) — solid scrim (`--mlv-background-overlay`) shown behind the sheet

---

## Usage Examples

```html
<!-- Named position (preferred) -->
<button [mlvPopupTrigger]="popup">Open</button>
<mlv-popup #popup position="bottom-end" [hasArrow]="true">
  <ng-template mlvPopupContent><p>Popup content</p></ng-template>
</mlv-popup>

<!-- Named position with fallback -->
<button [mlvPopupTrigger]="popup2">Open</button>
<mlv-popup #popup2 [position]="['bottom-end', 'top-end']">
  <ng-template mlvPopupContent><p>Flips to top when no bottom space</p></ng-template>
</mlv-popup>

<!-- Hover tooltip -->
<span [mlvPopupTrigger]="tip" triggerOn="hover">Hover me</span>
<mlv-popup #tip position="top" [hasShadow]="false" [hasArrow]="true">
  <ng-template mlvPopupContent>Help text</ng-template>
</mlv-popup>

<!-- Multi-trigger -->
<input [mlvPopupTrigger]="help" [triggerOn]="['focus', 'hover']" />
<mlv-popup #help position="bottom-start">
  <ng-template mlvPopupContent>Field info</ng-template>
</mlv-popup>

<!-- Programmatic container -->
<mlv-popup-container #container>
  <mlv-popup position="right">
    <ng-template mlvPopupContent>Menu items</ng-template>
  </mlv-popup>
</mlv-popup-container>
<button (click)="container.toggle()">Toggle</button>

<!-- Programmatic service usage -->
<!-- In component: -->
<!-- positions: this.popupService.resolvePositions(['bottom', 'top']) -->
```

---

## Dependencies

- `@angular/cdk/overlay` — overlay, positioning, global/block strategies (full-screen)
- `@angular/cdk/portal` — `TemplatePortal`
- `@angular/cdk/a11y` — `cdkTrapFocus`
- `@lucide/angular` — `LucideX` (full-screen close-button icon)
- `@malva-ui/cdk/utils` — `MlvBreakpointService` (SSR-safe viewport detection for `mobileMode="auto"`)
- `@malva-ui/core/scrollbar` — themed overflow for anchored and full-screen popup content
- `@malva-ui/i18n` — `MLV_POPUP_I18N` (optional; full-screen close-button label, falls back to `'Close'`)
