# Library: toast

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, service, styling, testing, or public API changes.

## Overview

`@malva-ui/core/toast` provides lightweight, programmatic notifications in six viewport positions. It has two complementary creation APIs:

1. `show(config)` and the `success`/`error`/`warning`/`info`/`tone` shorthands render the standard title-and-description toast.
2. `open(content, config)` renders an escaped string, a typed `TemplateRef`, or an Angular component while retaining the standard tone, description, timer, position, and dismiss affordance.

Every creation method returns a `MlvToastRef`. The caller, template content, component content, the auto-dismiss timer, and the built-in dismiss button all close through the same service-owned path. That path removes the item, completes `afterClosed()`, and defers disposal of an empty position overlay by `200ms` so the leave animation can finish.

Active items use a normal linear list. Top-positioned containers prepend new items; bottom-positioned containers append them. There is no `maxShownItems` option or alternate stacked-card mode.

The library also exports the abstract container/service/item foundations reused by `@malva-ui/core/notification`.

---

## Public API

Exported from `libs/core/toast/src/index.ts`:

| Export                                     | Kind               | Description                                                                       |
| ------------------------------------------ | ------------------ | --------------------------------------------------------------------------------- |
| `MlvToastService`                          | Service            | `show()`, `open()`, tone shorthands, and `close()`; provided in `root`            |
| `MlvToastRef<TData>`                       | Class              | Per-item handle with `id`, typed `data`, `closed`, `close()`, and `afterClosed()` |
| `MlvToastContent<TData>`                   | Type alias         | Escaped string, typed `TemplateRef`, or component type accepted by `open()`       |
| `MlvToastOpenConfig<TData>`                | Interface          | Position, timer, data/injector, description, and tone options for `open()`        |
| `MlvToastTemplateContext<TData>`           | Interface          | `$implicit`, `ref`, `data`, and `config` exposed to template content              |
| `TOAST_DATA`                               | Injection token    | Data available to component content opened with `open()`                          |
| `TOAST_CONFIG`                             | Injection token    | Readonly `MlvToastOpenConfig` available to component content                      |
| `MlvToastConfig<TData>`                    | Interface          | Standard `show()` config with required `title`                                    |
| `MlvBaseToastConfig<TData>`                | Interface          | Shared position, lifecycle, data, and injector fields                             |
| `MlvToastPosition`                         | Type alias         | Six top/bottom and left/center/right viewport positions                           |
| `MlvToastTone`                             | Type alias         | Malva semantic tones plus `'default'`                                             |
| `MlvToastShape`                            | Type alias         | `'default'` rectangle or `'pill'` fully rounded compact bar                       |
| `MlvToastTitle`                            | Directive          | `[mlvToastTitle]` — marks title text in consumer content                          |
| `MlvToastDescription`                      | Directive          | `[mlvToastDescription]` — marks description text in consumer content              |
| `MlvToastIcon`                             | Directive          | `[mlvToastIcon]` — marks the leading icon in template/component content           |
| `MlvBaseToastRef`                          | Interface          | Shared `id`, `close()`, and `afterClosed()` contract                              |
| `MlvInternalBaseToast`, `MlvInternalToast` | Interfaces         | Resolved internal item state used by containers                                   |
| `MlvToastContainer`                        | Component          | Internal per-position overlay container, selector `mlv-toast-container`           |
| `MlvToastItem`                             | Component          | Standard/dynamic toast card, selector `mlv-toast-item`                            |
| `MlvAbstractToastService`                  | Abstract class     | Shared overlay/container/ref lifecycle for toast-like services                    |
| `MlvAbstractToastContainerComponent`       | Abstract directive | Ordered item state and service-owned close routing                                |
| `MlvAbstractToastItem`                     | Abstract directive | Timer, pointer/focus pause, and item-close behaviour                              |
| `MlvIAbstractToastComponent`               | Interface          | Contract for a concrete item component rendered by the generic container          |
| `MLV_TOAST_CLOSE`                          | Injection token    | Internal item-to-container close callback used by toast and notification          |
| `MlvToastTimer`                            | Class              | Auto-dismiss timer utility                                                        |
| `resolveToastPoliteness()`                 | Function           | Maps danger/warning to `assertive`, other tones to `polite`                       |
| `joinAnnouncementParts()`                  | Function           | Joins title/description/action text into one announcement string                  |
| `MlvToastPoliteness`                       | Type alias         | `'polite'` or `'assertive'`                                                       |
| `MLV_TOAST_DEFAULT_POSITION`               | Const              | `'top-right'` — single source for the default position                            |

