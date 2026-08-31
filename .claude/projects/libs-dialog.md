---

# Library: dialog

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

`@malva-ui/core/dialog` has one engine and one vocabulary. Every dialog is the
same markup — a `<mlv-dialog>` surface with `mlv-dialog-header` /
`mlv-dialog-body` / `mlv-dialog-footer` parts and `[mlvDialogClose]` buttons —
whether it was opened from a template, a component, a string, `confirm()`, or a
route. **The thing that opens the dialog owns the options; the content owns the
chrome**, so no path ever draws a header for another and the double-header class
of bug cannot exist. The engine is Angular CDK `Dialog` (`@angular/cdk/dialog`):
overlay, container, focus trap/restore, `aria-*`, `closeAll()`,
`closeOnNavigation`, template context and DI; Malva adds the enter/leave
animation, granular Escape/backdrop opt-outs, `initialFocus: 'auto'`, size
presets, the surface and parts, `confirm()`, and routable dialogs.

Three ways to open one:

1. **Declarative** — `<ng-template [(mlvDialog)]="open" [mlvDialogOptions]="…">` (`MlvDialogTemplate`) wraps the surface. Lazy: the template is instantiated only while open.
2. **Imperative** — `MlvDialogService.open(content, config)` with a plain string, a `TemplateRef`, or a component type, returning a typed `MlvDialogRef<R, D>`.
3. **Route-driven** — `mlvGenerateRoutableDialogRoute()` creates a route that opens its component in a dialog; closing navigates back to the parent route.

Plus `MlvDialogService.confirm(options)` — a two-action confirmation that emits
one `boolean` and completes.

Migration from the previous API: [docs/migrations/2026-08-dialog-composition.md](../../docs/migrations/2026-08-dialog-composition.md).

---

## Public API

Exported from `libs/core/dialog/src/index.ts`:

| Export                             | Kind                                        | Description                                                                                                             |
| ---------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `MlvDialog`                        | Component                                   | The dialog surface — `mlv-dialog`. Root of every dialog's content.                                                      |
| `MlvDialogHeader`                  | Component                                   | Header row (title + close button) — `mlv-dialog-header, [mlvDialogHeader]`.                                             |
| `MlvDialogBody`                    | Component                                   | Scrollable body backed by `mlv-scrollbar` — `mlv-dialog-body, [mlvDialogBody]`.                                         |
| `MlvDialogFooter`                  | Component                                   | Action row — `mlv-dialog-footer, [mlvDialogFooter]`.                                                                    |
| `MlvDialogFooterAlign`             | Type alias                                  | `'start' \| 'end' \| 'center' \| 'between'`.                                                                            |
| `MlvDialogClose`                   | Directive                                   | Closes the enclosing dialog on click, with an optional result — `[mlvDialogClose]`.                                     |
| `MlvDialogTemplate`                | Directive                                   | Declarative two-way sugar over the service — `ng-template[mlvDialog]`, `exportAs: 'mlvDialog'`.                         |
| `MlvDialogService`                 | Service (`providedIn: 'root'`)              | `open()` / `confirm()` / `closeAll()` / `openDialogs`.                                                                  |
| `MlvDialogRef<R, D>`               | Class                                       | Handle for one open dialog: close, results, config, animation state.                                                    |
| `MlvDialogAnimationState`          | Type alias                                  | `'enter' \| 'idle' \| 'leave'`.                                                                                         |
| `MlvDialogConfig<D>`               | Interface                                   | Per-open configuration, shared by `open()` and `mlvDialogOptions`.                                                      |
| `MlvDialogContent<R, D>`           | Type alias                                  | `string \| TemplateRef<MlvDialogTemplateContext<R, D>> \| Type<unknown>`.                                               |
| `MlvDialogTemplateContext<R, D>`   | Interface                                   | `$implicit`, `ref`, `data`, `config` exposed to `TemplateRef` content.                                                  |
| `MlvDialogSize`                    | Type alias                                  | `MlvDialogSizePreset \| (string & {}) \| MlvDialogSizeConfig`.                                                          |
| `MlvDialogSizePreset`              | Type alias                                  | `'s' \| 'm' \| 'l' \| 'fullscreen'`.                                                                                    |
| `MlvDialogSizeConfig`              | Interface                                   | Explicit `width`/`height`/`min*`/`max*` dimensions.                                                                     |
| `MlvDialogSizePresets`             | Type alias                                  | `Record<string, MlvDialogSizeConfig>`.                                                                                  |
| `MlvDialogAppearance`              | Type alias                                  | `'default' \| 'confirm'`.                                                                                               |
| `MlvDialogRole`                    | Type alias                                  | `'dialog' \| 'alertdialog'`.                                                                                            |
| `MlvDialogRestoreFocusTarget`      | Type alias                                  | Static CDK-compatible target: `boolean \| string \| HTMLElement`.                                                       |
| `MlvDialogRestoreFocusResolver`    | Type alias                                  | `() => MlvDialogRestoreFocusTarget`; evaluated immediately before disposal.                                             |
| `MlvDialogRestoreFocus`            | Type alias                                  | Static target or late resolver; preserves the default captured-opener behavior while supporting responsive composition. |
| `DIALOG_DATA`                      | `InjectionToken<unknown>`                   | Angular CDK's `DIALOG_DATA`, re-exported under the same name. Same token identity, so either import injects `data`.     |
| `DIALOG_CONFIG`                    | `InjectionToken<Readonly<MlvDialogConfig>>` | The consumer's config for the current dialog, injectable by content and parts.                                          |
| `DIALOG_SIZE_PRESETS`              | `InjectionToken<MlvDialogSizePresets>`      | Registered size presets; override to change or add presets app-wide.                                                    |
| `MlvConfirmDialogOptions`          | Interface                                   | Options for `MlvDialogService.confirm()`.                                                                               |
| `mlvGenerateRoutableDialogRoute()` | Function                                    | Builds a `Route` that opens a component inside a dialog when activated.                                                 |

Deliberately **not** exported (implementation details): `MlvDialogContainer`,
`MlvDialogTextContent` + `MLV_DIALOG_TEXT`, `MlvConfirmDialog` +
`MLV_CONFIRM_DIALOG_CONFIRM_CLASS` / `MLV_CONFIRM_DIALOG_CANCEL_CLASS`,
`injectDialogRef()`, `MlvRoutableDialog`.

---

## Components

### `MlvDialog`

**File:** `libs/core/dialog/src/lib/dialog/dialog.ts` · **Styles:** `dialog.scss`

- **Selector:** `mlv-dialog` · **Template:** `<ng-content />`
- `ViewEncapsulation.None`, `ChangeDetectionStrategy.OnPush`
- Host classes: `mlv-dialog`, plus `mlv-dialog--confirm` (when `DIALOG_CONFIG.appearance === 'confirm'`), `mlv-dialog--enter` / `mlv-dialog--leave` mirrored from `MlvDialogRef.animationState()`.

