# Library: notification

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, service, styling, testing, or public API changes.

## Overview

`@malva-ui/core/notification` provides richer programmatic notification cards with semantic icons, supporting text, and optional actions. It has two creation APIs:

1. `show(config)` and the `success`/`error`/`warning`/`info`/`tone` shorthands render the standard title/description/actions notification.
2. `open(content, config)` renders an escaped string, a typed `TemplateRef`, or an Angular component while retaining the standard icon, tone, description, actions, timer, position, and dismiss affordance.

Every creation method returns a `MlvNotificationRef<TData>`, which extends the toast library's ref contract. Caller close, dynamic-content close, auto-dismiss, action close, and the built-in dismiss button all route through the shared service-owned lifecycle.

Notification reuses `MlvToastContainer` and `MlvAbstractToastService` from `@malva-ui/core/toast`. Active cards are rendered as a normal linear list; there is no notification-specific container, `maxShownItems` option, or stacked-card layout mode.

---

## Public API

Exported from `libs/core/notification/src/index.ts`:

| Export                                  | Kind            | Description                                                                 |
| --------------------------------------- | --------------- | --------------------------------------------------------------------------- |
| `MlvNotificationService`                | Service         | `show()`, `open()`, tone shorthands, and `close()`; provided in `root`      |
| `MlvNotificationRef<TData>`             | Class           | Data-aware, injectable per-item close/lifecycle handle                      |
| `MlvNotificationContent<TData>`         | Type alias      | Escaped string, typed `TemplateRef`, or component type accepted by `open()` |
| `MlvNotificationOpenConfig<TData>`      | Interface       | Options for content-polymorphic `open()`                                    |
| `MlvNotificationTemplateContext<TData>` | Interface       | `$implicit`, `ref`, `data`, and `config` exposed to template content        |
| `NOTIFICATION_DATA`                     | Injection token | Data available to component content                                         |
| `NOTIFICATION_CONFIG`                   | Injection token | Readonly per-open config available to component content                     |
| `MlvNotificationConfig<TData>`          | Interface       | Standard `show()` config with required `title`                              |
| `MlvNotificationTone`                   | Type alias      | Malva semantic tones plus `'default'`                                       |
| `MlvNotificationAction`                 | Interface       | Label, callback, and optional button variant                                |
| `MlvInternalNotification`               | Interface       | Fully resolved internal item state                                          |
| `MlvNotificationItem`                   | Component       | Notification card rendered inside the shared toast container                |

---

## Service

### `MlvNotificationService`

**File:** `libs/core/notification/src/lib/notification.service.ts`

**Provided in:** `root`

Extends:

```ts
export class MlvNotificationService extends MlvAbstractToastService<MlvNotificationConfig, MlvInternalNotification, MlvIAbstractToastComponent<MlvInternalNotification>, MlvNotificationRef> {}
```

It reuses `MlvToastContainer` and supplies `MlvNotificationItem` as the item renderer.

#### Creation methods

| Method    | Signature                                                                                                                         | Description                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `show`    | `(config: MlvNotificationConfig): MlvNotificationRef`                                                                             | Renders the standard notification card            |
| `open`    | `<TData = unknown>(content: MlvNotificationContent<TData>, config?: MlvNotificationOpenConfig<TData>): MlvNotificationRef<TData>` | Renders string, template, or component content    |
| `success` | `(title: string, config?: Omit<MlvNotificationConfig, 'title' \| 'tone'>): MlvNotificationRef`                                    | Standard card with `success` tone                 |
| `error`   | `(title: string, config?: Omit<MlvNotificationConfig, 'title' \| 'tone'>): MlvNotificationRef`                                    | Standard card with `danger` tone                  |
| `warning` | `(title: string, config?: Omit<MlvNotificationConfig, 'title' \| 'tone'>): MlvNotificationRef`                                    | Standard card with `warning` tone                 |
| `info`    | `(title: string, config?: Omit<MlvNotificationConfig, 'title' \| 'tone'>): MlvNotificationRef`                                    | Standard card with `info` tone                    |
| `tone`    | `(tone: MlvNotificationTone, title: string, config?: Omit<MlvNotificationConfig, 'title' \| 'tone'>): MlvNotificationRef`         | Generic tone shorthand                            |
| `close`   | `(id: string, position?: MlvToastPosition): void`                                                                                 | Closes an item through the shared toast lifecycle |

