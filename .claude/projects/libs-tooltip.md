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
| `MlvTooltipPlacement` | Type | `'top' \| 'bottom' \| 'left' \| 'right'` |

---

## Directives

### `MlvTooltip`

**File:** `libs/core/tooltip/src/lib/tooltip/tooltip.ts`
**Selector:** `[mlvTooltip]`

The primary consumer API. Attach to any element — button, icon, input, etc.

#### Inputs

| Name               | Type                  | Default  | Description                                                     |
| ------------------ | --------------------- | -------- | --------------------------------------------------------------- |
| `mlvTooltip`       | `string` (required)   | —        | Tooltip text content                                            |
| `tooltipPlacement` | `MlvTooltipPlacement` | `'top'`  | Preferred placement; CDK flips to opposite if no viewport space |
| `tooltipTone`      | `MlvTooltipTone`      | `'neutral'` | Tone variant of the tooltip panel                               |
| `tooltipDelay`     | `number`              | `300`    | Milliseconds before tooltip appears after hover/focus           |
| `tooltipDisabled`  | `BooleanInput`        | `false`  | Suppresses the tooltip entirely                                 |
| `tooltipArrow`     | `BooleanInput`        | `true`   | Shows/hides the directional arrow                               |

#### Behavior

- **Show:** `mouseenter` or `focusin` → schedule after `tooltipDelay` ms
- **Hide:** `focusout` or `Escape` key → immediate. `mouseleave` → hides after a ~150 ms grace period so the pointer can travel onto the tooltip panel.
- **Hoverable (WCAG 1.4.13):** while visible, `mouseenter` on the tooltip panel cancels the pending hide and `mouseleave` on the panel re-schedules it, so the tooltip stays open while the pointer is over it. Panel hover listeners are attached with `Renderer2.listen` in `_show()` and torn down in `_hide()`.
- **Accessibility:** sets `aria-describedby` on the host pointing to the tooltip panel `id` while visible; removes it on hide
- **CDK overlay:** `flexibleConnectedTo` strategy with `reposition` scroll strategy

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
| `tone`      | `MlvTooltipTone`      | Tone variant (default `'neutral'`)    |
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

| `tooltipTone`    | Background                   | Text                             |
| ---------------- | ---------------------------- | -------------------------------- |
| `neutral` (default) | `--mlv-palette-neutral-900`  | `--mlv-text-primary-on-accent-1` |
| `surface`           | `--mlv-background-base`      | `--mlv-text-primary`             |
| `primary`        | `--mlv-background-accent-1`  | `--mlv-text-primary-on-accent-1` |
| `success`        | `--mlv-background-success-1` | `--mlv-text-on-success`          |
| `warning`        | `--mlv-background-warning-1` | `--mlv-text-on-warning`          |
| `danger`         | `--mlv-background-danger-1`  | `--mlv-text-on-danger`           |
| `info`           | `--mlv-background-info-1`    | `--mlv-text-on-info`             |

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

| Package                 | Version   | Role                                    |
| ----------------------- | --------- | --------------------------------------- |
| `@angular/core`         | `^22.0.0` | Signals, DI, directive                  |
| `@angular/cdk/overlay`  | `^22.0.0` | CDK overlay positioning                 |
| `@angular/cdk/portal`   | `^22.0.0` | `ComponentPortal`                       |
| `@angular/cdk/coercion` | `^22.0.0` | `BooleanInput`, `coerceBooleanProperty` |
| `uuid`                  | `^13.0.0` | Unique tooltip ID generation            |

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