---

## Service

### `MlvToastService`

**File:** `libs/core/toast/src/lib/toast.service.ts`

**Provided in:** `root`

Extends:

```ts
export class MlvToastService extends MlvAbstractToastService<MlvToastConfig, MlvInternalToast, MlvIAbstractToastComponent<MlvInternalToast>, MlvToastRef> {}
```

#### Creation methods

| Method    | Signature                                                                                                    | Description                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `show`    | `(config: MlvToastConfig): MlvToastRef`                                                                      | Renders the standard title/description item                                   |
| `open`    | `<TData = unknown>(content: MlvToastContent<TData>, config?: MlvToastOpenConfig<TData>): MlvToastRef<TData>` | Renders string, template, or component content                                |
| `success` | `(title: string, config?: Omit<MlvToastConfig, 'title' \| 'tone'>): MlvToastRef`                             | Standard item with `success` tone                                             |
| `error`   | `(title: string, config?: Omit<MlvToastConfig, 'title' \| 'tone'>): MlvToastRef`                             | Standard item with `danger` tone                                              |
| `warning` | `(title: string, config?: Omit<MlvToastConfig, 'title' \| 'tone'>): MlvToastRef`                             | Standard item with `warning` tone                                             |
| `info`    | `(title: string, config?: Omit<MlvToastConfig, 'title' \| 'tone'>): MlvToastRef`                             | Standard item with `info` tone                                                |
| `tone`    | `(tone: MlvToastTone, title: string, config?: Omit<MlvToastConfig, 'title' \| 'tone'>): MlvToastRef`         | Generic tone shorthand                                                        |
| `close`   | `(id: string, position?: MlvToastPosition): void`                                                            | Closes an item by id; searches every active position when position is omitted |

`show()` and every shorthand remain supported. `open()` is additive; it is the content-polymorphic API.

#### `open()` content branches

- **String:** normalized to the existing `title` path and rendered with Angular interpolation. Text such as `<strong>Saved</strong>` is displayed literally; it is never trusted or inserted as HTML.
- **TemplateRef:** rendered through `NgTemplateOutlet` with a `MlvToastTemplateContext<TData>` and the configured injector.
- **Component:** rendered through `NgComponentOutlet` with a child injector providing `MlvToastRef`, `TOAST_DATA`, and `TOAST_CONFIG`.

Template/component content replaces the standard title, while `description`, the close button, tone styling, timing, and position still come from `MlvToastOpenConfig`.

#### Resolved defaults

| Field          | Default                        |
| -------------- | ------------------------------ |
| `position`     | `'top-right'`                  |
| `tone`         | `'default'`                    |
| `shape`        | `'default'`                    |
| `icon`         | `false`                        |
| `description`  | `''`                           |
| `displayTime`  | `4000` ms                      |
| `pauseOnHover` | `true`                         |
| `closable`     | `true`                         |
| `politeness`   | `resolveToastPoliteness(tone)` |

`icon` is forced to `false` on the template and component branches of `open()`, regardless of the value passed — that content owns its own leading icon through `[mlvToastIcon]`.

#### Close lifecycle

1. The returned ref, timer, dismiss control, or custom content requests close.
2. The request routes to `MlvAbstractToastService.close()`.
3. The owning position container removes the item.
4. The service marks the matching ref closed, emits/completes `afterClosed()`, and removes the ref from its registry.
5. If no items remain at that position, overlay disposal is delayed by `200ms` for the CSS leave animation. A new item at that position cancels the pending disposal and reuses the container.

Repeated `MlvToastRef.close()` calls are safe and produce only one close request.

---

## Content, config, and context types

### `MlvToastContent<TData = unknown>`

```ts
export type MlvToastContent<TData = unknown> = string | TemplateRef<MlvToastTemplateContext<TData>> | Type<unknown>;
```

### `MlvToastTemplateContext<TData = unknown>`