`show()` and every shorthand remain supported. `open()` adds content polymorphism without replacing the standard API.

#### `open()` content branches

- **String:** normalized to the standard title and rendered through Angular interpolation. HTML-looking input is displayed literally and never inserted as trusted HTML.
- **TemplateRef:** rendered through `NgTemplateOutlet` with `MlvNotificationTemplateContext<TData>`.
- **Component:** rendered through `NgComponentOutlet` with an injector providing `MlvNotificationRef`, its base `MlvToastRef`, `NOTIFICATION_DATA`, and `NOTIFICATION_CONFIG`.

Template/component content replaces the standard title. `description`, tone icon/accent, actions, close button, position, and lifecycle options remain available through `MlvNotificationOpenConfig`.

#### Resolved defaults

| Field          | Default                        |
| -------------- | ------------------------------ |
| `position`     | `'top-right'`                  |
| `tone`         | `'default'`                    |
| `description`  | `''`                           |
| `displayTime`  | `6000` ms                      |
| `pauseOnHover` | `true`                         |
| `closable`     | `true`                         |
| `actions`      | `[]`                           |
| `showIcon`     | `true`                         |
| `politeness`   | `resolveToastPoliteness(tone)` |

#### Close lifecycle

All close sources delegate to `MlvAbstractToastService.close()`. The shared container removes the item, the service completes the matching `MlvNotificationRef`, and an empty position overlay is disposed after the shared `200ms` leave interval. Calling `MlvNotificationRef.close()` repeatedly is safe.

Action callbacks run first and then automatically request close.

#### Announcement

The announcement includes the title, the description, **and every action label** — a
notification never takes focus, so a screen-reader user has to be told that an action
exists at all. Politeness follows `config.politeness`, defaulting to
`resolveToastPoliteness(tone)`. Template and component content is not announced; it owns
its own text.

`LiveAnnouncer` requires the `.cdk-visually-hidden` rules shipped in
`styles/malva-ui.css` — without that stylesheet the announcement renders visibly.

---

## Content, config, and context types

### `MlvNotificationContent<TData = unknown>`

```ts
export type MlvNotificationContent<TData = unknown> = string | TemplateRef<MlvNotificationTemplateContext<TData>> | Type<unknown>;
```

### `MlvNotificationTemplateContext<TData = unknown>`

```ts
export interface MlvNotificationTemplateContext<TData = unknown> {
  $implicit: MlvNotificationRef<TData>;
  ref: MlvNotificationRef<TData>;
  data: TData;
  config: Readonly<MlvNotificationOpenConfig<TData>>;
}
```

`$implicit` and `ref` are the same handle. Templates can use `let-ref`, `let-ref="ref"`, `let-data="data"`, and `let-config="config"`.

### `MlvNotificationAction`

```ts
export interface MlvNotificationAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary';
}
```

### `MlvNotificationConfig<TData = unknown>`

Extends `MlvBaseToastConfig<TData>`:

| Field         | Type                      | Required | Description                                     |
| ------------- | ------------------------- | -------- | ----------------------------------------------- |
| `title`       | `string`                  | yes      | Standard escaped title                          |
| `description` | `string`                  | no       | Supporting text                                 |
| `tone`        | `MlvNotificationTone`     | no       | Semantic icon, border, and announcement urgency |
| `actions`     | `MlvNotificationAction[]` | no       | Buttons rendered below the main row             |
| `showIcon`    | `boolean`                 | no       | Whether the tone icon is shown                  |

It also inherits `position`, typed `data`, `injector`, `displayTime`, `pauseOnHover`, and `closable`.

### `MlvNotificationOpenConfig<TData = unknown>`

Extends `MlvBaseToastConfig<TData>` with optional `description`, `tone`, `actions`, and `showIcon`. It intentionally has no `title`; content is passed separately to `open()`.

---

## Injection tokens

### `NOTIFICATION_DATA`

`InjectionToken<unknown>` containing `MlvNotificationOpenConfig.data` for component content. Templates read the typed value from their `data` context property.

### `NOTIFICATION_CONFIG`

`InjectionToken<Readonly<MlvNotificationOpenConfig>>` containing the complete per-open configuration for component content. Templates receive the same object as `config`.

