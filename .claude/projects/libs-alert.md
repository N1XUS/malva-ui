---
# Library: alert

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

`@malva-ui/core/alert` provides an inline feedback banner component (`mlv-alert`) for displaying contextual messages with four semantic tones. Supports a dismissible mode with an animated close button, a custom icon slot, and separate content-projection slots for title and description.

---

## Public API

Exported from `libs/core/alert/src/index.ts`:

| Export          | Kind      | Description                          |
| --------------- | --------- | ------------------------------------ |
| `MlvAlert`      | Component | `mlv-alert` — inline feedback banner |
| `MlvAlertIcon`  | Directive | `[mlvAlertIcon]` — custom icon slot  |
| `MlvAlertTitle` | Directive | `[mlvAlertTitle]` — title slot       |

The `tone` input is typed with the shared `MlvTone` type from `@malva-ui/cdk/utils` (`'info' \| 'success' \| 'warning' \| 'danger'`) — alert no longer declares its own tone type.

---

## Components

### `MlvAlert`

**File:** `libs/core/alert/src/lib/alert/alert.ts`
**Selector:** `mlv-alert` | **Change Detection:** `OnPush` | **Encapsulation:** `None`

#### Inputs

| Name          | Type           | Default  | Description                                                                   |
| ------------- | -------------- | -------- | ----------------------------------------------------------------------------- |
| `tone`        | `MlvTone`      | `'info'` | Semantic tone controlling color scheme and default icon                       |
| `dismissible` | `BooleanInput` | `false`  | Renders a dismiss button; supports attribute syntax `<mlv-alert dismissible>` |

#### Outputs

| Name        | Type   | Description                                   |
| ----------- | ------ | --------------------------------------------- |
| `dismissed` | `void` | Emits when the user clicks the dismiss button |

#### Host Bindings

```ts
host: {
  class: 'mlv-alert',
  '[class]': '"mlv-alert--tone-" + tone()',
  '[class.mlv-alert--dismissed]': '_dismissed()',
  'role': 'alert',
  '[attr.aria-live]': '"polite"',
  '[attr.hidden]': '_dismissed() || null',
}
```

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

---

## CSS Classes

| Class                     | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| `.mlv-alert`              | Root block — flex row, border, background                    |
| `.mlv-alert__icon`        | Icon container (aria-hidden)                                 |
| `.mlv-alert__body`        | Column container for title + description                     |
| `.mlv-alert__title`       | Title text (semibold)                                        |
| `.mlv-alert__description` | Description content                                          |
| `.mlv-alert__dismiss`     | Dismiss button                                               |
| `.mlv-alert--tone-{name}` | Tone color modifier (`info`, `success`, `warning`, `danger`) |
| `.mlv-alert--dismissed`   | Added after dismiss; hides the alert via `display: none`     |

## CSS Custom Properties

| Property                 | Default                        | Description                            |
| ------------------------ | ------------------------------ | -------------------------------------- |
| `--mlv-alert-bg`         | `var(--mlv-background-info-2)` | Alert background; overridden by tone   |
| `--mlv-alert-color`      | `var(--mlv-text-on-info)`      | Alert text color; overridden by tone   |
| `--mlv-alert-border`     | `var(--mlv-border-info)`       | Alert border color; overridden by tone |
| `--mlv-alert-icon-color` | `var(--mlv-text-on-info)`      | Icon color; overridden by tone         |

---

## Tone Color Mapping

| `tone`    | Background token             | Text token              | Border token           |
| --------- | ---------------------------- | ----------------------- | ---------------------- |
| `info`    | `--mlv-background-info-2`    | `--mlv-text-on-info`    | `--mlv-border-info`    |
| `success` | `--mlv-background-success-2` | `--mlv-text-on-success` | `--mlv-border-success` |
| `warning` | `--mlv-background-warning-2` | `--mlv-text-on-warning` | `--mlv-border-warning` |
| `danger`  | `--mlv-background-danger-2`  | `--mlv-text-on-danger`  | `--mlv-border-danger`  |

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

- Host has `role="alert"` and `aria-live="polite"` for live-region announcement.
- Icon area is `aria-hidden="true"` — purely decorative.
- Dismiss button has `aria-label="Dismiss alert"`.
- `[attr.hidden]` is set on the host after dismiss so the element is removed from the accessibility tree.
- Dismiss button has `:focus-visible` ring using `--mlv-border-focus`.

---

## Dependencies

| Package                 | Version   | Role                                                                                 |
| ----------------------- | --------- | ------------------------------------------------------------------------------------ |
| `@angular/core`         | `^22.0.0` | Signals, DI, component, directives                                                   |
| `@angular/common`       | `^22.0.0` | `NgTemplateOutlet`                                                                   |
| `@angular/cdk/coercion` | `^22.0.0` | `BooleanInput`, `coerceBooleanProperty`                                              |
| `@lucide/angular`       | `*`       | `LucideInfo`, `LucideCheckCircle`, `LucideTriangleAlert`, `LucideCircleX`, `LucideX` |

---

## File Structure

```
libs/core/alert/src/
  index.ts                                    — public API barrel
  test-setup.ts                               — Vitest setup
  lib/
    alert/
      alert.ts                      — MlvAlert (mlv-alert)
      alert.html                    — template
      alert.scss                    — BEM styles + tone variants
      alert.directives.ts                     — MlvAlertIcon, MlvAlertTitle
      alert.spec.ts                 — unit tests
```