```ts
export interface MlvToastTemplateContext<TData = unknown> {
  $implicit: MlvToastRef<TData>;
  ref: MlvToastRef<TData>;
  data: TData;
  config: Readonly<MlvToastOpenConfig<TData>>;
}
```

`$implicit` and `ref` are the same `MlvToastRef`. Templates can use `let-ref`, `let-ref="ref"`, `let-data="data"`, and `let-config="config"`.

### `MlvBaseToastConfig<TData = unknown>`

| Field          | Type               | Default              | Description                                                   |
| -------------- | ------------------ | -------------------- | ------------------------------------------------------------- |
| `position`     | `MlvToastPosition` | `'top-right'`        | Viewport anchor                                               |
| `data`         | `TData`            | `undefined`          | Data exposed by the ref and dynamic-content context/token     |
| `injector`     | `Injector`         | environment injector | Parent injector for dynamic template/component content        |
| `displayTime`  | `number`           | surface-specific     | Auto-dismiss delay in milliseconds; `0` disables auto-dismiss |
| `pauseOnHover` | `boolean`          | `true`               | Pauses on pointer hover and keyboard focus                    |
| `closable`     | `boolean`          | `true`               | Shows the built-in dismiss button                             |

### `MlvToastConfig<TData = unknown>`

Extends `MlvBaseToastConfig<TData>`:

| Field         | Type            | Required | Description                                                       |
| ------------- | --------------- | -------- | ----------------------------------------------------------------- |
| `title`       | `string`        | yes      | Standard title rendered as escaped text                           |
| `description` | `string`        | no       | Optional supporting text                                          |
| `tone`        | `MlvToastTone`  | no       | Semantic accent and live-region urgency                           |
| `icon`        | `boolean`       | no       | Renders the tone-derived Lucide icon; no-op for `tone: 'default'` |
| `shape`       | `MlvToastShape` | no       | `'default'` rectangle or `'pill'` fully rounded compact bar       |

### `MlvToastOpenConfig<TData = unknown>`

Extends `MlvBaseToastConfig<TData>` with optional `description`, `tone`, `icon`, and `shape`. It intentionally has no `title` because content is the first `open()` argument. `icon` applies only to the string and `{ title, description }` branches.

### Shape

`shape` is a toast-only field — it is deliberately **not** on the shared `MlvBaseToastConfig`, so `@malva-ui/core/notification` (a card surface) is unaffected.

| Value       | Rendering                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------- |
| `'default'` | `--mlv-radius-xl` corners; fixed `22.5rem` width from the `md` breakpoint up                       |
| `'pill'`    | `--mlv-radius-full` corners, vertically centred body, content-hugging up to `22.5rem` from `md` up |

Both shapes are full-bleed (`100vw - 2rem`) below `md`.

### Icon

The built-in icon is opt-in and derived from `tone` — there is no icon-name field on the config. Only the four semantic tones map to a glyph:

| Tone        | Icon                     |
| ----------- | ------------------------ |
| `'success'` | `lucideCheckCircle`      |
| `'warning'` | `lucideTriangleAlert`    |
| `'danger'`  | `lucideCircleX`          |
| `'info'`    | `lucideInfo`             |
| `'default'` | none — `icon` is a no-op |

The icon is `aria-hidden`: the tone is already conveyed by the `alert`/`status` live-region role and the text.

For anything richer — avatar, badge, spinner, action button — pass a `TemplateRef` or component
to `open()` and mark the leading element with `[mlvToastIcon]`.

### Dynamic-content layout

`.mlv-toast-item__dynamic-content` is a three-column grid placed **by role**, so flat author
markup lays out correctly without a wrapper element:

| Column | Holds                                   | Selector                                                        |
| ------ | --------------------------------------- | --------------------------------------------------------------- |
| 1      | leading icon / avatar / badge / spinner | `.mlv-toast-item__icon` (from `[mlvToastIcon]`)                 |
| 2      | text, stacking and wrapping             | everything else; `[mlvToastTitle]` then `[mlvToastDescription]` |
| 3      | trailing actions                        | `.mlv-button` / `.mlv-button-close`                             |

Column 1 and 3 sit on the first row and centre against it — the row is sized by the tallest of
the three, so icon, title and action share one centre. A description flows into row 2.