The dynamic component injector also aliases the same ref instance as `MlvToastRef`, allowing infrastructure shared with toast to inject the base ref contract.

---

## `MlvNotificationRef<TData = unknown>`

**File:** `libs/core/notification/src/lib/notification-ref.ts`

Extends `MlvToastRef<TData>` without changing its lifecycle:

| Member          | Type               | Description                                      |
| --------------- | ------------------ | ------------------------------------------------ |
| `id`            | `string`           | Unique generated item id                         |
| `data`          | `TData`            | Readonly value from the matching config          |
| `closed`        | `Signal<boolean>`  | Becomes `true` when the service removes the card |
| `close()`       | `void`             | Requests dismissal; idempotent                   |
| `afterClosed()` | `Observable<void>` | Emits once after removal, then completes         |

The same instance is returned to the caller, injected into component content, and exposed to template content.

---

## `MlvNotificationItem`

**Files:** `libs/core/notification/src/lib/notification-item/`

- Selector: `mlv-notification-item`.
- Extends `MlvAbstractToastItem<MlvInternalNotification>`.
- Host class is `mlv-notification-item mlv-notification-item--{tone}`.
- Carries **no** `role`/`aria-live`. `MlvNotificationService` announces through the CDK `LiveAnnouncer` instead, so the card is not itself a live region (see `libs-toast.md` → Screen-reader announcement).
- Selects success, danger, warning, or information Lucide icons from the resolved tone.
- Renders template content with `NgTemplateOutlet`, component content with `NgComponentOutlet`, or the standard escaped title.
- Renders optional description, form-safe `type="button"` close control, and configured action buttons around any dynamic content.
- `.mlv-notification-item__dynamic-content` provides safe wrapping and primary text color.

The item is mounted by the generic `MlvToastContainer`; there is no `NotificationContainerComponent`.

---

## Usage

### Standard API and shorthands

```ts
const ref = this.notifications.show({
  title: 'Release ready',
  description: 'Version 4.2.0 passed all checks.',
  tone: 'success',
  actions: [
    {
      label: 'Open release',
      variant: 'primary',
      action: () => this.openRelease(),
    },
  ],
});

ref.afterClosed().subscribe(() => {
  // The notification has been removed.
});

this.notifications.error('Deployment failed', { displayTime: 0 });
```

### String, template, and component content

```ts
this.notifications.open('Deployment completed successfully.', {
  tone: 'success',
});

const ref = this.notifications.open<ReleaseData>(template, {
  displayTime: 0,
  data: { version: '4.2.0' },
});

this.notifications.open<ReleaseData>(ReleaseContentComponent, {
  displayTime: 0,
  data: { version: '4.2.0' },
});
```

```html
<ng-template #template let-ref let-data="data" let-config="config">
  <strong>Release {{ data.version }}</strong>
  <button mlvButton (click)="ref.close()">Dismiss</button>
</ng-template>
```

```ts
export class ReleaseContentComponent {
  readonly ref = inject<MlvNotificationRef<ReleaseData>>(MlvNotificationRef);
  readonly data = inject(NOTIFICATION_DATA) as ReleaseData;
  readonly config = inject(NOTIFICATION_CONFIG) as Readonly<MlvNotificationOpenConfig<ReleaseData>>;
}
```

---

## Dependencies

| Package                       | Usage                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `@malva-ui/core/toast`        | Abstract service/item, shared container, `MlvToastRef`, config and positioning contracts |
| `@malva-ui/core/button`       | Dismiss and action buttons                                                               |
| `@malva-ui/core/chip`         | Tone icon badge                                                                          |
| `@malva-ui/cdk/accessibility` | Accessible click handling                                                                |
| `@malva-ui/cdk/utils`         | Shared tone type                                                                         |
| `@malva-ui/i18n`              | Dismiss label                                                                            |
| `@angular/core`               | Component, signals, templates, tokens, and injectors                                     |
| `@angular/common`             | `NgTemplateOutlet`, `NgComponentOutlet`                                                  |
| `@lucide/angular`             | Tone and dismiss icons                                                                   |

## Testing

Component tests cover creation, the absence of live-region roles on the card, and focus-safe timer pausing. Service tests cover string/template/component content, data context/token, typed refs, duplicate-close safety, and shared overlay cleanup.
