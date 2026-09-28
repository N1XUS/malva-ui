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
| `MlvPopupHeaderActions` | Directive | Full-screen header trailing-action slot — `[mlvPopupHeaderActions]` |
| `MlvPopupPinnedContent` | Directive | Chrome pinned above the scroll region in every mode — `[mlvPopupPinnedContent]` |
| `MlvPopupArrowEdge` | Type | `'top' \| 'bottom' \| 'left' \| 'right'` — **physical edges**, not logical aliases (see _Arrow geometry is physical_) |
| `MlvPopupArrowAlign` | Type | `'start' \| 'center' \| 'end'` — **physical ends** of that edge (left/top → `'start'`, right/bottom → `'end'`) |
| `MlvPopupTrigger` | Directive | Trigger element — `[mlvPopupTrigger]` |
| `MlvPopupTriggerType` | Type | `'click' \| 'hover' \| 'focus'` |
| `MlvPopupContainer` | Component | Programmatic container — `mlv-popup-container` |
| `MlvPopupService` | Service | Low-level overlay API |
| `MlvPopupOpenConfig` | Interface | Config for `MlvPopupService.open()` |
| `MlvPopupHandle` | Interface | `{ overlayRef, close, setPositionOrigin }` |
| `MlvPopupSizeConfig` | Interface | Size options |
| `MlvPopupScrollStrategy` | Type | `'reposition' \| 'close' \| 'block' \| 'noop'` |
| `MlvPopupPositionName` | Type | Union of 12 named positions (`'bottom-end'`, `'top'`, etc.). `left` / `right` and the inline `-start` / `-end` halves are **logical aliases** — they map to CDK's `'start'` / `'end'` and mirror in RTL, unlike `MlvPopupArrowEdge` / `MlvPopupArrowAlign` (see _Arrow geometry is physical_). The `offsetX` on the `left-*` / `right-*` entries is logical too, but mirrored by `MlvPopupService` rather than by CDK — see _Inline offsets are logical_ |
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
| `panelRole`              | `string \| null`                                              | `null`      | ARIA `role` for the panel. Default `null` — while anchored the panel is a neutral chrome/positioning container and the semantic role comes from the projected content (`role="menu"`, `role="listbox"`, `role="tooltip"`). Set to `'dialog'` (with `modal`) for a genuine modal surface. **A full-screen sheet resolves an unset value to `'dialog'`** (#322) — see _Full-screen sheet semantics_; an explicit value still wins.                                                                                                                                                                                                 |
| `modal`                  | `BooleanInput`                                                | `false`     | When `true`, emits `aria-modal="true"` and enables the CDK focus trap (Tab cycles within the panel). When `false` (default), no `aria-modal` and focus is free to leave — correct for menus/listboxes/tooltips whose focus is managed by their trigger / roving tabindex. When `panelRole === 'dialog'` and `modal` is `true`, provide an accessible name via `ariaLabel`. A full-screen sheet is modal regardless: always trapped, and `aria-modal="true"` whenever its resolved role is `dialog` / `alertdialog`.                                                                                                              |
| `ariaLabel`              | `string \| undefined`                                         | `undefined` | Accessible name applied as `aria-label` on the panel. On a full-screen sheet with a non-blank `mobileTitle` the title names the panel instead (`aria-labelledby`) and no `aria-label` is emitted; it stays the sheet's name when there is no title.                                                                                                                                                                                                                                                                                                                                                                              |
| `dismissExcludeElements` | `readonly HTMLElement[]`                                      | `[]`        | Elements treated as "inside" the popup for **click-outside dismissal** in backdrop-less mode (`[hasBackdrop]="false"`). A click within any of these — in addition to the floating panel — does not close the popup. The trigger/anchor lives in normal document flow (outside the panel), so pass it here to stop a click on it dismissing the popup; e.g. `mlv-combobox` passes its input row so caret repositioning keeps the open list open. No effect when a backdrop is used. Forwarded by `MlvPopupContainer` and (since #328) a standalone `MlvPopupTrigger` to `MlvPopupService.open`.                                   |

> **Breaking change (a11y):** The panel no longer hard-codes `role="dialog" aria-modal="true" cdkTrapFocus`. Panels default to no role, non-modal, no focus trap. Modal-dialog consumers (e.g. `mlv-day-picker`) must opt in via `panelRole="dialog"` + `[modal]="true"`.

#### Mobile fullscreen inputs

Opt-in mechanism that renders the popup as a full-screen mobile sheet (header bar + close button) instead of a trigger-anchored panel. Off by default so existing consumers are byte-identical; the three date/time pickers opt into `mobileMode="auto"`.

| Name               | Type                                 | Default     | Description                                                                                                                                                                                                                                   |
| ------------------ | ------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mobileMode`       | `'auto' \| 'fullscreen' \| 'off'`    | `'off'`     | `'off'` — always anchored (unchanged). `'auto'` — full-screen below `mobileBreakpoint`, anchored above. `'fullscreen'` — always full-screen (useful for demos). Read at each open — see _Mode is resolved once per open_.                     |
| `mobileBreakpoint` | `MlvBreakpoint` (`'sm'\|'md'\|'lg'`) | `'md'`      | Breakpoint below which `mobileMode="auto"` switches to full-screen. Reads `MlvBreakpointService` (SSR-safe CDK `BreakpointObserver`). Default `'md'` = viewport < 768px. Also read at each open.                                              |
| `mobileTitle`      | `string \| undefined`                | `undefined` | Optional visible heading rendered in the full-screen header bar. When omitted the header shows only the close button. A non-blank title is also the sheet's accessible name (`aria-labelledby` → `.mlv-popup__title`'s id), over `ariaLabel`. |
| `mobileCloseLabel` | `string \| undefined`                | `undefined` | Override for the full-screen close-button accessible name. Falls back to the `MLV_POPUP_I18N` `close` string (`'Close'`).                                                                                                                     |

Popup content is always rendered inside `.mlv-popup__scrollbar`, a shared `mlv-scrollbar` instance that owns overflow for both anchored popovers and full-screen sheets. In full-screen mode: a global (viewport-filling) CDK position strategy replaces the connected one; a solid backdrop (`.mlv-popup-fullscreen-backdrop`, always on) plus a **block** scroll strategy lock the page behind the sheet without layout shift; the panel gets `.mlv-popup--fullscreen` with safe-area-inset padding, a header (`.mlv-popup__header` with a `.mlv-popup__header-row` for `__title` / optional `__header-actions` / `__close`, plus an optional `.mlv-popup__header-content` extension — see below), a scrolling body, and a bottom slide-up animation (fade under `prefers-reduced-motion`). Focus is trapped (`cdkTrapFocus` when `modal() || isFullscreen()`); the close button, backdrop click, and `Escape` all close via the `opened` model so consumer `afterClosed`/focus-restore runs.

**Full-screen sheet semantics (#322).** The sheet is a modal dialog in every respect — trap, forced solid scrim, close button — so it says so to AT. Before, its role, modality and name came only from `panelRole` / `modal` / `ariaLabel`, which `mlv-select`, `mlv-combobox` and `mlv-date-range-picker` never set, and nothing referenced the visible title: a phone user landed in a trapped, role-less, unnamed region. A full axe sweep passed over it, because a role-less `<div>` violates no rule. Now, while `isFullscreen()`:

| Attribute                         | Resolution (`popup.html` binds the protected computeds)                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role` (`_role`)                  | `panelRole()` when set, else `'dialog'`. Anchored: `panelRole()` (default none) — unchanged.                                                                                                                                                |
| `aria-modal` (`_ariaModal`)       | `'true'` when `modal()`, or when full-screen and the resolved role is `dialog` / `alertdialog` — the only roles that support it, so an explicit non-dialog `panelRole` gets none rather than an `aria-allowed-attr` violation.              |
| `aria-labelledby` (`_labelledBy`) | `_titleId()` (`mlvNextId('mlv-popup-title')`, stamped on `.mlv-popup__title`) when full-screen with a **non-blank** `mobileTitle`; else absent. Allocated on first read, so an anchored-only popup takes no number from the shared counter. |
| `aria-label` (`_ariaLabelAttr`)   | `ariaLabel() \|\| null`, withheld while `aria-labelledby` is emitted — exactly one naming attribute ever.                                                                                                                                   |

- **Title over `ariaLabel`: a titled sheet can only be named by its visible title.** This is the form-control carve-out `libs-progress.md` records (`mlv-radio-group`, the pickers: own `label` beats `ariaLabel`), deliberately the reverse of `mlv-drawer` / `MlvDialogContainer`, which drop their title `aria-labelledby` for an explicit `ariaLabel` because both are authored for the same surface. Here `ariaLabel` is mode-agnostic — the anchored popover's only name, since it has no visible heading — while `mobileTitle` is written for the sheet and is on screen there. The pickers pass their own `label()` as the title, so a labelled picker's sheet announces what its trigger does (the trigger already prefers `label` over `ariaLabel`); `ariaLabel`-first would announce "Select date range" under a visible "Stay dates".
- **Consumer consequence:** no input names a titled sheet with anything but its title. An `ariaLabel` richer than `mobileTitle` still names the anchored panel but is dropped on the sheet, with no escape hatch — put the wording in `mobileTitle`, or leave `mobileTitle` unset so `ariaLabel` names the sheet.
- **Blank titles do not count** (`_hasTitle` trims): pointing `aria-labelledby` at whitespace while `aria-label` is withheld would leave the dialog unnamed.
- **Unnamed sheet → dev warning.** `lockFullscreenForOpen()` warns (`isDevMode()`) when it latches `true` with neither a non-blank `mobileTitle` nor `ariaLabel` — once per open, not from an effect that would fire on every viewport crossing while closed. axe's `aria-dialog-name` fails the same sheet.
- **Consumers:** `mlv-select` / `mlv-combobox` gain role, modality and a name (their `_resolvedMobileTitle`: `mobileTitle` → `label` → placeholder); `mlv-date-range-picker` gains role + modality and is named by its title (`label` → `selectDateRange`) instead of `aria-label="Select date range"`, and its inner `__panel` drops `role="dialog"` / `aria-modal` / `aria-label` while full-screen (it already dropped its trap there) so the sheet is the one dialog; `mlv-day-picker` / `mlv-time-picker` already set `panelRole="dialog"` + `[modal]` and are now named by the visible title (`label` → i18n) instead of their `ariaLabel`. `mlv-menu` and `mlv-color-picker-popup` never go full-screen. Anchored panels are byte-identical.
- **Focus on open stays the consumer's job.** `MlvPopup` traps focus in a sheet but moves none in; each consumer's `afterOpened` handler does. `mlv-select` gained one for its non-searchable sheet in #322 (it left focus on the trigger under the scrim — an `aria-modal` dialog with focus outside it); combobox and the three pickers already had theirs. See `libs-select.md` → _Mobile fullscreen_.
- Migration: [docs/migrations/2026-09-popup-fullscreen-dialog-semantics.md](../../docs/migrations/2026-09-popup-fullscreen-dialog-semantics.md). Specs: `popup-fullscreen-a11y.spec.ts`, plus the full-screen blocks of the select, combobox and three picker specs (each sweeps `document.body`).

**Mode is resolved once per open (#126 / #144).** `MlvPopupService.open`'s `fullscreen` flag selects four overlay-level things at `Overlay.create()` time: the global vs connected position strategy, the `mlv-popup-fullscreen-pane` class, the solid scrim, and the block scroll strategy. CDK can change **three** of them on an attached overlay (`updatePositionStrategy`, `addPanelClass`/`removePanelClass`, `updateScrollStrategy`) — but **not the scrim**: `_attachBackdrop()` is private and runs only from `attach()`, and `detachBackdrop()` is one-way. A popup opened anchored with `[hasBackdrop]="false"` (`mlv-combobox` does exactly this) therefore cannot grow a scrim when it goes full-screen without a detach/re-attach, which loses focus position and replays the enter animation. So the panel half holds still with the overlay half rather than chasing the viewport.

`MlvPopup` keeps the live resolution in a private `_liveFullscreen` computed and latches it for the lifetime of one open:

| Member                             | Visibility  | Behaviour                                                                                                                            |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `isFullscreen(): Signal<boolean>`  | public      | The latched value while an overlay is attached; the live one while closed.                                                           |
| `lockFullscreenForOpen(): boolean` | `@internal` | Resolves the live value (`untracked`), latches it, returns it. Called by the overlay owner as it builds the overlay.                 |
| `releaseFullscreenLock(): void`    | `@internal` | Clears the latch. Called from the owner's `onClose`, i.e. after dispose — never during the leave, when the panel is still on screen. |

All three overlay owners — `MlvPopupContainer._attachOverlay()`, standalone `MlvPopupTrigger._attachOverlay()` and `MlvMenuOverlayController.open()` — pass `fullscreen: popup.lockFullscreenForOpen()`, so the flag the CDK overlay is created with and the value `isFullscreen()` reports for that open are literally the same read and cannot drift. Consequences:

- A viewport crossing `mobileBreakpoint` while the popup is open changes nothing: a sheet stays a sheet (keeping its header, close button and focus trap over the scrim it opened with), an anchored dropdown stays anchored. The next open re-resolves.
- Changing the `mobileMode` / `mobileBreakpoint` **inputs** while a popup is open likewise takes effect on the next open, not immediately.
- `MlvMenu`'s popup never opts into `mobileMode`, so its lock always resolves `false`. It still takes and releases the lock, because the invariant is _every attach latches_ — an owner that skipped it would reintroduce #126 silently the day a mobile menu opts in.
- The release is **not** what makes the next open correct: `lockFullscreenForOpen()` overwrites the latch unconditionally at every attach, so "stuck in the previous mode" is structurally impossible either way. The release exists so a **closed** popup reports the live viewport again — for a consumer picking chrome or sizing a trigger ahead of opening.
- The release runs **after** `afterClosed.emit()`, not before it: that handler still belongs to the open that just finished. `mlv-combobox._onPopupClosed` branches on `isFullscreen()` to reset `aria-activedescendant`, resync the display text and restore focus; releasing first would make it skip all three after a sheet that was widened past the breakpoint mid-open.
- One latch per `MlvPopup`, not a refcount: the design assumes **one attached overlay per popup instance**. Two owners over one `<mlv-popup>` (a container plus a standalone trigger bound to the same `#ref`) would already render two panels, and the first `onClose` would clear the latch while the second overlay is still attached.

**Header-content slot (`[mlvPopupHeaderContent]`).** An optional `<ng-template mlvPopupHeaderContent>` is rendered inside the full-screen header, directly beneath the title/close row, via `contentChild(MlvPopupHeaderContent)`. It is **only** stamped while `isFullscreen()` is `true` (and no-ops when the slot is absent), so trigger-anchored popups are byte-identical whether or not the slot is supplied. It exists because the full-screen sheet's solid backdrop + focus trap occlude/block any control that lives outside the overlay panel (in normal document flow): a consumer can move such a control into the sheet by projecting it here. `mlv-combobox` uses it to render an in-sheet search input (and multi-select chips) so type-to-filter keeps working full-screen — see `libs-combobox.md` → _Mobile fullscreen_. The slot sits inside the trapped panel, so projected focusable controls compose with the trap.

**Header-actions slot (`[mlvPopupHeaderActions]`).** An optional `<ng-template mlvPopupHeaderActions>` is rendered as `.mlv-popup__header-actions` **inside** the title/close row, between `__title` and `__close`, via `contentChild(MlvPopupHeaderActions)`. Like the header-content slot it is only stamped while `isFullscreen()` is `true` and no-ops when absent, so anchored popups are unaffected by its presence. It is for a **trailing action that belongs to the sheet chrome rather than the scrolling body** — a confirm the body would otherwise have to reserve footer space for, and which would then scroll away with the content. `mlv-day-picker` and `mlv-date-range-picker` project their `Done` here (#130), which is exactly why the anchored dropdown keeps commit-on-tap / its footer `Apply` and never grows a second confirm: the slot is simply not stamped there.

Order is the contract, not an accident: the actions come **before** the close button, so the primary action is not read or tabbed past the dismiss one. `.mlv-popup__header-actions` takes the auto inline-start margin the close button otherwise claims, and the close button's own margin is zeroed when it follows the group, so the pair stays anchored to the inline-end edge as one unit.

**Pinned-content slot (`[mlvPopupPinnedContent]`).** Mode-independent, unlike the header slot: an optional `<ng-template mlvPopupPinnedContent>` is stamped as `.mlv-popup__pinned` directly **above** `.mlv-popup__scrollbar` in both anchored and full-screen panels (in full-screen it lands between `.mlv-popup__header` and the scroll region, still inside the trap). The panel is a flex column and the scrollbar is `flex: 1 1 auto; min-height: 0`, so the pinned block keeps its own height and the scroll region shrinks around it — content can never push it out of view. It carries no padding; the projected block owns its spacing. `mlv-select` uses it for the searchable dropdown's search row (`position: sticky` inside the viewport was fragile — see `libs-select.md` → _Searchable dropdown_).

**How the sheet body fills the viewport.** `.mlv-popup__inner` carries `min-height: 100%`, and until #116 that percentage silently resolved to `0`: its containing block is `mlv-scrollbar`'s `.mlv-scrollbar__content` wrapper, whose own height is content-derived, and a percentage `min-height` against an indefinite containing block computes to `0`. The wrapper measures a full viewport only because _its_ `min-height: 100%` resolves against the scroll viewport, which the scrollbar's grid gives a definite height — that does not make the wrapper definite for its own children. Measured at 375x812, `__inner` was 32px inside a 751px viewport.

Consequence: sheet content always sat at its natural size at the top of a viewport-tall sheet. Right for a list (`mlv-select`, `mlv-combobox` fill a tall sheet and scroll past it), wrong for fixed-size content, which was left with the rest of the sheet blank.

The fill is now handed to flex, which distributes real space and needs no definite height anywhere: inside `.mlv-popup--fullscreen` the content wrapper becomes a column flex container and `.mlv-popup__inner` takes `flex: 1 1 auto`. `min-height` (not `height`) stays on the wrapper, so content taller than the sheet still grows it and still scrolls. Scoped to `--fullscreen`, so a trigger-anchored popup still shrink-wraps to its content.

**What this does and does not give a consumer.** `__inner` is now sheet-tall, but it is a column flex container with the default `justify-content: flex-start`, so a fixed-size child still sits at the top unless the consumer asks for the space. `mlv-time-picker` opts in with `.mlv-time-picker__panel--sheet` (`flex: 1 1 0`, then a size container query). Since #130 `mlv-day-picker` and `mlv-date-range-picker` opt in the same way — `flex: 1 1 0; min-height: 0` on their own sheet wrapper, passed down to `mlv-calendar-sheet` — so the month list fills the sheet and scrolls inside it. `flex: 1 1 0` and not `height: 100%`: a percentage against `__inner` is the same dead percentage described above, and would leave the body top-anchored with the rest of the sheet blank (observed, not inferred, at 375x812, which is what those two pickers looked like before #130).

**Full-bleed sheets (`.mlv-popup--flush`).** `.mlv-popup--fullscreen .mlv-popup__inner` also carries a `var(--mlv-spacing-4)` body inset. That inset is shared chrome the consumers lean on rather than supply — `mlv-select` / `mlv-combobox` carry only the 4px `--mlv-popover-inset` on their list, and `mlv-day-picker__popup--sheet`, `mlv-time-picker__panel--sheet` and `mlv-date-range-picker__panel--sheet` each write a `padding: 0` of their own _because_ the popup pads for them — so it is not something a block can cancel from inside.

A block that lays itself out edge to edge opts out by passing the panel class instead: `<mlv-popup class="mlv-popup--flush">`, forwarded to the panel by `class` / `_panelClasses()`. Both date pickers pass it, because `mlv-calendar-sheet` owns its inline spacing throughout (a padded weekday strip, a padded month label, `padding-inline` on every week row) — the shared inset doubled up on that and left a full-width sheet header sitting over a body that floated inside it (#149 review). The modifier is inert while the popup is trigger-anchored, where `__inner` carries no padding at all, so it is safe as a static class.

`isFullscreen: Signal<boolean>` is **public** so consumers with their own inner focus trap (e.g. `mlv-date-range-picker`, whose inner panel carries `cdkTrapFocus`) can disable it via `[cdkTrapFocus]="!popup.isFullscreen()"` and avoid nesting two traps. Because it is stable for the duration of an open, a consumer can also branch its whole panel body on it without the body being re-created under the user mid-interaction.

#### Outputs

| Name          | Description                    |
| ------------- | ------------------------------ |
| `afterOpened` | Emitted when popup enters view |
| `afterClosed` | Emitted when popup leaves view |

**Owner destroyed while the overlay is attached (#360).** A destroyed owner closes its overlay — `MlvPopupContainer` / standalone `MlvPopupTrigger` from `ngOnDestroy`, `MlvMenuOverlayController` from the owner's `DestroyRef` — open or mid-leave, and the pane is always disposed. Whether that close writes `opened` / emits `afterClosed` depends on whether the popup's outputs still exist, read through the popup's `@internal` `_isDestroyed()` method:

- **Popup in the owner's view, or outliving it** — the usual shape (select, combobox, the three pickers, color-picker-popup, sidebar flyouts are all popup + container in one view): Angular runs a view's `ngOnDestroy` hooks before its `DestroyRef` callbacks, so the outputs and the consumer's listeners are live; `[(opened)]` returns to `false` and `afterClosed` fires once, as before. Consequence, unchanged: a control's `afterClosed` handler (focus restore, `_markTouched`) runs during its own teardown.
- **Popup torn down first** — an `@if` / `@for` inside a container's content, a popup in a child component's view bound to a trigger, every `mlv-menu` destroyed with its trigger: `opened` / `afterClosed` are skipped (they printed NG0953 before). The destroyed popup's `opened()` stays at its last value; nothing reads it.
- The flag behind `_isDestroyed()` is set by `MlvPopup`'s own `DestroyRef` callback, registered in the constructor after the outputs' own — deliberately **not** `DestroyRef.destroyed`, which is already `true` during the view's `ngOnDestroy` pass and would drop the live same-view emits (ablated: 3 of `popup-destroy.spec.ts`'s specs and `select-destroy.spec.ts` go red, none warning).
- Pinned by `popup-destroy.spec.ts` (same view open / mid-leave, trigger-only destroyed, nested / child view) and `menu-destroy.spec.ts`: no NG0953 `console.warn`, 0 `.cdk-overlay-pane`. `select-destroy.spec.ts` pins the same-view control shape from inside: a searchable select destroyed open still gets `isOpen()` back to `false` through `[(opened)]` and its query reset through `(afterClosed)` — green before the fix too, red under the `DestroyRef.destroyed` design. It deliberately asserts neither focus restore nor touched, see the teardown bullet above.

#### Content Children (content slots)

| Query              | Directive               | Stamped where                                                                                   |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `contentRef`       | `MlvPopupContent`       | `.mlv-popup__inner`, inside the scroll region — every mode                                      |
| `headerContentRef` | `MlvPopupHeaderContent` | `.mlv-popup__header-content`, under the title/close row — **fullscreen only**                   |
| `headerActionsRef` | `MlvPopupHeaderActions` | `.mlv-popup__header-actions`, inside the title/close row before `__close` — **fullscreen only** |
| `pinnedContentRef` | `MlvPopupPinnedContent` | `.mlv-popup__pinned`, directly above the scroll region — **every mode**                         |

Each is a `contentChild(...)`; an absent slot stamps nothing, so a popup that
declares none is byte-identical to one before the slots existed.

#### Internal Signals

- `animationState: signal<'enter' \| 'leave' \| 'idle'>`
- `arrowEdge: signal<MlvPopupArrowEdge>` — the **physical** panel edge the arrow is drawn on
- `arrowAlign: signal<MlvPopupArrowAlign>` — the **physical** end of that edge the arrow sits at

Both are written by `updateArrowFromPosition(pair, direction?)` on every CDK
position change — see _Arrow geometry is physical_.

- `isFullscreen: computed<boolean>` — **public**; whether the popup is rendering as a full-screen mobile sheet. Latched for the lifetime of one open via `lockFullscreenForOpen()` / `releaseFullscreenLock()` (see _Mode is resolved once per open_)
- `_role` / `_ariaModal` / `_labelledBy` / `_ariaLabelAttr` (protected computeds) and `_titleId()` (protected, allocates its id on first call) — the panel's resolved `role`, `aria-modal`, `aria-labelledby` and `aria-label`; see _Full-screen sheet semantics_

#### The panel's `animationend` is target-guarded

The template binds `(animationend)="_onPanelAnimationEnd($event)"`, **not**
`onAnimationEnd()` directly. `animationend` bubbles, so a descendant finishing a
finite CSS animation inside the ~100 ms leave window (`--mlv-duration-fast`)
reaches the panel's listener too; unguarded it completed the leave and detached
the overlay mid-animation (#231). `_onPanelAnimationEnd` admits the event only
when `event.target === event.currentTarget`, i.e. only the panel's own
`popup-enter` / `popup-leave` keyframes.

- **Do not delete the guard as redundant.** The defect is reachable with Malva's
  own components, not only consumer content:
  - `mlv-message` — rendered by `mlv-input`, `mlv-select`, `mlv-combobox` — plays
    a finite `mlv-slide-down` over `--mlv-duration-normal` via `animate.enter`
    (`message.ts` / `message.scss`).
  - `mlv-expand` runs a finite `--mlv-duration-slow` expand/collapse.
  - The editor's link popup (`editor-link.html`) and `mlv-filter`'s popup both
    host `mlv-input`.
  - Only the `infinite` animations — `mlv-loader`, `mlv-skeleton`,
    `mlv-status-indicator` — never fire `animationend`.
- The `enter` path was never affected: `onAnimationEnd()` acts only while
  `animationState() === 'leave'`. Nothing moves the state out of `enter` when
  the enter keyframes end — the overlay owners (`MlvPopupContainer`,
  `MlvPopupTrigger`, `MlvMenuOverlayController`) write `idle` before attach and
  again once a close completes, and `leave` on close — so an `animationend`
  during the enter is a no-op either way. The guard is justified by the leave
  case alone.
- `onAnimationEnd()` itself stays **unfiltered** — it is the force-completion
  entry point the leave fallback timer below calls with no event. Adding an
  event-shaped guard there would break that path.
- Same shape as `MlvDialog._onAnimationEnd`, which compares `event.target`
  against its host element for the same reason. The popup's panel lives in an
  `ng-template` and is not the component host, so `currentTarget` (the element
  the listener is bound to) is the analogue.
- The same defect sat one layer down in `MlvOverlayHostBase.onAnimationEnd()`,
  bound raw by `mlv-drawer` and `mlv-search-field`, where it called
  `_destroyOverlay()` directly (and where a drawer body or search overlay adds
  arbitrary consumer content to the in-repo cases above). Fixed in the same change with the
  same two-method split — `MlvOverlayHostBase._onPanelAnimationEnd` — plus the
  imperative `MlvOverlayRef` leave listener and `MlvOverlayServiceBase` enter
  listener. See `.claude/projects/libs-overlay.md` § _The panel's
  `animationend` is target-guarded_.

#### Leave-animation fallback

Overlay disposal is driven by the panel's **own** `(animationend)` (see above) → `leaveAnimationDone$`. Because `prefers-reduced-motion` strips the `.mlv-popup--leave` animation entirely (it is gated in `animations.scss`) and hidden/background tabs throttle CSS animations indefinitely, `animationend` may never fire. `MlvPopup` therefore arms a fallback timer (`POPUP_LEAVE_FALLBACK_MS`, 250 ms — matches the dialog's module-level `LEAVE_FALLBACK_MS` in `dialog-ref.ts`) whenever `animationState` becomes `'leave'`; if the real `animationend` hasn't completed the leave by then, the timer invokes `onAnimationEnd()` so the overlay always disposes. The timer is disarmed on any state change and on destroy. Without it, every popup-based overlay (menu, menubar, select, combobox, pickers) would hang open for reduced-motion users.

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
- `isOpen()` — Whether the popup is open
- `registerTrigger(origin, hasBackdrop)` — Registers `origin` as the overlay anchor and `hasBackdrop` as the backdrop used while `MlvPopup.hasBackdrop` is unset. Latest registration wins (#282)
- `unregisterTrigger(origin)` — Withdraws that registration; the next open falls back to the one before it

#### Trigger registrations

`registerTrigger` pushes onto a **stack**; the top entry supplies both the origin
and the backdrop fallback for the next attach (#230).

- **Latest wins.** Two triggers in one container: the later registration governs
  — the one that registered last, not the one the user activated (#282). An
  element that registers again (`MlvPopupTrigger` re-registers when `triggerOn`
  changes) **moves to the top** with its new `hasBackdrop` — never a second entry.
- **Nothing is pruned.** Every distinct element stays referenced — detached or
  not — until it is unregistered or the container is destroyed. Pruning
  disconnected entries would strip a live-but-detached view (inactive tab panel,
  CDK virtual-scroll view cache) that registered once and never registers again.
- **Teardown pops back.** `unregisterTrigger` removes the element's entry
  wherever it sits. Removing the top hands the next open to the registration
  below it — its origin _and_ its backdrop; removing an earlier one leaves the
  top in charge; with nothing left the container anchors on its host with a
  backdrop (`true`, the click-trigger default). Unknown elements: no-op.
- **Keyed by `nativeElement`**, not `ElementRef` identity — a view query can hand
  out a fresh wrapper for the same node.
- **Resolved per attach.** Neither call re-anchors an overlay that is already
  open. An open overlay whose origin element is destroyed keeps that origin; CDK
  re-measures the detached node on the next reposition (scroll, resize), gets an
  all-zero rect and moves the panel to the viewport's top-left corner. Predates
  #230; tracked in #283.
- **Who unregisters.** Any caller that registers elements which can be destroyed
  or re-created while the container lives **must** call `unregisterTrigger` —
  the container never drops an entry on its own, so a caller registering a fresh
  element per open grows the stack by one per open (the single slot before #230
  held only the latest). In the library: `MlvPopupTrigger` in container mode,
  from its `DestroyRef` — a trigger inside an `@if` no longer governs later opens
  after it is gone (a hover trigger's `hasBackdrop: false` used to stay latched
  for good); `mlv-items-more`, which withdraws its opener on close and before
  registering a different one. `mlv-sidebar-group` does **not** need to: its
  tooltip container shares the button's `@if`, so both die together.
- `MlvPopupContainerRef.unregisterTrigger` is **optional** on the token interface,
  so a consumer's own `POPUP_CONTAINER` implementation keeps compiling; one that
  omits it keeps a destroyed trigger's registration in force.

#### Overlay origin

The overlay anchors to the top registration's element (see _Trigger
registrations_), falling back to the container's own host when there is none.
Two rules keep that origin honest:

- **The panel is out of scope.** `MlvPopup` provides `POPUP_CONTAINER` as `null`,
  so nothing inside `<mlv-popup>` — panel chrome, projected
  `[mlvPopupContent]`, or a component rendered inside it — resolves the
  container. Portaling the panel into the CDK overlay moves DOM, not the node
  injector: `<ng-template mlvPopupContent>` is declared lexically inside
  `<mlv-popup-container>`, so without that provider a `[mlvPopupTrigger]` in the
  panel switched into container mode, drove `container.toggle()` instead of its
  own popup, and registered its host as the container's origin — an element that
  dies with the panel (#225). A trigger declared as a _sibling_ of `<mlv-popup>`
  is outside the boundary and is unaffected; that is the ordinary container-mode
  arrangement (`mlv-sidebar-group`'s flyout).
- **A detached origin is not used.** A registration can outlive its element's
  presence in the document — an element removed without destroying the view that
  registered it, or a caller that never unregisters. CDK measures a detached node
  without complaint — `getBoundingClientRect()` answers all zeros — and would
  resolve a position against 0,0, putting the panel in the top-left corner of the
  viewport silently. Each attach falls back to the container host instead. Only
  the top entry is consulted: a detached top falls back to the **host**, not to an
  earlier registration, and its backdrop still applies.

---

## Directives

### `MlvPopupTrigger`

**File:** `libs/core/popup/src/lib/popup-trigger/popup-trigger.ts`
**Selector:** `[mlvPopupTrigger]`

#### Mode

- **Container mode** — an ancestor provides `POPUP_CONTAINER`. The trigger owns
  no overlay: it registers its host as the container's origin, withdraws that
  registration when it is destroyed (#230 — see _Trigger registrations_), and
  delegates `open`/`close`/`toggle`. Written as a bare attribute — and a **bound**
  `[mlvPopupTrigger]="somePopup"` inside a container is silently ignored and
  drives the container instead, because the constructor branches on `_container`
  before it ever creates the standalone effect
  (`popup-trigger.ts:116-139`).
- **Standalone mode** — no container in scope. The trigger manages its own CDK
  overlay for the popup bound as `[mlvPopupTrigger]="somePopup"`.

`MlvPopup` provides `POPUP_CONTAINER: null`, so a trigger **inside** a
`<mlv-popup>`'s panel is always standalone even when the popup itself belongs to
a container — see _Overlay origin_ above (#225).

That provider guards the panel, not the container's whole subtree: a
trigger-bearing component placed inside `<mlv-popup-container>` but **outside**
`<mlv-popup>` still resolves the container, and `MlvPopup` is not on that
injector chain. Zero occurrences today; the detached-origin fallback is what
keeps such a case from reproducing #225's symptom.

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

### `MlvPopupHeaderActions`

**Selector:** `[mlvPopupHeaderActions]` | **File:** `libs/core/popup/src/lib/popup-header-actions.ts`

Marks an `<ng-template>` as a trailing action group inside the **full-screen** header's title/close row, between the title and the close button (`contentChild(MlvPopupHeaderActions)`). Generic and reusable; only stamped while `isFullscreen()` is `true` and a no-op when absent, so anchored popups are unaffected. Used by `mlv-day-picker` and `mlv-date-range-picker` for the sheet's `Done` confirm. Extends `MlvStructural` (provides `templateRef`).

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
  onPositionChange?: (change: ConnectedOverlayPositionChange, direction: MlvDirection) => void; // `direction` is the *pane's*, read back off the overlay
}

interface MlvPopupHandle {
  overlayRef: OverlayRef;
  close: () => void;
  setPositionOrigin: (origin: FlexibleConnectedPositionStrategyOrigin, positions?: ConnectedPosition[]) => void;
}
```

`backdropClass` lets consumers replace the default transparent CDK backdrop when they need a styled overlay treatment while keeping the same close behavior.

### Arrow geometry is physical

`MlvPopupArrowEdge` / `MlvPopupArrowAlign` name **physical** screen edges and
ends, in both directions. The conversion happens once, in
`MlvPopup.updateArrowFromPosition(pair, direction)`.

- The `ConnectedPosition` CDK reports is **logical**:
  `FlexibleConnectedPositionStrategy._isRtl()` reads `overlayRef.getDirection()`
  and mirrors `start` / `end` against it. In RTL, `overlayX: 'end'` +
  `originX: 'start'` puts the panel to the **right** of the trigger — the mirror
  image of LTR — so copying the pair through pointed both side arrows at the far
  edge (#163). `arrowAlign` inverted the same way: a `bottom-start` popup put its
  arrow in the corner opposite the trigger.
- The pane is portaled to `<body>`, so the direction that governs it is the
  **trigger's**, not the document's. `MlvPopupService` resolves it
  (`resolveDirection(origin)`), hands it to `Overlay.create()`, and then reads it
  back off the overlay (`overlayRef.getDirection()`) for `onPositionChange` — one
  source of truth, so the arrow can never disagree with the geometry CDK built
  from the same value. Nothing resolves a direction a second time. Pinned by
  `popup.service.spec.ts` → _reports the pane direction, not a re-resolved origin
  direction_, which is the only spec that separates the two (it calls
  `overlayRef.setDirection()` out of band, so the origin still resolves LTR);
  every other direction spec keeps them in sync and passes either way.
- CDK re-emits `positionChanges` only when the _chosen_ `ConnectedPosition`
  object changes (or the scroll visibility does), and mirroring usually
  re-resolves `start` / `end` within the same entry. So `watchDirection`
  re-delivers the freshest pair with the new direction after `updatePosition()`;
  without it a flip while the popup is open moved the panel and left the arrow
  behind. The re-delivery is unconditional, so when CDK _does_ also emit,
  `onPositionChange` fires **twice** with the same pair and direction — harmless
  for deriving state, visible to a handler that counts calls.
- `popupHiddenTransform` switches on `arrowEdge` to pick `translateX(±4px)` and
  is bound to `--mlv-popup-hidden-transform`. **No stylesheet reads that
  property** — the `popup-enter` / `popup-leave` keyframes in
  `libs/styles/src/lib/animations.scss` read `--mlv-popup-enter-from-translate-y`
  / `-scale` / `-opacity` and the matching `--mlv-popup-leave-to-*` — so the
  computed follows the physical edge but has no visual effect. Pre-existing dead
  CSS, not something #163 introduced or fixed.

### Inline offsets are logical, and only because the service makes them so

Every `left-*` / `right-*` entry in `POPUP_POSITION_MAP` carries an `offsetX`
(`-8` / `+8`) expressing the 8px gap between the panel and the trigger. CDK does
**not** mirror it: `FlexibleConnectedPositionStrategy` returns `offsetX` verbatim
from `_getOffset()` and applies it as `x += offsetX` inside `_getOverlayFit` and
as `transform: translateX(${offsetX}px)` on the pane, with no `_isRtl()` anywhere
on that path — unlike `originX` / `overlayX`, which it does mirror. So a
`left-start` popup, mirrored to render physically **right** of its trigger in
RTL, was still pushed 8px further left: the gap became an 8px overlap, a 16px
error against intent (#180).

`MlvPopupService.open()` therefore passes the list through
`mlvMirrorInlineOffsets(positions, direction)` (`@malva-ui/cdk/utils`) using the
same direction it hands to `Overlay.create()`, and re-applies it from both places
that can change that direction under an open pane — the `watchDirection` callback
and `setPositionOrigin`. `updatePosition()` alone is not enough: it re-runs the
strategy over whatever list the strategy still holds, which is mirrored against
the direction the popup opened with.

Consequences worth knowing:

- **The map is unchanged.** `POPUP_POSITION_MAP` still stores the LTR sign, which
  is what a consumer overriding an entry through `providePopupPositions()` writes.
  A consumer who takes the map and drives a `FlexibleConnectedPositionStrategy` of
  their own gets CDK's raw semantics and has to mirror for themselves.
- **`MlvPopupOpenConfig.positions` is logical throughout**, `offsetX` included —
  a consumer's own list is mirrored on the same terms. A gap that must stay
  physical belongs in a `margin-inline-*` on the panel, not in `offsetX`.
- **The blast radius was every RTL popup consumer**, not just the arrow ones:
  `offsetX` moves the panel itself. `mlv-menu`'s `SUBMENU_POSITIONS`
  (`right-start` → `left-start`) is the worst case, because the side it resolves
  to flips.
- Mirroring was **not** done as a `margin-inline-*` on the panel class, the other
  option `.claude/rules/rtl.md` names. `offsetX` participates in
  `_getOverlayFit`'s candidate scoring and in `withPush`; a margin is invisible to
  both, so a panel CDK judged as fitting would render that far outside the
  viewport. On a popup the margin would also be a transparent strip of the pane,
  which the service's click-outside listener counts as inside.

Pinned by `popup.service.spec.ts` → _MlvPopupService — inline offsets_, which
asserts the pane's own `transform` (composed from `offsetX` alone, so jsdom's
absent layout does not enter into it) across a global flip, a scoped
`[dir="rtl"]` with the document still LTR, an LTR island inside an RTL document,
a flip under an open popup, and a list swapped in through `setPositionOrigin`.

**Scope of the #163 defect.** `hasArrow` defaults to `false` and the only
`hasArrow` binding anywhere in `libs/` is `avatar-group.html`, which sets it to
`false`; every `[hasArrow]="true"` in the repo is an `apps/docs` example. So the
mis-mapping was visible to **consumers that opt into `[hasArrow]="true"` under
RTL, plus the docs examples** — not to `mlv-select` / `mlv-combobox` / `mlv-menu`
/ the pickers, which draw no arrow. `arrowEdge` / `arrowAlign` are still written
for every popup (the signals are unconditional; only the class bindings are
gated), which is why the mapping is worth getting right and why the specs assert
the signals rather than only the rendered classes.

`popup.scss` therefore stays physical — `left` / `right` insets, `border-right` /
`border-left` removals, a `left: 50%` + `margin-left` centring pair — each line
carrying a `// physical:` reason. Two independently sufficient grounds, both
straight out of `.claude/rules/rtl.md`:

1. **Public API** (rtl.md § Public API) names `MlvPopupArrowEdge` by name among
   the existing `'left' | 'right'` unions that stay for compatibility, whose
   JSDoc must declare logical-alias vs physical-edge and which must never be
   silently re-interpreted. It is declared physical.
2. **The exceptions table** cites `.mlv-popup--arrow-left` by name as the
   "collision-resolved overlay arrow" case, and § Overlays item 5 requires the
   arrow side be derived from the _resolved_ pair — the side CDK actually chose
   after collision handling, not the side that was requested.

A logical declaration would also mirror a _second_ time on top of the
conversion, and the border-drop pair is not expressible with logical properties
(`border-inline-end` mirrors; the rule needs "drop the physical right border").
Mirroring the rotated glyph with `scaleX(var(--mlv-inline-direction))` is a
perfectly good technique in general — it is rtl.md's own idiom for a directional
glyph — so it is _not_ the reason this stylesheet stays physical; grounds 1 and 2
are.

`direction` is optional on `updateArrowFromPosition` and defaults to `'ltr'`,
which reproduces the pre-#163 mapping exactly; every overlay owner in the library
(`MlvPopupContainer`, standalone `MlvPopupTrigger`, `MlvMenuOverlayController`)
passes it.

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
(`FlexibleConnectedPositionStrategy.setOrigin()` + `updatePosition()`), and
**re-resolves the pane's direction from `config.origin`** first
(`overlayRef.setDirection(resolveDirection(config.origin))`), re-mirroring the
inline offsets against it whether or not a new list arrived. That matters for
an origin that resolves lazily to different elements over time — a context menu
shared by many rows points its `ElementRef` at whichever row was right-clicked
last — because `watchDirection` only reacts to a `dir` attribute changing, not to
the origin element changing; without the re-read a panel re-anchored from an LTR
row to a row inside `[dir="rtl"]` would keep its LTR layout. It is a no-op once
disposed, while detached, and in `fullscreen` mode, which runs a global strategy
with no origin. A second right-click on an open context menu goes
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
- `.mlv-popup--arrow` + `.mlv-popup--arrow-{edge}` + `.mlv-popup--arrow-{align}` — positioned arrow via `::before` pseudo-element. `{edge}` and `{align}` are **physical** and do not mirror; the mirroring happens in `updateArrowFromPosition` (see _Arrow geometry is physical_)
- `.mlv-popup--enter` / `.mlv-popup--leave` — animation state classes
- `.mlv-popup--fullscreen` — full-screen mobile sheet: fills the pane, no border/radius, safe-area padding, slide-up animation (overrides the `--mlv-popup-*-translate-y` keyframe vars)
- `.mlv-popup__header` (column) / `.mlv-popup__header-row` (title + close flex row) / `.mlv-popup__title` / `.mlv-popup__close` — full-screen header bar
- `.mlv-popup__header-content` — optional header extension stamped beneath the title row when `[mlvPopupHeaderContent]` is supplied
- `.mlv-popup__header-actions` — optional trailing-action group stamped inside the title row, before `.mlv-popup__close`, when `[mlvPopupHeaderActions]` is supplied
- `.mlv-popup__pinned` — optional non-scrolling block stamped above `.mlv-popup__scrollbar` when `[mlvPopupPinnedContent]` is supplied (`flex: 0 0 auto`, `z-index: 3` so scrolled sticky content passes underneath; no padding of its own)
- `.mlv-popup__inner` — the projected-content wrapper. Under `--fullscreen` it takes `flex: 1 1 auto` inside a `.mlv-scrollbar__content` made `display: flex; flex-direction: column`, so it is sheet-tall rather than content-tall (see _Mobile fullscreen inputs_), plus a `var(--mlv-spacing-4)` body inset
- `.mlv-popup--flush` — consumer-passed opt-out of that body inset, for a projected block that lays itself out edge to edge (see _Full-bleed sheets_)
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