Two implementation constraints worth knowing before changing this:

- **`ngComponentOutlet` wraps content in the component's host element**, so component content
  would present the grid with a single child. The container gets a
  `--component` modifier whose child is set to `display: contents`, hoisting the component's
  children into the grid. The role rules are therefore written as descendants, not children, so
  they match at either depth — safe, because grid placement only affects real grid items.
- **Do not span rows for the icon/action.** `grid-row: 1 / -1` resolves `-1` against the
  _explicit_ grid, and there are no explicit rows, so it collapses to row 1. `span 2` does span,
  but a 40px action then inflates the empty second row of a single-line toast, and the spanning
  items centre over 40px while the title centres over its own ~21px row — a visible ~9px
  misalignment.

**Gotcha:** `[mlvToastIcon]` must be in the `imports` of the component that owns the markup.
Angular treats an unimported attribute directive as an inert attribute — no error, no warning —
so the class is never applied and the element silently falls into the text column with no gap.

Known nit: on a multi-line toast the built-in dismiss is centred on the whole card (it lives in
`__body`) while a content action sits on the first row, so the two stagger. Pinning the dismiss to
the first line was tried and reverted — it misaligned the far more common single-line case.

---

## Injection tokens

### `TOAST_DATA`

`InjectionToken<unknown>` containing `MlvToastOpenConfig.data` for component content. Cast at the injection boundary when a concrete data shape is required. Templates use the typed `data` context property instead.

### `TOAST_CONFIG`

`InjectionToken<Readonly<MlvToastOpenConfig>>` containing the full per-open configuration for component content. Templates receive the same object as `config`.

### `MLV_TOAST_CLOSE`

Internal `InjectionToken<(id: string) => void>` supplied to item components by `MlvToastContainer`. `MlvAbstractToastItem` uses it for timer and dismiss-button requests. The callback delegates to the service rather than mutating the container directly, ensuring refs and empty overlays are finalized consistently.

---

## `MlvToastRef<TData = unknown>`

**File:** `libs/core/toast/src/lib/toast-ref.ts`

| Member          | Type               | Description                                      |
| --------------- | ------------------ | ------------------------------------------------ |
| `id`            | `string`           | Unique service-generated item id                 |
| `data`          | `TData`            | Readonly value from the matching config          |
| `closed`        | `Signal<boolean>`  | Becomes `true` once the service removes the item |
| `close()`       | `void`             | Requests dismissal; idempotent                   |
| `afterClosed()` | `Observable<void>` | Emits once after service removal, then completes |

The same instance is returned to the caller, injected into component content, and exposed to template content.

---

## Components and shared infrastructure

### `MlvToastItem`

**Files:** `libs/core/toast/src/lib/toast-item/`

- Extends `MlvAbstractToastItem<MlvInternalToast>`.
- Host class is `mlv-toast-item mlv-toast-item--{tone}`, plus `mlv-toast-item--pill` when `shape` is `'pill'`.
- Carries **no** `role`/`aria-live`. Announcement is owned by the service (see below), so the rendered item is not a live region.
- Renders template content with `NgTemplateOutlet`, component content with `NgComponentOutlet`, or the standard escaped title when no dynamic content exists.
- Renders the optional tone icon as a leading sibling of `.mlv-toast-item__content`, gated by `_showIcon()`: `icon === true`, a non-`default` tone, and no dynamic content.
- Renders optional description and the form-safe `type="button"` dismiss control.
- `.mlv-toast-item__dynamic-content` supplies safe wrapping and primary text color for consumer content.

### `MlvToastContainer`

**Files:** `libs/core/toast/src/lib/toast-container/`

The service creates at most one container overlay per active `MlvToastPosition`. The container renders each item through `NgComponentOutlet`, injects the internal close callback, and uses Angular `animate.enter`/`animate.leave` classes on linear item wrappers.

Top containers prepend new items; bottom containers append them. The container does not cap, overlap, scale, or hide items.

### `MlvAbstractToastItem<T>`

Starts the auto-dismiss timer in `ngOnInit`, clears it in `ngOnDestroy`, pauses on pointer hover or focus entry when enabled, and restarts the full duration after pointer/focus exit. Focus moving between controls inside the same card does not resume the timer.

