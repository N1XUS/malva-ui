---
# Library: tooltip

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Tooltip library (`@malva-ui/core/tooltip`) provides a lightweight, accessible tooltip that appears on hover and focus. It uses Angular CDK overlay positioning and supports configurable placement, color variants, delay, and an optional directional arrow.

Tooltip is self-contained — it creates a CDK overlay and a `MlvTooltipPanel` dynamically via `MlvTooltip`. It intentionally does not reuse `MlvPopupService` (which is click/template-based) since tooltip trigger behavior (hover + focus + delay) diverges significantly from popup click semantics.

## Public API

Exported from `libs/core/tooltip/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvTooltip` | Directive | `[mlvTooltip]` — main public API; attach to any element |
| `MlvTooltipPanel` | Component | `mlv-tooltip-panel` — internal floating panel (not for direct use) |
| `MlvTooltipTone` | Type | `MlvTone \| 'neutral' \| 'surface' \| 'primary'` |
| `MlvTooltipPlacement` | Type | `'top' \| 'bottom' \| 'left' \| 'right'`. `left` / `right` are **logical aliases** (`originX: 'start'` / `'end'`) and mirror in RTL, clearance included — see _Direction_ |

---

## Directives

### `MlvTooltip`

**File:** `libs/core/tooltip/src/lib/tooltip/tooltip.ts`
**Selector:** `[mlvTooltip]`

The primary consumer API. Attach to any element — button, icon, input, etc.

#### Inputs

| Name               | Type                  | Default     | Description                                                                                                            |
| ------------------ | --------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `mlvTooltip`       | `string` (required)   | —           | Tooltip text content; a change while shown updates the bubble in place, a change to empty hides it                     |
| `tooltipPlacement` | `MlvTooltipPlacement` | `'top'`     | Preferred placement; CDK flips to opposite if no viewport space. `'left'` / `'right'` are logical — they mirror in RTL |
| `tooltipTone`      | `MlvTooltipTone`      | `'neutral'` | Tone variant of the tooltip panel                                                                                      |
| `tooltipDelay`     | `number`              | `300`       | Milliseconds before tooltip appears after hover/focus                                                                  |
| `tooltipDisabled`  | `BooleanInput`        | `false`     | Suppresses the tooltip entirely — a visible bubble hides, a pending show is dropped                                    |
| `tooltipArrow`     | `BooleanInput`        | `true`      | Shows/hides the directional arrow                                                                                      |

#### Behavior