No inputs and no outputs — everything it needs comes from `MlvDialogRef` and
`DIALOG_CONFIG`. Consumer `class="…"` lands on this element (it is the visible
surface); `MlvDialogConfig.panelClass` styles the overlay pane around it.

The surface owns the animation handshake. Its `(animationend)` handler is
target-guarded (`event.target === host`, so a descendant's animation is
ignored) and calls `MlvDialogRef._onSurfaceAnimationEnd()`: the enter animation
settles the state to `'idle'`, the leave animation disposes the CDK dialog. The
CDK container carries no animation class and no listener.

Rendered outside a dialog it throws a descriptive error (via the internal
`injectDialogRef()` helper) naming the selector and the two ways to open one
(`MlvDialogService.open()`, `<ng-template [(mlvDialog)]>`).

### `MlvDialogHeader`

**File:** `libs/core/dialog/src/lib/dialog-header.ts`

- **Selector:** `mlv-dialog-header, [mlvDialogHeader]` (element, or attribute on the consumer's own container)
- Host class: `mlv-dialog__header`; host binding `[attr.title]="null"` strips the static `title` attribute so `<mlv-dialog-header title="…">` feeds the input without leaving a browser tooltip on the row.

It is a **container**, never applied to a heading — project the heading inside
it instead: `<mlv-dialog-header><h3>Edit user</h3></mlv-dialog-header>`.

#### Inputs

| Name       | Type                   | Default     | Description                                                                                                                          |
| ---------- | ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `title`    | `string \| undefined`  | `undefined` | Plain-text title rendered as `<h2 class="mlv-dialog__title">`.                                                                       |
| `closable` | `boolean \| undefined` | `undefined` | Whether the X is rendered. `BooleanInput`-coerced; `undefined` (unset) defers to the config. Always off for `appearance: 'confirm'`. |

#### Title and close-button resolution

- **Title:** `title` input → projected content → `MlvDialogConfig.title`. With a `title` input the element is an `<h2>`; otherwise it is a `<div class="mlv-dialog__title">` wrapping the projection, whose `<ng-content>` fallback is a plain `<h2>` (no class) carrying `config.title`. A projected heading of any level is styled as _the_ title, so pick the level for the document outline.
- **Close button:** `closable` input → `MlvDialogConfig.closable` → `true`; forced `false` when `MlvDialogConfig.appearance` is `'confirm'`.
- **Markup of the X:** `<mlv-button-close class="mlv-dialog__close" mlvDensity="compact" shape="circle" variant="secondary" [ariaLabel]="i18n.closeDialog" (click)="ref.close()" />`. The native `click` is bound on the wrapper because it already hosts a real `<button>` — `[mlvClick]` would add a second tab stop.

#### Labelling

The title element carries `id="<MlvDialogRef.id>-title-<n>"` — the counter is
per header instance (`mlvNextId`), so two headers in one dialog never share an
id — and registers itself as
the dialog's label through `MlvDialogRef._labelBy()`, so the visible title
becomes the accessible name. **The label follows the rendered title.** The
header re-takes the decision after every render (`afterEveryRender`), diffing
against what it registered last: the id goes in as soon as the title element
has text — so a title that only arrives asynchronously (`[title]="user()?.name"`,
a projected heading fed by a resolver) still names the dialog — and is taken out
again with `_unlabelBy()` when the title loses its text. A header that renders
no text at all — no `title` input, no projected content, no `config.title`, e.g.
a header that only hosts the X — registers nothing, because labelling the dialog
with an empty element produces an empty accessible name (an axe
`aria-dialog-name` violation). On destroy a live registration is reversed.
When several headers register (e.g. two `mlv-dialog-header`s in one dialog),
the CDK container uses the first id in its queue as `aria-labelledby`; names
do not concatenate.

### `MlvDialogBody`

**File:** `libs/core/dialog/src/lib/dialog-body.ts`

- **Selector:** `mlv-dialog-body, [mlvDialogBody]` · Host class: `mlv-dialog__body`
- Template: `<mlv-scrollbar class="mlv-dialog__body-scrollbar"><ng-content /></mlv-scrollbar>`

No inputs or outputs. The padding sits on the scrollbar's **viewport**, inside
the clip box, so focus rings on body controls are never clipped; the scrollbar's
content element is an explicit `display: flex; flex-direction: column` so body
children stack and may `flex: 1` (never inherit `flex-direction` through the
scrollbar — the viewport's initial value is `row`).

### `MlvDialogFooter`

**File:** `libs/core/dialog/src/lib/dialog-footer.ts`

- **Selector:** `mlv-dialog-footer, [mlvDialogFooter]` · Host classes: `mlv-dialog__footer` + `mlv-dialog__footer--align-<align>`
- A wrapping flex row of actions. Replaces the old bare footer class, its trailing-actions helper, and the toolbar + spacer boilerplate.

#### Inputs

| Name    | Type                   | Default | Description                                                         |
| ------- | ---------------------- | ------- | ------------------------------------------------------------------- |
| `align` | `MlvDialogFooterAlign` | `'end'` | Where the actions sit: `'start'`, `'end'`, `'center'`, `'between'`. |

### `MlvDialogContainer` (internal — not exported)

**File:** `libs/core/dialog/src/lib/dialog-container.ts` · **Styles:** `dialog-container.scss`

`extends CdkDialogContainer`; selector `mlv-dialog-container`, template
`<ng-template cdkPortalOutlet />`. The service passes it as
`DialogConfig.container`, so it is the CDK's container for every Malva dialog
and never instantiated by consumers.

- Host: `class="mlv-dialog-container"`, `tabindex="-1"`, `[attr.id]`, `[attr.role]`, `[attr.aria-modal]`, `[attr.aria-labelledby]` (suppressed when `ariaLabel` is set), `[attr.aria-label]`, `[attr.aria-describedby]` — restated from the CDK base so the contract sits next to the styles that depend on it.
- `changeDetection: ChangeDetectionStrategy.Eager` — a **documented exception** to the repo's OnPush rule, matching `CdkDialogContainer` / `MatDialogContainer`. This view is the change-detection parent of arbitrary consumer content (the portal outlet's `ViewContainerRef` lives in it), so an OnPush, non-dirty container would skip refreshing zone-driven content.
- `_captureInitialFocus()` override: the CDK first focuses the container (`autoFocus: 'dialog'`, which emits `_focusTrapped` so the CDK aria-hides the rest of the page), then — from `afterNextRender`, guarded against a destroyed view — `MlvOverlayInitialFocusResolver` moves focus to the resolved `initialFocus` target.
- `ngOnDestroy()` evaluates a dynamic `restoreFocus` resolver before delegating to the inherited CDK hook. A consumer resolver exception degrades to `restoreFocus: false`, so focus restoration is skipped while container destruction, overlay disposal, `closed` emission, and registry cleanup continue. The inherited CDK teardown runs outside that consumer-error boundary, so its own exceptions are not hidden.

Its stylesheet is selected as `mlv-dialog-container.mlv-dialog-container`
(element **and** class): Ivy merges the inherited `cdk-dialog-container`
attribute onto the host, and the CDK's own `.cdk-dialog-container { display: block }`
has equal specificity to a bare class selector.

### `MlvDialogTextContent` / `MlvConfirmDialog` / `MlvRoutableDialog` (internal — not exported)

- `dialog-text-content.ts` — renders string content: `<mlv-dialog>` + `<mlv-dialog-header />` (only when the config has a `title`, or a close button would show) + `<mlv-dialog-body><p class="mlv-dialog__text">`. The string arrives through the internal `MLV_DIALOG_TEXT` token and is interpolated, never `innerHTML`.
- `confirm-dialog.ts` — the `confirm()` content: `<mlv-dialog>` + titled `<mlv-dialog-header>` + message body + `<mlv-dialog-footer>` with cancel/confirm buttons. Reads its options from `MlvDialogRef.data`, so it never imports the service.
- `routable-dialog.ts` — the invisible shell `mlvGenerateRoutableDialogRoute()` lazy-loads; it opens the routed component with the shell's injector and navigates back to the parent route when the dialog closes.

---

## Directives

### `MlvDialogClose`

**File:** `libs/core/dialog/src/lib/dialog-close.ts` · **Selector:** `[mlvDialogClose]`

Closes the enclosing dialog when the host is clicked, optionally with a result.
Injects `MlvDialogRef` (required — throws outside a dialog).

Put it on a `<button>` (or an `<a href>`): the directive listens to `click` only
and adds no keyboard handling of its own.

#### Inputs

| Name             | Type             | Default     | Description                                                                                                   |
| ---------------- | ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `mlvDialogClose` | `R \| undefined` | `undefined` | Result passed to `MlvDialogRef.close()`. A bare attribute (`''`) means `undefined`.                           |
| `type`           | `string`         | `'button'`  | Bound to `[attr.type]` **only when the host is a `<button>`** (`null` otherwise), so it never submits a form. |

```html
<button mlvButton mlvDialogClose>Cancel</button>
<!-- closes with undefined -->
<button mlvButton mlvDialogClose="saved">Save</button>
<!-- closes with 'saved' -->
<button mlvButton [mlvDialogClose]="form.value">Save</button>
```

### `MlvDialogTemplate`

**File:** `libs/core/dialog/src/lib/dialog-template.ts`
**Selector:** `ng-template[mlvDialog]` · **`exportAs`:** `mlvDialog`

Declarative sugar over `MlvDialogService.open(templateRef, options)`. The
template is instantiated only while open and receives the same context as
`open(templateRef)` (`let-dialog`, `let-data="data"`, `let-config="config"`).

#### Model

| Name        | Type      | Default | Description                                                           |
| ----------- | --------- | ------- | --------------------------------------------------------------------- |
| `mlvDialog` | `boolean` | `false` | Whether the dialog is open. Two-way bindable: `[(mlvDialog)]="open"`. |

#### Inputs

| Name               | Type                              | Default     | Description                                                                              |
| ------------------ | --------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `mlvDialogOptions` | `MlvDialogConfig<D> \| undefined` | `undefined` | Options handed to `open()`. Read at open time; later changes apply to the **next** open. |

#### Outputs

| Name              | Type             | Description                                                        |
| ----------------- | ---------------- | ------------------------------------------------------------------ |
| `mlvDialogChange` | `boolean`        | The model's change output — emitted whenever the open state flips. |
| `mlvDialogOpened` | `void`           | Emitted right after the dialog has been opened.                    |
| `mlvDialogClosed` | `R \| undefined` | Emitted with the close result once the dialog is disposed.         |

#### Methods

| Method                   | Signature                                                                              | Description                                                     |
| ------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `open`                   | `open(): void`                                                                         | Sets the model to `true`.                                       |
| `close`                  | `close(): void`                                                                        | Sets the model to `false`.                                      |
| `ngTemplateContextGuard` | `static ngTemplateContextGuard<R, D>(dir, ctx): ctx is MlvDialogTemplateContext<R, D>` | Types `let-dialog` / `let-data` / `let-config` in the template. |

#### Properties

| Property | Type                         | Description                                                                                                                                                                |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ref`    | `MlvDialogRef<R, D> \| null` | The ref of the open dialog (held until the leave animation completes), or `null`. Dropped immediately when the host is destroyed, so it never hands out a disposed handle. |

#### Open / close behaviour

Closing from inside — `[mlvDialogClose]`, Escape, the backdrop, `dialog.close()`
— flips the model back to `false` and emits `mlvDialogClosed`. Two caveats:

- **Re-open while leaving is deferred, not dropped.** Setting the model back to `true` during the leave animation is remembered; once the old instance is disposed — after its `mlvDialogClosed` has fired — a fresh dialog opens and the model stays `true`. The one case that does not work is re-opening from **inside** an `(mlvDialogClosed)` handler: that handler runs before the model settles, so the write is overwritten. Re-open from a later tick instead.
- **Nothing is emitted after the host is destroyed.** Destroying the host closes an open dialog, but the outputs and the model are not touched afterwards — the `afterClosed()` subscription is torn down with the host (`takeUntilDestroyed`).
- **`afterClosed()` is subscribed before `mlvDialogOpened` emits**, so an `(mlvDialogOpened)` handler that synchronously closes the dialog still clears `ref` and flips the model back to `false`.

---

## Services

### `MlvDialogService`

**File:** `libs/core/dialog/src/lib/dialog.service.ts` · **Provided in:** `root`

Thin orchestration over CDK `Dialog`: the CDK owns overlay, container, focus
trap/restore, ARIA and history handling; the service maps `MlvDialogConfig`,
constructs the `MlvDialogRef`, plays the leave animation, and applies the
granular Escape/backdrop opt-outs. It **never renders chrome**.

#### Methods

| Method     | Signature                                                                                                          | Description                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `open`     | `open<R = unknown, D = unknown>(content: MlvDialogContent<R, D>, config?: MlvDialogConfig<D>): MlvDialogRef<R, D>` | Opens a string, `TemplateRef`, or component type in a modal dialog.   |
| `confirm`  | `confirm(options: MlvConfirmDialogOptions): Observable<boolean>`                                                   | Opens a two-action confirmation; emits once, completes, and replays.  |
| `closeAll` | `closeAll(): void`                                                                                                 | Closes every open dialog, newest first, playing each leave animation. |

#### Properties

| Property      | Type                      | Description                                                    |
| ------------- | ------------------------- | -------------------------------------------------------------- |
| `openDialogs` | `readonly MlvDialogRef[]` | Snapshot (a copy) of the currently open dialogs, oldest first. |

#### CDK mapping

`open()` translates `MlvDialogConfig` into the CDK `DialogConfig`:

| `MlvDialogConfig`                                    | CDK `DialogConfig`                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `size` (preset name or `MlvDialogSizeConfig`)        | `width`/`height`/`minWidth`/`minHeight`/`maxWidth`/`maxHeight` resolved through `DIALOG_SIZE_PRESETS` (an unknown name falls back to `'m'`), each run through `coerceCssPixelValue`.                                                                                                       |
| `panelClass`                                         | `['mlv-dialog-pane', …('mlv-dialog-pane--fullscreen' when the size is the `fullscreen` preset name), ...panelClass]`                                                                                                                                                                       |
| `backdropClass`                                      | `['mlv-dialog-backdrop', ...backdropClass]`                                                                                                                                                                                                                                                |
| `hasBackdrop` (default `true`)                       | `hasBackdrop`                                                                                                                                                                                                                                                                              |
| `closeOnBackdrop` / `closeOnEscape` (default `true`) | `disableClose: true` **always**; the service subscribes to `cdkRef.backdropClick` / `cdkRef.keydownEvents` (Escape without modifiers) itself, so each can be opted out separately and the leave animation still plays.                                                                     |
| `initialFocus` (default `'auto'`)                    | `autoFocus: 'dialog'` — the CDK focuses the container, then `MlvDialogContainer` applies the Malva strategy.                                                                                                                                                                               |
| `restoreFocus` (default `true`)                      | Static targets pass through unchanged. A resolver is held by `MlvDialogContainer`, evaluated immediately before disposal, checked for a connected element/captured opener, then handed to the inherited CDK restore hook. A throwing resolver becomes `false` so disposal still completes. |
| `role` (default `'dialog'`)                          | `role`                                                                                                                                                                                                                                                                                     |
| `ariaLabel` / `ariaLabelledBy` / `ariaDescribedBy`   | passthrough (`null` when unset). For string content with no `title`, `ariaLabel` defaults to the text itself.                                                                                                                                                                              |
| `closeOnNavigation` (default `true`)                 | `closeOnNavigation`                                                                                                                                                                                                                                                                        |
| `data`, `injector`, `id`                             | passthrough (`viewContainerRef` is not exposed)                                                                                                                                                                                                                                            |
| `title`, `closable`, `appearance`                    | not CDK — handed to the content through `DIALOG_CONFIG` and read by `mlv-dialog` / `mlv-dialog-header`.                                                                                                                                                                                    |
| —                                                    | `container: MlvDialogContainer` (+ `DIALOG_CONFIG` provider); `templateContext: { $implicit: ref, ref, data, config }`; `providers: (cdkRef) => [MlvDialogRef, DIALOG_CONFIG, (string content: MLV_DIALOG_TEXT)]`                                                                          |

The config object is frozen by copy at open time, so later mutation of the
caller's object never changes a live dialog. A `restoreFocus` resolver is the
deliberate exception in behavior: its function identity is frozen, but its
return value is sampled at actual disposal so responsive state can change while
the dialog remains open. Content can inject `MlvDialogRef`, `DIALOG_CONFIG`,
`DIALOG_DATA`, and the CDK's own `DialogRef`.

#### String content

Rendered by the internal `MlvDialogTextContent`, which composes the same public
parts. Its header is rendered only when it would carry something: a
`config.title`, or a close button (`closable !== false` and the appearance is
not `'confirm'`). Titleless string content names the dialog with the text.

#### Confirmation behaviour

`confirm()` opens the internal `MlvConfirmDialog` with `appearance: 'confirm'`
(borderless chrome, X forced off) and `size: 's'` unless overridden. It passes
no `title` — the component binds `options.title` on its own header. Every
dismissal that is not the confirm button — Escape, the backdrop, `ref.close()`
— resolves as `false`.

- **Description.** The service generates `ariaDescribedBy: mlvNextId('mlv-confirm-message')` and the component reads it back from `DIALOG_CONFIG` to `[id]` its message paragraph, so the container is described by the text the user has to act on. `MlvConfirmDialogOptions` never carries the id, and the component falls back to its own `mlvNextId('mlv-confirm-message')` if it is ever constructed without one.
- **Destructive.** `destructive: true` or `tone: 'danger'` opens the dialog with `role: 'alertdialog'`, turns the confirm button `error`-coloured, and puts initial focus on **Cancel**, so a reflexive Enter dismisses rather than destroys.
- **Tone → variant.** An exhaustive `Record<MlvTone, MlvButtonVariant>`: `danger` → `error`, `warning` → `warning`, `info` → `info`, `success` → `primary` (no dedicated variant). No tone at all is `'primary'`.
- **Labels** default to `MLV_DIALOG_I18N` (`confirm`, `cancel`) and are `computed()` over the i18n signal, so they follow a language change.
- **The answer is replayed.** The returned observable is `shareReplay({ bufferSize: 1, refCount: false })` over `afterClosed()`, connected while the dialog is still open (the CDK's `closed` subject is hot and emits once), so a subscriber that arrives after the dialog closed still receives the answer.

---

## Classes

### `MlvDialogRef<R, D>`

**File:** `libs/core/dialog/src/lib/dialog-ref.ts`

Composition wrapper around the CDK `DialogRef` (the CDK constructs its own ref,
so it cannot be subclassed). It no longer extends `MlvOverlayRef`. Consumers
never construct it — it arrives from `open()`, from DI, or in the template
context.

#### Properties

| Property         | Type                              | Description                                                              |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `data`           | `D`                               | Payload from `MlvDialogConfig.data`.                                     |
| `config`         | `Readonly<MlvDialogConfig<D>>`    | The configuration this dialog was opened with.                           |
| `id`             | `string`                          | Id of the container element (CDK-generated unless `config.id` was set).  |
| `animationState` | `Signal<MlvDialogAnimationState>` | `'enter'` → `'idle'` → `'leave'`; drives the surface's modifier classes. |

#### Methods

| Method             | Signature                                                               | Description                                                                                |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `close`            | `close(result?: R): void`                                               | Idempotent. Emits `beforeClose()`, plays the leave animation, then disposes with `result`. |
| `afterClosed`      | `afterClosed(): Observable<R \| undefined>`                             | Emits the result once the dialog is disposed (i.e. after the animation), then completes.   |
| `beforeClose`      | `beforeClose(): Observable<void>`                                       | Emits and completes synchronously at the start of `close()`, before the leave animation.   |
| `keydownEvents`    | `keydownEvents(): Observable<KeyboardEvent>`                            | Keydowns the CDK routes to **this** dialog — only while it is the topmost keydown target.  |
| `backdropClick`    | `backdropClick(): Observable<MouseEvent>`                               | Clicks on this dialog's backdrop.                                                          |
| `updateSize`       | `updateSize(width?: string \| number, height?: string \| number): this` | CDK passthrough — resizes the overlay pane.                                                |
| `addPanelClass`    | `addPanelClass(classes: string \| string[]): this`                      | CDK passthrough — adds class(es) to the overlay pane.                                      |
| `removePanelClass` | `removePanelClass(classes: string \| string[]): this`                   | CDK passthrough — removes class(es) from the overlay pane.                                 |

#### Leave handshake

`close()` marks the backdrop `mlv-dialog-backdrop--leaving`, flips
`animationState` to `'leave'` (so `<mlv-dialog>` gets `--leave`), and arms a
**250 ms** fallback timer. Whichever comes first — the surface's `animationend`
or the timer — disposes the CDK dialog and emits on `afterClosed()`. The
fallback is what covers reduced motion, hidden tabs, jsdom, and content whose
root is not `<mlv-dialog>`.

The CDK can also close on its own (history navigation with
`closeOnNavigation`, overlay detachment, the CDK's own `closeAll()`). The ref
subscribes to `cdkRef.closed` and marks itself disposed, so a later `close()`
and a late `animationend` from the torn-down surface are both no-ops.

#### Internal members

`_onSurfaceAnimationEnd()` (called by the surface), `_labelBy(id)` /
`_unlabelBy(id)` (called by `mlv-dialog-header`, forwarding to the CDK
container's `_addAriaLabelledBy` / `_removeAriaLabelledBy`). Not part of the
public contract.

---

## Interfaces & Types

### `MlvDialogConfig<D>`

**File:** `libs/core/dialog/src/lib/dialog-config.ts`

The single configuration object, used by `MlvDialogService.open()`,
`mlvDialogOptions`, and `mlvGenerateRoutableDialogRoute()`.

| Field               | Type                     | Default       | Description                                                                                    |
| ------------------- | ------------------------ | ------------- | ---------------------------------------------------------------------------------------------- |
| `size`              | `MlvDialogSize`          | `'m'`         | Preset name or explicit dimensions.                                                            |
| `appearance`        | `MlvDialogAppearance`    | `'default'`   | `'confirm'` drops the header/footer borders and hides the close button.                        |
| `title`             | `string`                 | `undefined`   | Plain-text title: string content, the `mlv-dialog-header` fallback, and the accessible name.   |
| `closable`          | `boolean`                | `true`        | Default for `mlv-dialog-header`'s close button.                                                |
| `panelClass`        | `string \| string[]`     | `undefined`   | Extra class(es) on the overlay pane (`.mlv-dialog-pane`).                                      |
| `backdropClass`     | `string \| string[]`     | `undefined`   | Extra class(es) on the backdrop (`.mlv-dialog-backdrop`).                                      |
| `hasBackdrop`       | `boolean`                | `true`        | Whether a backdrop is rendered.                                                                |
| `closeOnBackdrop`   | `boolean`                | `true`        | Whether a backdrop click closes the dialog.                                                    |
| `closeOnEscape`     | `boolean`                | `true`        | Whether Escape closes the dialog.                                                              |
| `closeOnNavigation` | `boolean`                | `true`        | Whether browser history navigation closes the dialog.                                          |
| `direction`         | `MlvDirection`           | resolved      | Text direction for the pane. The pane is portaled to `<body>`, so it never inherits a `[dir]` scope the opener sits in; defaults to the direction resolved from the focused element at open time, then the global direction. |
| `initialFocus`      | `MlvOverlayInitialFocus` | `'auto'`      | Where focus lands once open — see [libs-overlay.md](libs-overlay.md).                          |
| `restoreFocus`      | `MlvDialogRestoreFocus`  | `true`        | Captured opener, disabled, selector, explicit element, or a late resolver sampled at disposal. |
| `role`              | `MlvDialogRole`          | `'dialog'`    | ARIA role of the container.                                                                    |
| `ariaLabel`         | `string`                 | `undefined`   | Accessible name when no visible title labels the dialog.                                       |
| `ariaLabelledBy`    | `string`                 | `undefined`   | Id of a labelling element. Wins over `ariaLabel` and the header title.                         |
| `ariaDescribedBy`   | `string`                 | `undefined`   | Id of a describing element.                                                                    |
| `data`              | `D`                      | `undefined`   | Payload for `MlvDialogRef.data`, `DIALOG_DATA`, and the template context's `data`.             |
| `injector`          | `Injector`               | root injector | Parent injector for the content.                                                               |
| `id`                | `string`                 | CDK-generated | Id of the dialog container.                                                                    |

### `MlvDialogTemplateContext<R, D>`

```ts
interface MlvDialogTemplateContext<R = unknown, D = unknown> {
  $implicit: MlvDialogRef<R, D>; // let-dialog
  ref: MlvDialogRef<R, D>; // let-dialog="ref" — the same handle
  data: D; // let-data="data"
  config: Readonly<MlvDialogConfig<D>>; // let-config="config"
}
```

### `MlvDialogContent<R, D>`

```ts
type MlvDialogContent<R = unknown, D = unknown> = string | TemplateRef<MlvDialogTemplateContext<R, D>> | Type<unknown>;
```

Strings are rendered as escaped text, never as trusted HTML.

### Size types

```ts
type MlvDialogSizePreset = 's' | 'm' | 'l' | 'fullscreen';
type MlvDialogSize = MlvDialogSizePreset | (string & {}) | MlvDialogSizeConfig;
type MlvDialogSizePresets = Record<string, MlvDialogSizeConfig>;

interface MlvDialogSizeConfig {
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  minHeight?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;
}
```

Built-in presets (`DIALOG_SIZE_PRESETS`):

| Preset       | `width` | `height` | `maxWidth` | `maxHeight` | Notes                                                |
| ------------ | ------- | -------- | ---------- | ----------- | ---------------------------------------------------- |
| `s`          | `400px` | —        | `90vw`     | `90vh`      |                                                      |
| `m`          | `560px` | —        | `90vw`     | `90vh`      | Default; also the fallback for an unregistered name. |
| `l`          | `800px` | —        | `90vw`     | `90vh`      |                                                      |
| `fullscreen` | `100vw` | `100vh`  | `100vw`    | `100vh`     | Also adds `mlv-dialog-pane--fullscreen` to the pane. |

### Remaining unions

```ts
type MlvDialogAppearance = 'default' | 'confirm';
type MlvDialogRole = 'dialog' | 'alertdialog';
type MlvDialogFooterAlign = 'start' | 'end' | 'center' | 'between';
type MlvDialogAnimationState = 'enter' | 'idle' | 'leave';
```

### `MlvConfirmDialogOptions`

**File:** `libs/core/dialog/src/lib/confirm-dialog-options.ts`.
`title` and `message` are required; `confirmLabel`, `cancelLabel`,
`tone` (`MlvTone`), `destructive`, `size` (`MlvDialogSize`, same hint union as
`MlvDialogConfig.size`), `closeOnBackdrop`, `closeOnEscape` and `injector` are
optional. Kept in its own file so the barrel can export the
shape without the internal component that consumes it.

---

## Injection Tokens

### `DIALOG_DATA`

`InjectionToken<unknown>` — **Angular CDK's `DIALOG_DATA`, re-exported under the
same name** (`export const DIALOG_DATA: InjectionToken<unknown> = CDK_DIALOG_DATA`).
The identity is CDK's, so content injecting either import receives the same
`config.data`.

```ts
readonly data = inject(DIALOG_DATA) as MyDataType;
```

### `DIALOG_CONFIG`

`InjectionToken<Readonly<MlvDialogConfig>>` — the consumer's config for the
current dialog. Provided both on the container (so `MlvDialogContainer` can read
`initialFocus`) and on the content injector. `mlv-dialog` reads `appearance`
from it and `mlv-dialog-header` reads `title` / `closable` / `appearance`.
Template content gets the same object as `let-config="config"`.

### `DIALOG_SIZE_PRESETS`

`InjectionToken<MlvDialogSizePresets>`, `providedIn: 'root'` with the four
built-ins as its factory. Override it to change or add presets app-wide:

```ts
{
  provide: DIALOG_SIZE_PRESETS,
  useValue: {
    s: { width: '360px', maxHeight: '80vh', maxWidth: '90vw' },
    m: { width: '560px', maxHeight: '90vh', maxWidth: '90vw' },
    l: { width: '860px', maxHeight: '90vh', maxWidth: '90vw' },
    fullscreen: { width: '100vw', height: '100vh', maxWidth: '100vw', maxHeight: '100vh' },
    wide: { width: '1100px', maxHeight: '90vh', maxWidth: '95vw' },
  } satisfies MlvDialogSizePresets,
}
```

`mlv-dialog-pane--fullscreen` is stamped when the preset **name** is
`fullscreen` — an override that redefines or removes that preset still gets the
borderless, radius-less surface for that name; explicit `MlvDialogSizeConfig`
objects never get it.

---

## Styles

`ViewEncapsulation.None` throughout, so every class selector is global.

### DOM tree

```
.cdk-overlay-pane.mlv-dialog-pane[.mlv-dialog-pane--fullscreen]   ← sized by the CDK from `size`
  mlv-dialog-container.mlv-dialog-container[role][aria-*]         ← focus trap + ARIA (dialog-container.scss)
    (component host element, for component content)               ← flex pass-through
      mlv-dialog.mlv-dialog                                       ← the visible surface (dialog.scss)
        .mlv-dialog__header  →  .mlv-dialog__title / mlv-button-close.mlv-dialog__close
        .mlv-dialog__body    →  .mlv-dialog__body-scrollbar (mlv-scrollbar)
        .mlv-dialog__footer
.cdk-overlay-backdrop.mlv-dialog-backdrop[.mlv-dialog-backdrop--leaving]
```

### BEM

| Class                           | Role     | Description                                                                                                        |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `.mlv-dialog`                   | Block    | The surface: flex column, elevation background, border, modal shadow, clipped overflow, `md+` radius + height cap. |
| `.mlv-dialog--confirm`          | Modifier | Removes the header/footer borders.                                                                                 |
| `.mlv-dialog--enter`            | Modifier | Runs the `dialog-enter` keyframes.                                                                                 |
| `.mlv-dialog--leave`            | Modifier | Runs the `dialog-leave` keyframes.                                                                                 |
| `.mlv-dialog__header`           | Element  | Title/close row: flex, `space-between`, `spacing-3` gap and padding, bottom border.                                |
| `.mlv-dialog__title`            | Element  | Title box; owns `margin: 0` explicitly, and normalises a projected `h1`–`h6` to `font: inherit; margin: 0`.        |
| `.mlv-dialog__close`            | Element  | The X wrapper, `flex: none`.                                                                                       |
| `.mlv-dialog__body`             | Element  | Flexible clipped body host.                                                                                        |
| `.mlv-dialog__body-scrollbar`   | Element  | The `mlv-scrollbar` that owns body scrolling; its viewport carries the padding, its content is a flex column.      |
| `.mlv-dialog__text`             | Element  | String-content paragraph: preserved newlines, safe long-word wrapping.                                             |
| `.mlv-dialog__footer`           | Element  | Wrapping flex action row, `spacing-2` gap, `spacing-3` padding, top border, end-aligned.                           |
| `.mlv-dialog__footer--align-*`  | Modifier | `start` / `center` / `between` (`end` is the base rule).                                                           |
| `.mlv-dialog-pane`              | Block    | Overlay pane (`dialog-container.scss`): `display: flex; max-inline-size: 100vw`.                                   |
| `.mlv-dialog-pane--fullscreen`  | Modifier | Drops the surface's `md+` radius, border and `calc(100dvh - 2rem)` cap so `size: 'fullscreen'` is edge-to-edge.    |
| `.mlv-dialog-container`         | Block    | CDK container host: flex column, fills the pane, `outline: 0`; a non-`.mlv-dialog` child gets a flex pass-through. |
| `.mlv-dialog-backdrop`          | Block    | Backdrop.                                                                                                          |
| `.mlv-dialog-backdrop--leaving` | Modifier | Fades opacity and blur back to zero.                                                                               |

- **Keyframes** `dialog-enter` / `dialog-leave` and the `--enter` / `--leave` rules live in `libs/styles/src/lib/animations.scss`, gated behind `prefers-reduced-motion` there. Durations/easings are overridable through `--mlv-dialog-enter-*` / `--mlv-dialog-leave-*`.
- **Backdrop split:** the base look (`background`, `opacity`, `backdrop-filter`, transitions) is in `libs/styles/src/lib/overlay.scss` under `@layer mlv.components`, because the backdrop is DOM the CDK creates and no component stylesheet owns it. The `@starting-style` entry and the `--leaving` state live in `dialog-container.scss`, which every dialog loads.

---

## Usage examples

### Declarative

```html
<button mlvButton (click)="open.set(true)">Open dialog</button>

<ng-template [(mlvDialog)]="open" (mlvDialogClosed)="onClosed($event)">
  <mlv-dialog>
    <mlv-dialog-header title="Dialog title" />
    <mlv-dialog-body>
      <p>Body content.</p>
    </mlv-dialog-body>
    <mlv-dialog-footer>
      <button mlvButton variant="secondary" mlvDialogClose>Cancel</button>
      <button mlvButton mlvDialogClose="confirmed">Confirm</button>
    </mlv-dialog-footer>
  </mlv-dialog>
</ng-template>
```

```ts
readonly open = signal(false);

/** `undefined` means dismissed (Escape, backdrop, or the X). */
onClosed(result: unknown): void {
  this.lastResult.set(typeof result === 'string' ? result : 'dismissed');
}
```

### Confirm appearance (borderless, projected heading)

```html
<ng-template [(mlvDialog)]="open" [mlvDialogOptions]="{ size: 's', appearance: 'confirm' }">
  <mlv-dialog>
    <mlv-dialog-header><h4>Delete item?</h4></mlv-dialog-header>
    <mlv-dialog-body><p>This action cannot be undone.</p></mlv-dialog-body>
    <mlv-dialog-footer align="between">
      <button mlvButton variant="secondary" mlvDialogClose>Cancel</button>
      <button mlvButton variant="error" mlvDialogClose="deleted">Delete</button>
    </mlv-dialog-footer>
  </mlv-dialog>
</ng-template>
```

### Programmatic — string, template, component

```ts
private readonly dialogs = inject(MlvDialogService);

openString(): void {
  this.dialogs.open('Your workspace settings have been saved.', {
    size: 's',
    title: 'Settings saved',
  });
}

openTemplate(tpl: TemplateRef<MlvDialogTemplateContext<string, ProjectData>>): void {
  this.dialogs
    .open<string, ProjectData>(tpl, { title: 'Website redesign', data: { owner: 'Mina Park' } })
    .afterClosed()
    .subscribe((result) => {
      /* string | undefined */
    });
}

openComponent(): void {
  this.dialogs.open<string, ProjectData>(ProjectDialogContent, {
    title: 'Mobile app launch',
    data: { owner: 'Alex Chen' },
  });
}
```

```html
<!-- The template IS the content: it renders the surface itself. -->
<ng-template #tpl let-dialog let-data="data">
  <mlv-dialog>
    <mlv-dialog-header />
    <!-- no title input, no projection → falls back to config.title -->
    <mlv-dialog-body>
      <p>Owner: {{ data.owner }}</p>
    </mlv-dialog-body>
    <mlv-dialog-footer>
      <button mlvButton variant="secondary" (click)="dialog.close()">Dismiss</button>
      <button mlvButton (click)="dialog.close('reviewed')">Mark reviewed</button>
    </mlv-dialog-footer>
  </mlv-dialog>
</ng-template>
```

Component content follows the same rule — its template root is `<mlv-dialog>`,
and it injects what it needs:

```ts
@Component({
  imports: [MlvButton, MlvDialog, MlvDialogHeader, MlvDialogBody, MlvDialogFooter, MlvDialogClose],
  template: `
    <mlv-dialog>
      <mlv-dialog-header />
      <mlv-dialog-body>
        <mlv-input [formControl]="name" />
      </mlv-dialog-body>
      <mlv-dialog-footer>
        <button mlvButton variant="secondary" mlvDialogClose>Cancel</button>
        <button mlvButton [mlvDialogClose]="name.value">Save</button>
      </mlv-dialog-footer>
    </mlv-dialog>
  `,
})
export class EditNameDialog {
  readonly data = inject(DIALOG_DATA) as EditData;
  readonly config = inject(DIALOG_CONFIG);
  private readonly ref = inject<MlvDialogRef<string, EditData>>(MlvDialogRef);
  readonly name = new FormControl(this.data.initialName);
}
```

### `confirm()`

```ts
this.dialogs
  .confirm({
    title: 'Delete project?',
    message: 'The project and all of its tasks are removed.',
    confirmLabel: 'Delete project',
    destructive: true,
  })
  .subscribe((confirmed) => {
    if (confirmed) this.deleteProject();
  });
```

### Route-driven

```ts
export default [
  {
    path: 'users',
    component: UsersListPage,
    children: [
      mlvGenerateRoutableDialogRoute(() => import('./user-edit'), { path: ':id/edit', size: 'l' }),
      {
        ...mlvGenerateRoutableDialogRoute(() => import('./confirm'), { path: 'confirm', size: 's' }),
        canActivate: [authGuard],
        resolve: { item: itemResolver },
      },
    ],
  },
] satisfies Routes;
```

The routed component renders the surface like any other component content and
can inject `ActivatedRoute` (the shell forwards its injector) plus
`MlvDialogRef`:

```ts
@Component({
  imports: [MlvButton, MlvDialog, MlvDialogHeader, MlvDialogBody, MlvDialogFooter, MlvDialogClose],
  template: `
    <mlv-dialog>
      <mlv-dialog-header title="Edit user" />
      <mlv-dialog-body>…</mlv-dialog-body>
      <mlv-dialog-footer><button mlvButton mlvDialogClose="saved">Save</button></mlv-dialog-footer>
    </mlv-dialog>
  `,
})
export default class UserEditDialog {
  readonly route = inject(ActivatedRoute);
}
```

---

## Accessibility

- **Accessible name**, in order: `config.ariaLabelledBy` → `config.ariaLabel` (suppresses `aria-labelledby` entirely) → the `mlv-dialog-header` title id → the text of string content. A header without a rendered title registers nothing, so the dialog is never named by an empty element. A surface with no header title, no `config.title`, and no `ariaLabel`/`ariaLabelledBy` leaves the dialog **unnamed** (an axe `aria-dialog-name` violation) — always give a dialog one of them. The header registers/removes its title id as the dialog label whenever the rendered title gains/loses text (async titles are picked up); the id is unique per header instance.
- **Role:** `config.role`, `'dialog'` by default; `'alertdialog'` for interruptions that need an immediate answer — `confirm()` picks it automatically for a destructive/`'danger'` confirmation. Applied to `mlv-dialog-container`, not to the surface.
- **`aria-modal="false"`** on the container is CDK parity and deliberate: with `aria-modal="true"` assistive tech treats every node outside the container as inert, which would swallow select/menu popups the CDK renders as siblings of the dialog. The CDK `aria-hidden`s the rest of the page instead, which achieves modality without that side effect.
- **Focus in:** the CDK focuses the container first (so the page is hidden from AT), then `initialFocus` is applied. `'auto'` prefers a projected `[mlvAutofocus]`, then the first tabbable element that is **not** the close button or the body's scroll viewport, then the container.
- **Focus out:** `restoreFocus` defaults to `true`, returning focus to the element that was focused before the dialog opened. A CSS selector is resolved at close time; an explicit `HTMLElement` selects a fixed target; `false` disables restoration. A `MlvDialogRestoreFocusResolver` is sampled at actual disposal for responsive composition. When it returns `true`, Malva uses the captured opener only if it is still connected; when it returns an element, that element must be connected. If the resolver throws, restoration is skipped and the complete close/disposal lifecycle still finishes. Existing static boolean/string/element consumers retain their CDK semantics.
- **Escape / backdrop:** both close by default and are independently opt-out-able (`closeOnEscape`, `closeOnBackdrop`); Escape with a modifier key is ignored. Either way the leave animation plays before disposal.
- **Keyboard:** focus is trapped by the CDK container; `[mlvDialogClose]` on a `<button>` inherits native Enter/Space activation.
- **Motion:** the enter/leave keyframes are gated behind `prefers-reduced-motion`, and the ref's 250 ms fallback timer guarantees disposal when no `animationend` ever arrives.

### Stacked dialogs and popups

Escape closes **one layer at a time**, and nothing here has to be coded for it.
The CDK's `OverlayKeyboardDispatcher` listens once on `body` and walks the
attached overlays from the top down, delivering the keydown to the **first**
overlay that has keydown observers and then stopping. Every CDK `DialogRef`
subscribes to its own overlay's keydowns, so a dialog opened on top of another
one is that first overlay: Escape reaches only the topmost dialog, and the one
below it stays open. The same rule covers popups — a `mlv-select`,
`mlv-combobox` or `mlv-menu` panel opened from inside a dialog is an overlay
above it, so Escape dismisses the popup and leaves the dialog open. The
"keydown observers" half of the rule matters just as much: an overlay without
keydown observers (e.g. the tooltip, which handles Escape on its trigger's host
instead) is transparent to Escape — the dialog below still receives it.

Because the topmost layer wins, `openDialogs` unwinds from its end: Escape,
then Escape again, closes newest-first — the same order `closeAll()` uses.

To gate a close (unsaved changes, a confirmation step), opt the automatic
behaviour out and drive it yourself from the ref's own streams — they emit only
when this dialog is the layer that received the event:

```ts
private readonly destroyRef = inject(DestroyRef);
private confirming = false;

// …in the method that opens the dialog — `takeUntilDestroyed()` is outside an
// injection context here, so it needs the DestroyRef passed explicitly.
const ref = this.dialogs.open(EditForm, { closeOnEscape: false, closeOnBackdrop: false });

// Two subscriptions rather than one merged stream: only the keydown one can
// `preventDefault()`.
ref
  .keydownEvents()
  .pipe(
    filter((event) => event.key === 'Escape' && !hasModifierKey(event)),
    takeUntil(ref.beforeClose()),
    takeUntilDestroyed(this.destroyRef),
  )
  .subscribe((event) => {
    event.preventDefault();
    this.attemptClose(ref);
  });

ref
  .backdropClick()
  .pipe(takeUntil(ref.beforeClose()), takeUntilDestroyed(this.destroyRef))
  .subscribe(() => this.attemptClose(ref));

private attemptClose(ref: MlvDialogRef): void {
  if (this.confirming) return;
  if (this.form.pristine) return ref.close();

  this.confirming = true;
  this.dialogs
    .confirm({ title: 'Discard changes?', message: 'Your edits are lost.' })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe((yes) => {
      this.confirming = false;
      if (yes) ref.close();
    });
}
```

`beforeClose()` emits synchronously when `close()` starts, so the guard disarms
before the leave animation — without it the subscriptions outlive the close by
one `animationend` (or the 250 ms fallback) and an Escape in that window opens
an orphan confirmation. The `confirming` flag covers the other re-entry: a
second exit attempt while the confirmation is already up.

---

## Testing

| Spec                                          | Tests | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dialog-ref.spec.ts`                          | 10    | Idempotent close, `beforeClose`/`afterClosed` ordering, the enter→idle and leave→dispose handshake, the 250 ms fallback, backdrop leaving class, label registration, inertness after a CDK-initiated close, and the `keydownEvents()`/`backdropClick()` passthrough.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `dialog-parts.spec.ts`                        | 20    | Surface classes + consumer class + target-guarded `animationend`, the outside-a-dialog error, header title precedence / `closable` precedence / labelling (including the no-title, late-title, title-removed and destroy cases, and two headers getting distinct ids) / no leftover `title` attribute, body scrollbar wrapping, footer align modifiers, `mlvDialogClose` result and `type`, and the attribute forms + `<a mlvDialogClose>`.                                                                                                                                                                                                                                                                          |
| `dialog.service.spec.ts` (`MlvDialogService`) | 31    | Template/component/string content and their DI + context, a11y-name precedence, `role`/`ariaDescribedBy`, size presets + fallback + the fullscreen pane modifier, panel/backdrop classes, `DIALOG_CONFIG` reaching the header, Escape/backdrop opt-outs, the leave-then-dispose order and fallback, `closeAll()`/`openDialogs`, CDK-initiated close, `initialFocus`, static boolean/selector/element compatibility, disposal-time resolver evaluation, detached-opener protection, throwing-resolver containment with complete lifecycle cleanup and a healthy subsequent dialog, and stacking (Escape unwinds one layer at a time, a bare overlay on top swallows it, opt-outs surfaced through the ref's streams). |
| `dialog.service.spec.ts` (`…​.confirm`)       | 15    | Confirm surface + labels + no X, single emit and completion, Escape/backdrop → `false`, custom labels, every tone→variant mapping, destructive/`'danger'` variant + `alertdialog` role + Cancel focus, non-destructive Confirm focus + `dialog` role, the default `'s'` size, `aria-describedby` pointing at the message, the replay to a late subscriber, and axe rule guards (`aria-dialog-name`, `aria-valid-attr-value`, `aria-allowed-attr`, `aria-required-attr`) for a destructive `alertdialog` and a plain `dialog` confirm.                                                                                                                                                                                |
| `dialog-template.spec.ts`                     | 9     | `[(mlvDialog)]` open/close through the model, `mlvDialogClosed` result, options applied, re-open re-instantiates, a re-open requested mid-leave, host destroy closing the dialog and emitting nothing afterwards, throwing-resolver disposal settling the declarative model/result/ref state, and `open()`/`close()`/`ref` through `exportAs`.                                                                                                                                                                                                                                                                                                                                                                       |

The routable dialog has no lib spec — it is covered by docs example 6 on
`/dialog` and by the docs build.

---

## Dependencies

| Package                    | Usage                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@angular/cdk/dialog`      | `Dialog` (engine), `DialogRef`, `DialogConfig`, `CdkDialogContainer` (base of `MlvDialogContainer`), `DIALOG_DATA`.                                            |
| `@angular/cdk/portal`      | `CdkPortalOutlet` in the container template, `ComponentType` in the service signature.                                                                         |
| `@angular/cdk/platform`    | Shadow-DOM-aware capture of the opener used when a late restore resolver returns `true`.                                                                       |
| `@angular/cdk/coercion`    | `coerceBooleanProperty` (`closable`), `coerceArray` (panel/backdrop classes), `coerceCssPixelValue` (sizes).                                                   |
| `@angular/cdk/keycodes`    | `hasModifierKey` — Escape with a modifier does not close.                                                                                                      |
| `@angular/router`          | `Router`, `ActivatedRoute` in the routable-dialog shell.                                                                                                       |
| `@malva-ui/cdk/overlay`    | `MlvOverlayInitialFocusResolver`, `MlvOverlayInitialFocus` — the shared `initialFocus` strategy. Nothing else; the dialog no longer extends the overlay bases. |
| `@malva-ui/cdk/utils`      | `MlvTone` in `MlvConfirmDialogOptions` and the confirm tone→variant record; `mlvNextId` for the header title id and the confirm message id.                    |
| `@malva-ui/core/button`    | `MlvButtonClose` (the header X) and `MlvButton` (confirm actions).                                                                                             |
| `@malva-ui/core/scrollbar` | `MlvScrollbar` — the body's scroll viewport.                                                                                                                   |
| `@malva-ui/i18n`           | `MLV_DIALOG_I18N` — `closeDialog`, `confirm`, `cancel`.                                                                                                        |
| `rxjs`                     | `Subject`/`Observable` behind `beforeClose()`, `map`/`filter`/`shareReplay` in the service.                                                                    |
