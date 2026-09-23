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
| `mlvTooltip`       | `string` (required)   | —           | Tooltip text content                                                                                                   |
| `tooltipPlacement` | `MlvTooltipPlacement` | `'top'`     | Preferred placement; CDK flips to opposite if no viewport space. `'left'` / `'right'` are logical — they mirror in RTL |
| `tooltipTone`      | `MlvTooltipTone`      | `'neutral'` | Tone variant of the tooltip panel                                                                                      |
| `tooltipDelay`     | `number`              | `300`       | Milliseconds before tooltip appears after hover/focus                                                                  |
| `tooltipDisabled`  | `BooleanInput`        | `false`     | Suppresses the tooltip entirely                                                                                        |
| `tooltipArrow`     | `BooleanInput`        | `true`      | Shows/hides the directional arrow                                                                                      |

#### Behavior

- **Show:** `mouseenter` or `focusin` → schedule after `tooltipDelay` ms
- **Hide:** `focusout` or `Escape` → immediate — except on the host-fallback path (an overlay above took the key, or an ancestor stopped it; see _Escape_), where the hide lands one task later. `mouseleave` → hides after a ~150 ms grace period so the pointer can travel onto the tooltip panel.
- **Hoverable (WCAG 1.4.13):** while visible, `mouseenter` on the tooltip panel cancels the pending hide and `mouseleave` on the panel re-schedules it, so the tooltip stays open while the pointer is over it. Panel hover listeners are attached with `Renderer2.listen` in `_show()` and torn down in `_hide()`.
- **Escape — dismissible, and only the tooltip (WCAG 1.4.13, D13, #319):** see _Escape_ below.

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
- **Accessibility:** sets `aria-describedby` on the host pointing to the tooltip panel `id` while visible; removes it on hide
- **CDK overlay:** `flexibleConnectedTo` strategy with `reposition` scroll strategy

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

| Name        | Type                  | Description                        |
| ----------- | --------------------- | ---------------------------------- |
| `content`   | `string` (required)   | Tooltip text                       |
| `tone`      | `MlvTooltipTone`      | Tone variant (default `'neutral'`) |
| `showArrow` | `boolean`             | Whether the arrow is visible       |
| `placement` | `MlvTooltipPlacement` | Drives arrow direction CSS class   |
| `tooltipId` | `string` (required)   | Unique `id` for `aria-describedby` |

#### Accessibility

- Host `div` has `role="tooltip"` and a unique `id`
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
      tooltip.spec.ts        — unit tests
```