### `MlvAbstractToastService<TConfig, TItem, TItemComponent, TRef>`

Owns per-position overlays and containers, active refs, item ids, service destruction, the shared `show()`/`close()` path, and delayed final-container disposal. Subclasses supply the container type, item type, `buildItem()`, and optionally `_createRef()`.

### `MlvAbstractToastContainerComponent<T>`

Owns the ordered `toasts` signal and `position` signal. `remove()` returns whether an item existed; `setCloseHandler()` registers the service-owned close callback used by the concrete container.

---

## Usage

### Standard API and shorthands

```ts
const ref = this.toast.show({
  title: 'Changes saved',
  description: 'Your profile is up to date.',
  tone: 'success',
});

ref.afterClosed().subscribe(() => {
  // The item has been removed.
});

this.toast.error('Upload failed', { displayTime: 0 });
this.toast.tone('warning', 'Connection is unstable');
```

### String, template, and component content

```ts
this.toast.open('Profile changes saved.', {
  tone: 'success',
});

const ref = this.toast.open<SyncData>(template, {
  displayTime: 0,
  data: { pending: 3 },
});

this.toast.open<SyncData>(SyncToastContentComponent, {
  displayTime: 0,
  data: { pending: 3 },
});
```

```html
<ng-template #template let-ref let-data="data" let-config="config">
  <strong>{{ data.pending }} changes pending</strong>
  <button mlvButton (click)="ref.close()">Dismiss</button>
</ng-template>
```

### Pill shape and the tone icon

```ts
// Compact pill with the tone-derived icon — string/object content only.
this.toast.show({
  title: 'Changes saved',
  tone: 'success',
  shape: 'pill',
  icon: true,
});

// Richer pill content: avatar, action, trailing chip. The template owns its
// leading icon; the built-in one stays suppressed.
this.toast.open(richTemplate, { shape: 'pill', displayTime: 0 });
```

```html
<ng-template #richTemplate let-ref>
  <mlv-avatar mlvToastIcon [src]="user.avatarUrl" size="s" />
  <span mlvToastTitle>{{ user.name }} shared a file</span>
  <button mlvButton variant="secondary" (click)="open(); ref.close()">Open</button>
</ng-template>
```

```ts
export class SyncToastContentComponent {
  readonly ref = inject<MlvToastRef<SyncData>>(MlvToastRef);
  readonly data = inject(TOAST_DATA) as SyncData;
  readonly config = inject(TOAST_CONFIG) as Readonly<MlvToastOpenConfig<SyncData>>;
}
```

---

## Dependencies

| Package                       | Usage                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `@angular/core`               | Components/directives, signals, `TemplateRef`, `Injector`, `EnvironmentInjector`, `DestroyRef` |
| `@angular/common`             | `NgTemplateOutlet`, `NgComponentOutlet`                                                        |
| `@angular/cdk/overlay`        | Per-position overlay refs and global positioning                                               |
| `@angular/cdk/portal`         | Container `ComponentPortal`                                                                    |
| `@malva-ui/cdk/accessibility` | Accessible click handling                                                                      |
| `@malva-ui/cdk/utils`         | Shared tone type                                                                               |
| `@malva-ui/core/button`       | Dismiss button                                                                                 |
| `@malva-ui/i18n`              | Dismiss label                                                                                  |
| `rxjs`                        | `MlvToastRef.afterClosed()`                                                                    |

## Testing

Component tests cover creation, live-region role selection, and timer pause/resume for pointer-independent keyboard focus. Service tests cover all content branches, data token/context, ref closure, duplicate-close safety, caller/service/item close routing, and delayed empty-overlay disposal.

---

## Screen-reader announcement

`MlvAbstractToastService` announces each item through the CDK `LiveAnnouncer`, **not**
through a `role` on the rendered item. Three problems this avoids:

- A live region that is inserted together with its first message is frequently missed by
  screen readers. `LiveAnnouncer` owns one region that already exists in the DOM.
- A `role` on every item means a stack of five toasts is five live regions.
- `role="alert"` carries an implicit `aria-live="assertive"` that silently overrules any
  politeness the caller asked for.

