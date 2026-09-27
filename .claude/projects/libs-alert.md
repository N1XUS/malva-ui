---
# Library: alert

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

`@malva-ui/core/alert` provides an inline feedback banner component (`mlv-alert`) for displaying contextual messages with four semantic tones. The host is a live region whose role follows the tone (`alert` for `danger` / `warning`, `status` for `info` / `success`). Supports a dismissible mode that moves focus out of the alert before hiding it, an outlined variant, a custom icon slot, and separate content-projection slots for title and description.

---

## Public API

Exported from `libs/core/alert/src/index.ts`:

| Export                | Kind      | Description                                                                               |
| --------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `MlvAlert`            | Component | `mlv-alert` — inline feedback banner                                                      |
| `MlvAlertIcon`        | Directive | `[mlvAlertIcon]` — custom icon slot                                                       |
| `MlvAlertTitle`       | Directive | `[mlvAlertTitle]` — title slot                                                            |
| `MlvAlertFocusTarget` | Interface | `{ focus(options?: FocusOptions): void }` — type of the `dismissFocusTarget` input (#333) |

The `tone` input is typed with the shared `MlvTone` type from `@malva-ui/cdk/utils` (`'info' \| 'success' \| 'warning' \| 'danger'`) — alert no longer declares its own tone type.

---

## Components

### `MlvAlert`

**File:** `libs/core/alert/src/lib/alert/alert.ts`
**Selector:** `mlv-alert` | **Change Detection:** `OnPush` | **Encapsulation:** `None`

#### Inputs

| Name                 | Type                                       | Default  | Description                                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tone`               | `MlvTone`                                  | `'info'` | Semantic tone: colour scheme, default icon **and live role** (`danger` / `warning` → `role="alert"`, `info` / `success` → `role="status"`)                                                                                                                              |
| `dismissible`        | `BooleanInput`                             | `false`  | Renders a dismiss button; supports attribute syntax `<mlv-alert dismissible>`. Dismissing moves focus out first when it is inside (see _Focus on dismiss_)                                                                                                              |
| `outlined`           | `BooleanInput`                             | `false`  | Transparent background; the tone border and icon colour stay. Attribute syntax `<mlv-alert outlined>`                                                                                                                                                                   |
| `dismissFocusTarget` | `MlvAlertFocusTarget \| null \| undefined` | `null`   | Where focus goes on dismiss when focus is inside the alert: an element, or a component with a public `focus()` (`mlv-input`, `mlv-checkbox`, …) that moves focus synchronously. Falls back to the next / previous tabbable when it refuses or has no callable `focus()` |

#### Outputs

| Name        | Type   | Description                                                                                                                         |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `dismissed` | `void` | Emits when the user clicks the dismiss button. Focus has already left the alert by then; a handler that focuses something else wins |

#### Host Bindings

```ts
host: {
  class: 'mlv-alert',
  '[class]': '"mlv-alert--tone-" + tone()',
  '[class.mlv-alert--dismissed]': '_dismissed()',
  '[class.mlv-alert--outlined]': 'outlined()',
  '[attr.role]': '_role()', // 'alert' | 'status' by tone; a static author role wins
  '[attr.hidden]': '_dismissed() || null',
}
```

No `aria-live` is written: the role carries the politeness (`alert` → assertive, `status` → polite, both `aria-atomic="true"` implicitly). Until #333 the host carried `role="alert"` on every tone **plus** `aria-live="polite"`; Chromium exposed that as `live: polite` on every tone (CDP AX tree) while screen readers that key on the alert role treated it as assertive. Migration: `docs/migrations/2026-09-alert-live-role-by-tone.md`.

#### Content Projection

| Slot        | Directive         | Description                                                                |
| ----------- | ----------------- | -------------------------------------------------------------------------- |
| Icon        | `[mlvAlertIcon]`  | Custom icon inside `<ng-template>`; overrides the default Lucide tone icon |
| Title       | `[mlvAlertTitle]` | Title text inside `<ng-template>`; rendered above the description          |
| Description | (default)         | Main message content projected via `<ng-content />`                        |

---

## Directives

### `MlvAlertIcon`

**File:** `libs/core/alert/src/lib/alert/alert.directives.ts`
**Selector:** `[mlvAlertIcon]`

Marks an `<ng-template>` slot for a custom icon. The parent `MlvAlert` queries this via `contentChild(MlvAlertIcon)`.

### `MlvAlertTitle`

**File:** `libs/core/alert/src/lib/alert/alert.directives.ts`
**Selector:** `[mlvAlertTitle]`

Marks an `<ng-template>` slot for a title heading rendered above the description content.

---

## Types

The `tone` input uses the shared `MlvTone` type re-exported from `@malva-ui/cdk/utils`:

```ts
export type MlvTone = 'info' | 'success' | 'warning' | 'danger';
```

Alert's tone vocabulary matches `MlvTone` exactly, so it does not declare a component-local type.

```ts
/** Anything `dismissFocusTarget` accepts: an element, or a component with a public focus(). */
export interface MlvAlertFocusTarget {
  /** Must move focus synchronously. `{ preventScroll: true }` on a pointer dismiss. */
  focus(options?: FocusOptions): void;
}
```

`HTMLElement` satisfies it structurally, and so does a component whose `focus()` takes no options (it then scrolls either way). `focus()` must move focus **synchronously** — the alert reads the document right after the call; a deferred move reads as refused, the fallback runs, and focus moves twice. A template reference to a component **without** `focus()` — `button[mlvButton]`, `mlv-select`, `mlv-textarea`, `mlv-number-input`, `mlv-combobox`, the date / time pickers — resolves to the component instance: strict templates reject it (TS2322), and at run time the alert skips it and uses the fallback. Pass the element (`viewChild('ref', { read: ElementRef })` → `.nativeElement`) there. `mlv-input`, `mlv-checkbox`, `mlv-switch` and `mlv-radio` expose `focus()`.

---

## CSS Classes

| Class                     | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| `.mlv-alert`              | Root block — flex row, border, background                    |
| `.mlv-alert__icon`        | Icon container (aria-hidden)                                 |
| `.mlv-alert__body`        | Column container for title + description                     |
| `.mlv-alert__title`       | Title text (semibold)                                        |
| `.mlv-alert__description` | Description content                                          |
| `.mlv-alert__dismiss`     | Dismiss button (`mlv-button-close`, tight density)           |
| `.mlv-alert--tone-{name}` | Tone color modifier (`info`, `success`, `warning`, `danger`) |
| `.mlv-alert--outlined`    | Transparent background (the `outlined` input)                |
| `.mlv-alert--dismissed`   | Added after dismiss; hides the alert via `display: none`     |

## CSS Custom Properties

Declared on `.mlv-alert` with the `info` values, then re-declared by each `--tone-*` modifier. The title uses `--mlv-alert-color`; the description is always `--mlv-text-secondary`.

| Property                 | Default (`info`)                                              | Description                            |
| ------------------------ | ------------------------------------------------------------- | -------------------------------------- |
| `--mlv-alert-bg`         | `color-mix(in srgb, var(--mlv-border-info) 8%, transparent)`  | Alert background; overridden by tone   |
| `--mlv-alert-color`      | `var(--mlv-text-primary)`                                     | Title text color; overridden by tone   |
| `--mlv-alert-border`     | `color-mix(in srgb, var(--mlv-border-info) 30%, transparent)` | Alert border color; overridden by tone |
| `--mlv-alert-icon-color` | `var(--mlv-text-info)`                                        | Icon and dismiss glyph color           |

---

## Tone Color Mapping

Background and border are `color-mix(in srgb, <border token> N%, transparent)` — 8% for the fill, 30% for the border. `outlined` drops the fill and keeps the rest.

| `tone`    | Mixed border token     | Text token           | Icon token            | Role     |
| --------- | ---------------------- | -------------------- | --------------------- | -------- |
| `info`    | `--mlv-border-info`    | `--mlv-text-primary` | `--mlv-text-info`     | `status` |
| `success` | `--mlv-border-success` | `--mlv-text-primary` | `--mlv-text-positive` | `status` |
| `warning` | `--mlv-border-warning` | `--mlv-text-primary` | `--mlv-text-warning`  | `alert`  |
| `danger`  | `--mlv-border-error`   | `--mlv-text-primary` | `--mlv-text-negative` | `alert`  |

---

## Default Icons Per Tone

| `tone`    | Lucide icon           |
| --------- | --------------------- |
| `info`    | `LucideInfo`          |
| `success` | `LucideCheckCircle`   |
| `warning` | `LucideTriangleAlert` |
| `danger`  | `LucideCircleX`       |

---

## Usage Examples

```html
<!-- Basic info alert -->
<mlv-alert tone="info">Your session will expire in 5 minutes.</mlv-alert>

<!-- Success with title -->
<mlv-alert tone="success">
  <ng-template mlvAlertTitle>Upload complete</ng-template>
  Your file has been uploaded and is ready to use.
</mlv-alert>

<!-- Warning, dismissible -->
<mlv-alert tone="warning" dismissible (dismissed)="onDismissed()"> You are running low on storage. </mlv-alert>

<!-- Danger with title and dismiss -->
<mlv-alert tone="danger" dismissible>
  <ng-template mlvAlertTitle>Payment failed</ng-template>
  Your card was declined. Please update your payment method.
</mlv-alert>

<!-- Custom icon -->
<mlv-alert tone="info">
  <ng-template mlvAlertIcon><svg lucideRocket [size]="18" /></ng-template>
  A new version is available.
</mlv-alert>
```

---

## Accessibility

- **Live role by tone** (owner ruling D25, #333): `danger` / `warning` → `role="alert"` (implicitly assertive, atomic); `info` / `success` → `role="status"` (implicitly polite, atomic). No explicit `aria-live`. Measured in Chromium (CDP `Accessibility.getPartialAXTree`): `status` → `live: polite`, `alert` → `live: assertive`, `atomic: true` on both. A tone change on a rendered alert flips the role.
- A live region announces **changes** to its content. Whether a region inserted already filled is announced depends on the screen reader: `role="alert"` insertion raises an alert event, a `status` inserted with its text may stay silent. An `info` / `success` confirmation that must be heard is rendered empty (or kept rendered) and filled, or announced through `LiveAnnouncer`.
- A **static** `role` written on `<mlv-alert>` (`role="note"`, `role="none"`) is kept as written, as it was when the role was a static host attribute (read through `HostAttributeToken('role')`). A bound `[attr.role]` on the host competes with the host binding — write it statically.
- Icon area is `aria-hidden="true"` — purely decorative.
- Dismiss button has `aria-label="Dismiss alert"` (`MLV_ALERT_I18N.dismiss`).
- `[attr.hidden]` is set on the host after dismiss so the element is removed from the accessibility tree. A dismissed alert cannot be shown again; a consumer that needs that renders it under `@if` and re-creates it.
- Dismiss button has `:focus-visible` ring using `--mlv-border-focus`.

### Focus on dismiss

When focus is inside the alert at dismiss (keyboard activation, or a pointer click in Chromium / Firefox, which focus the button), `_onDismiss()` moves it **before** hiding and before `dismissed` emits:

1. `dismissFocusTarget`, when set, has a callable `focus()` and it actually takes focus;
2. else each tabbable element **after** the host in its root, nearest first (the alert's own subtree rejected, so its controls never receive `focus`);
3. else each tabbable element **before** it;
4. else, when that root is a shadow root, steps 2–3 again around its shadow host in the root above, up to the document;
5. else nowhere — the browser moves focus off the hidden button.

Candidates come from a `TreeWalker` filtered by CDK `InteractivityChecker` (`isFocusable` with `ignoreVisibility` + `isTabbable`). Whether one "takes focus" is read back from the document after `focus()`, not predicted: a hidden, `display: none`, inert, disabled, fieldset-disabled or detached candidate refuses and the next is tried (measured in Chromium, Firefox and WebKit). Focus that is not inside the alert (a WebKit mouse click, which does not focus buttons; a scripted `click()`) is left alone. A target whose `focus()` throws is reported to the injected `ErrorHandler` and treated as refused: the walk runs, focus lands on the next tabbable, then the alert hides and `dismissed` emits. A target with no callable `focus()` is skipped without a report.

**Pointer vs keyboard.** `_onDismiss($event)` reads the click's `detail`: `> 0` (mouse, touch) → every `focus()` gets `{ preventScroll: true }`; `0` (Enter, Space and scripted `el.click()`, measured in Chromium, Firefox and WebKit) → no options, the new focus scrolls into view as Tab would. An assistive-technology activation that arrives as a pointer click moves focus without scrolling; `detail` never decides whether focus moves. Measured with a 3000px gap before the next tabbable (Chromium / Firefox): pointer 875 → 875 / 889 → 889 (875 → 3902 / 889 → 3916 with `preventScroll` removed), keyboard 875 → 3902 / 889 → 3916; no focus ring after the pointer path. The pointer path still fires `focus` / `focusin` on the landing element, so an `[mlvTooltip]` there, or a `mlvPopupTrigger` with `triggerOn="focus"`, opens for a mouse user — point `dismissFocusTarget` at a calmer element when that matters. Moving rather than skipping on the pointer path is deliberate: a pointer-style activation from assistive technology would otherwise leave focus on `<body>`.

Not bounded by a modal: in a dialog whose only other tabbable is the close button, the walk can leave the dialog's focus region (follow-up). The outer shadow-root pass visits the shadow host's light children (slotted content) first, wherever their `<slot>` sits, so "next" there can be an element rendered before the alert — rare, since library components use `ViewEncapsulation.None`.

Why synchronous and first: before #333 focus fell to `<body>` two frames after Enter (Chromium) — on the alert's own hide, on a consumer removing it from `(dismissed)`, and at the end of an `animate.leave` (focus stayed on the fading close button meanwhile). Deferring the move to an after-render hook loses it on the removal path, because the alert's hooks die with it. Moving first also means a `(dismissed)` handler that focuses something itself wins.

---

## Dependencies

| Package                 | Version   | Role                                                                      |
| ----------------------- | --------- | ------------------------------------------------------------------------- |
| `@angular/core`         | `^22.0.0` | Signals, DI, component, directives                                        |
| `@angular/common`       | `^22.0.0` | `NgTemplateOutlet`                                                        |
| `@angular/cdk/coercion` | `^22.0.0` | `BooleanInput`, `coerceBooleanProperty`                                   |
| `@angular/cdk/a11y`     | `^22.0.0` | `InteractivityChecker` — filters the focus-on-dismiss candidates          |
| `@lucide/angular`       | `*`       | `LucideInfo`, `LucideCheckCircle`, `LucideTriangleAlert`, `LucideCircleX` |
| `@malva-ui/core/button` | workspace | `MlvButtonClose` — the dismiss button                                     |
| `@malva-ui/i18n`        | workspace | `MLV_ALERT_I18N` — the dismiss button's `aria-label`                      |

---

## File Structure

```
libs/core/alert/src/
  index.ts                                    — public API barrel
  test-setup.ts                               — Vitest setup
  lib/
    alert/
      alert.ts                      — MlvAlert (mlv-alert), MlvAlertFocusTarget
      alert.html                    — template
      alert.scss                    — BEM styles + tone variants
      alert.directives.ts           — MlvAlertIcon, MlvAlertTitle
      alert.spec.ts                 — unit tests (role per tone, author role, axe per tone)
      alert-dismiss-focus.spec.ts   — focus on dismiss (#333): order, target guards, read-back, preventScroll, shadow root
```