- **Show:** `mouseenter` or `focusin` → schedule after `tooltipDelay` ms. Never for empty or whitespace-only text, nor while disabled (`_show()` returns early on `_activeMessage()` — the trimmed `_message()`, empty while disabled; `null` from a non-strict template reads as empty) — #321, #346. Disabling or emptying inside the delay **drops** the pending show (see _While shown_), so undoing it inside the delay brings nothing up; a show armed while the text was empty stays armed, and text arriving inside the delay shows.
- **Hide:** `focusout` or `Escape` → immediate — except on the host-fallback path (an overlay above took the key, or an ancestor stopped it; see _Escape_), where the hide lands one task later. `mouseleave` → hides after a ~150 ms grace period so the pointer can travel onto the tooltip panel. `tooltipDisabled` turning true, or the text turning empty / whitespace-only, while shown → immediate (see _While shown_).
- **Hoverable (WCAG 1.4.13):** while visible, `mouseenter` on the tooltip panel cancels the pending hide and `mouseleave` on the panel re-schedules it, so the tooltip stays open while the pointer is over it. Panel hover listeners are attached with `Renderer2.listen` in `_show()` and torn down in `_hide()`.
- **Escape — dismissible, and only the tooltip (WCAG 1.4.13, D13, #319):** see _Escape_ below.

#### While shown (#346)

- **Inputs follow a visible bubble:** a constructor `effect` forwards `mlvTooltip`, `tooltipTone` and `tooltipArrow` to the attached panel with `setInput()` — the same pane, updated in place, no re-create. Before, `_show()` set them once, so a `[mlvTooltip]="starred ? 'Unstar' : 'Star'"` kept its old text for as long as the pointer stayed on the host (`apps/docs` support-inbox's Star button), and disabling or emptying left the bubble up.
- **Turning off:** a second `effect` reads `tooltipDisabled()` and the trimmed `_message()` and, while either says off (disabled, or the text empty / whitespace-only), calls `_clearShowTimer()` + `_hide()` — the bubble comes down **and** a pending show is dropped. Without the timer clear the pending show was only re-checked when the delay elapsed, so disable → re-enable (or empty → back) inside the delay popped the bubble up on its own — also with the bubble up, since the pointer returning from the panel re-arms the show. The two are read apart, not through `_activeMessage()`: disabling a tooltip whose text is still empty leaves `_activeMessage()` at `''`, which does not notify, so a show armed before the text loaded would survive the disable. While enabled it re-runs only when the trimmed text changes (`''` → `'   '` is no change): a show armed while the text was empty stays armed, and text arriving inside the delay shows. While disabled every re-run clears. `_show()`'s disabled check is defensive only — nothing reaches it disabled — and kept with its spec as an end-to-end pin.
- **Re-fit after the text renders:** a constructor `afterRenderEffect` reads `mlvTooltip()` and calls `overlayRef.updatePosition()`. CDK's flex bounding box keeps the pane anchored at any size (Chromium, Star ↔ Unstar: centre unchanged to 0.01px, bottom edge unchanged), but the side was chosen for the old size and only a re-fit chooses again: a `top` tooltip over a host at y 215–243 whose text grew to 308px stayed on top and **covered its own host** (y −6–302); re-fitted it flips `bottom` (249–557) and the arrow follows through `positionChanges`. It has to run after render, because CDK measures the pane — as a plain `effect` it measured the old text. Tone and arrow never change the pane's size (the arrow is absolutely positioned), so they do not re-fit. The strategy re-applies the list `_show()` mirrored, so the #180 clearance stands.
- **Not followed:** `tooltipPlacement` and `tooltipDelay` are read when a show starts; so is the direction (no `watchDirection`). None of the three effects touches the description (§ _Description_). The description effect reads `_activeMessage()`; the turning-off effect reads `tooltipDisabled()` and the trimmed `_message()` apart (see _Turning off_); the forwarding effect and the re-fit read the raw `mlvTooltip()` — the panel renders the text as given and the pane is sized by it, and once the tooltip is off there is no panel left to forward to or re-fit.
- **In-repo reach:** the support-inbox Star / Unstar tooltip now updates on click; bubbles whose `[tooltipDisabled]` flips while hovered now hide — `mlv-editor-command-button` (`_disabled()`, e.g. Undo exhausting its history under the pointer), `mlv-speed-dial` action labels (`!showTooltips()`), settings-access and website-builder showcase tooltips.
- **Specs:** `tooltip.spec.ts` → _MlvTooltip — inputs that change while shown_ (text in place and matching the description, re-fit measuring the new text, tone, arrow off / on, disabled while shown then re-hover, empty / whitespace while shown, disabled during a pending show, disabled / emptied and undone inside the delay, the same with the bubble up and the show re-armed, a show armed while empty then disabled and undone inside the delay in either order, text arriving while disabled during a pending show, text arriving inside the delay of a show armed while empty). Each part was ablated and turns exactly its specs red, except `_show()`'s defensive disabled check, which the turning-off effect already covers.

#### Escape

- **Path:** `_show()` subscribes the overlay's `keydownEvents()` (per show; released in `_hide()` through `_overlayTeardowns`). CDK's `OverlayKeyboardDispatcher` is one bubbling `keydown` listener on `<body>` that walks attached overlays **from the top** and stops at the first with an observer — so the subscription is what makes the tooltip reachable at all.
- **`eventPredicate` — only Escape stops here:** the overlay is created with `eventPredicate: (event) => event.type !== 'keydown' || isDismissEscape(event)` (unmodified Escape, `hasModifierKey`). Load-bearing, not a filter: the dispatcher stops at the topmost overlay with **any** observer before an operator in the stream sees the key, so without it a visible tooltip swallowed Enter, Ctrl+S, Shift+Escape meant for the dialog / drawer / popup below (review F1). Non-keydown events pass; the tooltip has no `outsidePointerEvents` observer, so the outside-click dispatcher never asks.
- **Wherever focus is:** a hover-shown tooltip is dismissed by Escape pressed on another element or on `<body>`, not only on the focused host (1.4.13: dismissible without moving pointer hover or keyboard focus).
- **Only the tooltip:** `_onOverlayEscape()` calls `preventDefault()` + `stopPropagation()` and hides; the dispatcher delivers the key to no overlay below. Inside an `MlvDialogService` dialog, drawer, popup or speed-dial, the **first** Escape closes the tooltip and the container stays open; the **second** closes the container. `mlv-menu` excepted: its panel's own `(keydown)` Escape handler (`_onKeydown`) closes it at the element, before `<body>`, and does not stop propagation — so a hover-shown tooltip that is the topmost overlay at `<body>` also hides on that same press. A `document` / `window` `keydown` listener does not see the consumed press.
- **Topmost wins:** an overlay opened **above** the tooltip that subscribes `keydownEvents()` takes Escape first. With focus elsewhere the tooltip stays and takes the next Escape; with focus on the host (a popup opened from it by pointer — `mlv-color-picker-popup`'s swatch, a `[mlvMenuTrigger]` with a tooltip) the host fallback hides it on that same press, as before #319.
- **Every other key passes by:** Enter, Ctrl+S and Escape with Shift / Alt / Ctrl / Meta held fail the predicate and reach the overlay below exactly as before (a popup or drawer still closes on Shift+Escape; `MlvDialogRef.keydownEvents()` consumers still see every non-Escape key). `isComposing` is not guarded yet — the cross-overlay predicate is D16.
- **Host `(keydown.escape)` → `_onEscape()`:** cancels a pending show and, when the tooltip is visible, arms `_escapeFallbackTimer` — a zero-delay task that hides the tooltip if the same press left it on screen. It must not hide synchronously: disposing the overlay there removes it from the dispatcher before the key bubbles to `<body>`, which then hands it to the overlay below — the pre-#319 defect where one Escape closed both the tooltip and its dialog. The fallback covers the two ways a press on the host can leave the tooltip up: an overlay above took the key, or an ancestor stopped its propagation before `<body>` (review F3a / F3d). A task, not a microtask — microtasks run between a trusted event's listeners. `_hide()` clears it. The overlay handler also clears a pending show, so a hover that re-entered the trigger while the tooltip was up does not bring it back.
- **Limit (focus elsewhere only):** an ancestor of the focused element that stops Escape propagation below `<body>` keeps the key from the dispatcher, so a hover-shown tooltip stays — the limit every CDK overlay's Escape has. Before #319 such a tooltip could not be dismissed from the keyboard at all, so no regression; with focus on the host the fallback covers it. No in-repo ancestor stops Escape propagation around a tooltip host.
- **Specs:** `tooltip.spec.ts` → _MlvTooltip — Escape_ (another element / body, consumption, four modifiers, re-entered hover, pending-show cancel, a stacked overlay with focus elsewhere and on the host, an armed fallback dropped when `focusout` hides first (timer count), an ancestor stopping propagation, every other key reaching an overlay below) and _… inside an MlvDialogService dialog_ (real timers: the zoneless scheduler behind `ApplicationRef.whenStable()` races `setTimeout` against `requestAnimationFrame`, so a faked clock never stabilises a service-opened dialog). Each part was ablated and turns exactly its specs red: the predicate (the four modifier specs + the overlay-below spec), the host fallback (the two host-focused specs), the host hide (dialog + consumption), `stopPropagation` (consumption), the pending-show clears, `_hide()`'s fallback clear (the timer-count spec). `speed-dial.spec.ts` pins the two-press dial.
- **Breaking, behaviour only:** [docs/migrations/2026-09-tooltip-escape-dismissal.md](../../docs/migrations/2026-09-tooltip-escape-dismissal.md).
- **CDK overlay:** `flexibleConnectedTo` strategy with `reposition` scroll strategy

#### Description (#321, D12)

- **From init, not from show:** a constructor `afterRenderEffect` registers the trimmed text with CDK's root `AriaDescriber` (`@angular/cdk/a11y`). The host is described from its first client render — focus reaches a described host with no `tooltipDelay` wait, and the description survives hide.
- **Appends, never replaces:** `AriaDescriber` adds one `cdk-describedby-message-<APP_ID>-<n>` id to whatever `aria-describedby` the host carries and removes only that id; with nothing left the attribute is removed. It also stamps `cdk-describedby-host` on the host. Before, `_show()` overwrote the attribute with the panel id and `_hide()` deleted it — one hover cost `mlv-editor-ai-review-bar`'s accept/reject buttons their suggestion description for good.
- **Where the text lives:** one visually hidden `<div>` per distinct text in `.cdk-describedby-message-container` on `<body>`, reference-counted across hosts (two hosts with the same text share it; it goes when the last one does). The panel (`mlv-tooltip-panel`) is `aria-hidden="true"`: the visual copy, so the text is in the tree once. It keeps `role="tooltip"` and its `mlv-tooltip-*` id, which nothing references.
- **When there is none:** empty / whitespace-only text, `tooltipDisabled`, or an `aria-label` that already equals the text (`mlv-editor-command-button`, the editor zoom / link / table / image / more-formatting / AI-menu buttons, the AI review bar's previous / next / accept / reject icon buttons, the speed-dial actions, `mlv-hint`'s trigger and the colour-picker popup's swatch) → no id is added.
- **`aria-label` comparison — attribute only, snapshot:** `AriaDescriber` compares the text with the `aria-label` **attribute** only — not `aria-labelledby`, text content or `title` — so a host named another way whose tooltip repeats its name is described by its own name (drop the tooltip; the review bar's _Stop generating_ lost its for that reason). The comparison runs when `describe()` does, and the effect re-runs only on the text / `tooltipDisabled`: a label equal to the text at registration that later changes leaves the host **never** described; one that later becomes equal keeps a repeating description.
- **Registration waits for the view's first refresh:** a view detached (`ChangeDetectorRef.detach()`) before its first change detection never describes its host (the bubble still shows); inside `@defer (hydrate on …)` the description arrives when the block hydrates.
- **Reactive:** the effect re-runs on the text and on `tooltipDisabled` (through `_activeMessage()`); its cleanup removes the previous text's id first, and runs on destroy. The #346 effects (see _While shown_) forward content / tone / arrow to a **visible** panel, take it down and drop a pending show, and never call `describe` / `removeDescription` — the description already follows.
- **Why `afterRenderEffect`:** it runs after a host binding on the same element — a co-hosted directive's, or the host component's own (`mlv-radio-group`, `fieldset[mlvFieldset]`). Angular writes an element's host bindings after the effects of the view the element sits in, so from a plain `effect()` the token was appended first and then overwritten by that binding on the first render (a template `[attr.aria-describedby]` is written before the view's effects either way; the same order holds for the `aria-label` comparison). And it is a no-op on the server. Measured with a plain `effect()`: `AriaDescriber` ids carry a per-process counter and the client deletes the server's `[platform="server"]` container, so a host with **no** own `aria-describedby` hydrated as `cdk-describedby-message-ng-1-3 cdk-describedby-message-ng-5-7`, the first dangling (`aria-valid-attr-value`). A static own attribute hid it, because hydration re-applies it.
- **Limit — an `aria-describedby` rewritten after the first render** (template or host binding) replaces the whole attribute and drops the tooltip's id until the text or `tooltipDisabled` changes (Angular writes the bound value verbatim), and the dropped text's hidden element **leaks**: its reference is never released, so it stays in the container after the host is destroyed. A constant binding is fine (written before the effect); a consumer writes the attribute statically or binds a constant. Two library hosts rewrite it themselves, so that advice cannot be followed there: `mlv-radio-group` (its `description` / `message` ids — measured: `Pick one plan` → `message="Required"` → `Required` only; element leaked after destroy) and `fieldset[mlvFieldset]` (its `description` id). Use their own `description` for help text. No in-repo template puts a tooltip on either. Angular Material's `MatTooltip` registers through the same `AriaDescriber` and shares the limit; the fix (merging with the host's own references, which means observing the attribute) is #529.
- **Specs:** `tooltip.spec.ts` → _MlvTooltip — description_ (init, focus with no wait, own description kept while shown / after hide, exact restore on destroy, attribute removed when it was the only id, text change while hidden, `tooltipDisabled` round trip, empty / whitespace, `aria-label` equality, shared text across hosts, `aria-hidden` panel, an `aria-describedby` written by a co-hosted directive's or the host component's own host binding — the client pin for `afterRenderEffect`, both red under `effect`) and its `axe` block (idle, shown with / without arrow, disabled, empty); `tooltip-ssr.spec.ts` (real `renderApplication` → `provideClientHydration` round trip: no `cdk-describedby` in server markup, every id resolving after hydration on a host with and without its own attribute — ablating `afterRenderEffect` to `effect` turns both red). `editor-ai-review-bar.spec.ts` pins the live clobber and the _Stop generating_ button carrying no tooltip.
- **Breaking:** [docs/migrations/2026-09-tooltip-description-from-init.md](../../docs/migrations/2026-09-tooltip-description-from-init.md).

#### Direction

`TOOLTIP_POSITIONS` is logical throughout: `originX` / `overlayX` are
`'start'` / `'end'`, so `tooltipPlacement="left"` renders to the trigger's
**right** in RTL, and `resolvePlacementFromPosition()` re-derives the arrow from
the pair CDK actually resolved.

The 6px arrow clearance is `offsetX`, and CDK does **not** mirror that:
`FlexibleConnectedPositionStrategy` returns it verbatim from `_getOffset()` and
applies it as `x += offsetX` and `transform: translateX(${offsetX}px)`, with no
`_isRtl()` on that path. So the mirrored `left` tooltip kept being pulled 6px
further left — the clearance became a 6px overlap (#180). `_show()` now passes
the list through `mlvMirrorInlineOffsets(positions, direction)`
(`@malva-ui/cdk/utils`) using the same direction it gives
`Overlay.create({ direction })`, so the half CDK mirrors and the half it does not
resolve against one value. `offsetY` on `top` / `bottom` is the block axis and is
untouched.

The direction is resolved once per `_show()`, from
`MlvRtlService.resolveDirection(host)` — so a scoped `[dir]` above the trigger
governs, not the document. There is no `watchDirection`: a tooltip's lifetime is
one hover, and it is disposed and rebuilt on the next.

Pinned by `tooltip.spec.ts` → _MlvTooltip — inline offsets_, which reads the
pane's own `transform` (composed from `offsetX` alone, so jsdom's absent layout
does not enter into it) under a global flip, a scoped `[dir="rtl"]` with the
document still LTR, and an LTR island inside an RTL document.

---

## Components

### `MlvTooltipPanel` (internal)

**File:** `libs/core/tooltip/src/lib/tooltip/tooltip-panel.ts`
**Selector:** `mlv-tooltip-panel`
**Change Detection:** `OnPush` | **Encapsulation:** `None`

Created programmatically by `MlvTooltip`. Not intended for direct consumer use.

#### Inputs

| Name        | Type                  | Description                                                    |
| ----------- | --------------------- | -------------------------------------------------------------- |
| `content`   | `string` (required)   | Tooltip text                                                   |
| `tone`      | `MlvTooltipTone`      | Tone variant (default `'neutral'`)                             |
| `showArrow` | `boolean`             | Whether the arrow is visible                                   |
| `placement` | `MlvTooltipPlacement` | Drives arrow direction CSS class                               |
| `tooltipId` | `string` (required)   | Unique `id` stamped on the panel; nothing references it (#321) |

#### Accessibility

- Host `mlv-tooltip-panel` is `aria-hidden="true"` — the visual copy of the text; the trigger is described by `AriaDescriber`'s hidden element (#321)
- Inner `div` keeps `role="tooltip"` and a unique `id` (DOM / spec hook only)
- Arrow `span` has `aria-hidden="true"`
- Tooltip is not focusable (no interactive elements)

---

## CSS Classes

| Class                            | Description                                             |
| -------------------------------- | ------------------------------------------------------- |
| `.mlv-tooltip`                   | Root block — background, color, radius, padding, shadow |
| `.mlv-tooltip__content`          | Text content wrapper                                    |
| `.mlv-tooltip__arrow`            | CSS border-trick arrow element                          |
| `.mlv-tooltip--tone-{name}`      | Tone variant modifier                                   |
| `.mlv-tooltip--no-arrow`         | Hides the arrow element                                 |
| `.mlv-tooltip--placement-{side}` | Drives arrow position (top/bottom/left/right)           |

## CSS Custom Properties

| Property              | Default                          | Description                                     |
| --------------------- | -------------------------------- | ----------------------------------------------- |
| `--mlv-tt-bg`         | `var(--mlv-palette-neutral-900)` | Tooltip background (overridden by tone variant) |
| `--mlv-tt-color`      | `var(--mlv-text-inverse)`        | Tooltip text color (overridden by tone variant) |
| `--mlv-tt-arrow-size` | `0.375rem`                       | Arrow triangle size                             |

---

## Tone Variants

| `tooltipTone`       | Background                   | Text                             |
| ------------------- | ---------------------------- | -------------------------------- |
| `neutral` (default) | `--mlv-palette-neutral-900`  | `--mlv-text-primary-on-accent-1` |
| `surface`           | `--mlv-background-base`      | `--mlv-text-primary`             |
| `primary`           | `--mlv-background-accent-1`  | `--mlv-text-primary-on-accent-1` |
| `success`           | `--mlv-background-success-1` | `--mlv-text-on-success`          |
| `warning`           | `--mlv-background-warning-1` | `--mlv-text-on-warning`          |
| `danger`            | `--mlv-background-danger-1`  | `--mlv-text-on-danger`           |
| `info`              | `--mlv-background-info-1`    | `--mlv-text-on-info`             |

---

## Usage Examples

```html
<!-- Basic -->
<button [mlvTooltip]="'Save changes'">Save</button>

<!-- Placement -->
<button [mlvTooltip]="'Bottom tooltip'" tooltipPlacement="bottom">Open</button>

<!-- Tone -->
<button [mlvTooltip]="'Danger action'" tooltipTone="danger">Delete</button>

<!-- Delay -->
<button [mlvTooltip]="'Appears after 500ms'" [tooltipDelay]="500">Hover me</button>

<!-- No arrow -->
<button [mlvTooltip]="'No arrow'" [tooltipArrow]="false">Button</button>

<!-- Disabled -->
<button [mlvTooltip]="'Hidden'" [tooltipDisabled]="isDisabled">Button</button>

<!-- Icon-only button (accessibility) -->
<button mlvButton shape="circle" aria-label="Delete" [mlvTooltip]="'Delete item'" tooltipTone="danger">
  <svg lucideTrash2 [size]="16" />
</button>
```

---

## Dependencies

| Package                 | Version   | Role                                                   |
| ----------------------- | --------- | ------------------------------------------------------ |
| `@angular/core`         | `^22.0.0` | Signals, DI, directive                                 |
| `@angular/cdk/overlay`  | `^22.0.0` | CDK overlay positioning                                |
| `@angular/cdk/portal`   | `^22.0.0` | `ComponentPortal`                                      |
| `@angular/cdk/coercion` | `^22.0.0` | `BooleanInput`, `coerceBooleanProperty`                |
| `@angular/cdk/a11y`     | `^22.0.0` | `AriaDescriber` — the host's description (#321)        |
| `@angular/cdk/keycodes` | `^22.0.0` | `hasModifierKey` — the Escape predicate                |
| `@malva-ui/cdk/utils`   | workspace | `MlvRtlService`, `mlvMirrorInlineOffsets`, `mlvNextId` |

---

## File Structure

```
libs/core/tooltip/src/
  index.ts                              — public API barrel
  lib/
    tooltip/
      tooltip.ts             — MlvTooltip ([mlvTooltip])
      tooltip-panel.ts             — MlvTooltipPanel (mlv-tooltip-panel)
      tooltip-panel.scss           — BEM styles, tone variants, arrow
      tooltip.types.ts                 — MlvTooltipTone, MlvTooltipPlacement
      tooltip.spec.ts        — unit tests (+ axe sweeps)
      tooltip-ssr.spec.ts    — server render → hydration round trip of the description
```