Politeness comes from `config.politeness`, falling back to `resolveToastPoliteness(tone)`
— assertive for `danger`/`warning`, polite otherwise.

Only the string and `{ title, description }` branches are announced. Template and component
content returns `null` from `resolveAnnouncement()`, because the service cannot read the
rendered text; such content is responsible for announcing anything it needs to.

Concrete services implement `resolveAnnouncement(config)` and build their message with
`joinAnnouncementParts()`, which drops absent fragments and normalises trailing sentence
punctuation so an omitted description cannot announce a stray separator or a doubled
full stop.

### Required stylesheet

`LiveAnnouncer` appends a `.cdk-visually-hidden` element to the body. Those rules ship in
the package's global `styles/malva-ui.css` (via the CDK `a11y-visually-hidden` Sass mixin).
**A consumer that does not include that stylesheet will see the announcement text rendered
visibly on the page.**

---

## Clearance from sticky page chrome

Toasts render in a CDK overlay attached to the body, so they know nothing about
the page underneath and would happily cover a sticky `mlv-page-dock`'s
Save/Discard actions. `MlvToastContainer` therefore publishes a resolved inset
for whichever edge its position is anchored to, and `toast-container.scss` turns
it into padding on the stack:

| Host style property                   | Set on               | Value                                                                |
| ------------------------------------- | -------------------- | -------------------------------------------------------------------- |
| `--mlv-toast-panel-inset-block-start` | `top-*` positions    | `var(--mlv-toast-inset-block-start, 0px)`                            |
| `--mlv-toast-panel-inset-block-end`   | `bottom-*` positions | `var(--mlv-toast-inset-block-end, var(--mlv-page-dock-height, 0px))` |

The unused edge is left unset and falls back to `0px`, so nothing changes for a
page without sticky chrome. Consumers override
`--mlv-toast-inset-block-start` / `--mlv-toast-inset-block-end` on
`document.documentElement` — the overlay container is a body child and never a
descendant of the page, so the document root is the only reliable scope.

The block-end default is `--mlv-page-dock-height`, which a sticky
`mlv-page-dock` publishes on the document root while it is mounted and removes
on destroy (see `libs-page.md`). Bottom toasts therefore clear a page dock with
no wiring at all, and an explicit `--mlv-toast-inset-block-end` still wins over
it. This is CSS all the way down, so the offset tracks a dock that resizes or
unmounts without any re-measurement on the toast side.

`@malva-ui/core/notification` reuses `MlvToastContainer`, so it inherits the
same behaviour.

## Sizing and alignment

`.mlv-toast-item` is `display: flex`, `width: fit-content`,
`max-width: min(22.5rem, calc(100vw - 2rem))`, `min-block-size: 3rem`.

- **Hugs its content** — a short message renders a short bar instead of filling the panel.
  The cap stops long text spanning the viewport; the `100vw` term keeps it inside the
  panel's `1rem` margins on narrow screens.
- **Floored height** — `min-block-size: 3rem` keeps a one-line toast reading as a bar and
  keeps a stack of them aligned. The block is `flex` (not `block`) and `__wrapper`/`__body`
  both stretch, so the floor does not become dead space under the content.
- **Vertically centred** — `__body` uses `align-items: center`, so the icon, text block and
  trailing controls share one optical baseline regardless of shape or wrap count. The
  dismiss control therefore needs no vertical nudge, only an inline pull to the edge.
- **Anchored** — because items hug their content, the panel and container take
  `align-items` from `--mlv-toast-align`, resolved per position class
  (`--top-left`/`--bottom-left` → start, `--*-center` → center, otherwise end), so a short
  toast still sits against its anchor edge.

`shape: 'pill'` adds `--mlv-radius-full` corners, widens the body's inline padding so text
clears the rounded ends, and rounds inner buttons by setting their own
`--mlv-btn-radius` hook — square-cornered controls read as misaligned inside a fully
rounded bar. Buttons that set `border-radius` directly (`shape="circle"` / `shape="square"`,
and `mlv-button-close`, which is circular by default) still win over that.

Inner content sizing is the author's job: only `mlv-button` and `mlv-badge` expose
`mlvDensity`, so `mlv-avatar` and `mlv-loader` are sized through their own inputs
(`size`, `strokeWidth`).
