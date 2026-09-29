---
# Library: file-upload

Nx project name: `core-file-upload`. The feature is published only as the
`@malva-ui/core/file-upload` secondary entry point; it has no independent leaf
package manifest. Internal action buttons explicitly use `type="button"`.

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The File Upload library (`@malva-ui/core/file-upload`) provides a drag-and-drop file upload component with MIME type and size validation, multi-file support, image preview generation, upload progress display, and signal/reactive/template-driven forms integration.

## Public API

Exported from `libs/core/file-upload/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvFileUpload` | Component | Drag-and-drop file upload zone — `mlv-file-upload` |
| `MlvFileUploadItem` | Component | Single file row with thumbnail, metadata, progress, and remove button — `mlv-file-upload-item` |
| `MlvFileUploadAction` | Directive | `[mlvFileUploadAction]` — projects an extra control into the drop zone's action row; `position` picks the side |
| `MlvFileUploadActionPosition` | Type | `'start' \| 'end'` |
| `MlvFileUploadPreviewMode` | Type | `'list' \| 'cover'` — how the zone presents the current selection |
| `MlvUploadedFile` | Interface | Descriptor for a selected/uploaded file |
| `MlvFileValidationError` | Interface | Validation failure with machine-readable `code` and human-readable `message` |
| `MlvFileUploadState` | Type | `'idle' \| 'dragging' \| 'disabled'` |

---

## Components

### `MlvFileUpload`

**File:** `libs/core/file-upload/src/lib/file-upload/file-upload.ts`
**Template:** `libs/core/file-upload/src/lib/file-upload/file-upload.html`
**Styles:** `libs/core/file-upload/src/lib/file-upload/file-upload.scss`
— the block is `position: relative` so the visually-hidden native
`<input type="file">` (`position: absolute`, clip pattern) is contained by
the component rather than by a positioned ancestor outside a scroll
viewport (in a drawer / dialog body that is the scrollbar host, and focusing
the input then scrolls the `overflow: hidden` body to it).

- **Selector:** `mlv-file-upload`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Extends:** `MlvSignalFormControlBase<MlvUploadedFile[]>` (`FormValueControl` contract)

#### Inputs

| Name          | Type                       | Default                                                   | Description                                                                    |
| ------------- | -------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `accept`      | `string`                   | `''`                                                      | Comma-separated accepted MIME types or file extensions (e.g. `"image/*,.pdf"`) |
| `maxSize`     | `number`                   | `0`                                                       | Maximum allowed file size in bytes; `0` = unlimited                            |
| `multiple`    | `BooleanInput`             | `true`                                                    | Allow selecting multiple files                                                 |
| `title`       | `string \| undefined`      | `undefined` → i18n `dropFiles` ("Drag & drop files here") | Primary heading in the drop zone; a bound string wins                          |
| `subtitle`    | `string`                   | `''`                                                      | Secondary description text                                                     |
| `actionLabel` | `string \| undefined`      | `undefined` → i18n `browseFiles` ("Browse files")         | Label text (and accessible name) of the browse button; a bound string wins     |
| `compact`     | `BooleanInput`             | `false`                                                   | Renders a compact single-row drop zone                                         |
| `previewMode` | `MlvFileUploadPreviewMode` | `'list'`                                                  | `'cover'` lets a single selected image fill the zone (see **Cover preview**)   |

#### Outputs

| Name          | Type                                  | Description                                                               |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| `filesChange` | `OutputEmitterRef<MlvUploadedFile[]>` | Emits the current file list whenever files are added, removed or replaced |

#### Host Bindings

```ts
host: {
  'class': 'mlv-file-upload',
  '[attr.title]': 'null',
  '[class.mlv-file-upload--cover]': '_isCover()',
  '[class.mlv-file-upload--drag-over]': '_isDragOver()',
  '[class.mlv-file-upload--disabled]': 'computedDisabled()',
  '[class.mlv-file-upload--error]': '_errors().length > 0',
  '[class.mlv-file-upload--multiple]': 'multiple()',
  '[class.mlv-file-upload--has-files]': '_files().length > 0',
  '[class.mlv-file-upload--compact]': 'compact()',
  '(dragleave)': '_onDragLeave($event)',
  '(drop)': '_onDrop($event)',
}
```

`touch` is emitted when focus leaves the control — the constructor calls the
base's `_reportTouchOnFocusLeave()` (#347, `libs-form-utils.md` § _Touched when
focus leaves the control_). It used to be a host `(focusout)` → `_markTouched()`,
which touched on every move inside the zone too — browse button → a file's
remove button. Spec: `file-upload-touched.spec.ts`.

`dragover` is **not** a host binding. The browser fires it continuously while a
drag hovers the zone, and an Angular listener binding notifies the
change-detection scheduler on every one of those events before knowing whether
anything changed — where `_isDragOver.set(true)` writes an unchanged value after
the first. It is bound in the constructor instead, as
`fromEvent(host, 'dragover', { passive: false }).pipe(takeUntilDestroyed())`.
`{ passive: false }` is mandatory: `_onDragOver` must call `preventDefault()` or
the browser never dispatches `drop` at all.

#### Public Methods

| Method                     | Description                                                                                                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openFilePicker()`         | Programmatically opens the native file picker dialog                                                                                                                                                                                                |
| `onFileInputChange(event)` | Handles changes from the hidden file `<input>`                                                                                                                                                                                                      |
| `removeFile(id)`           | Removes a file by its id; revokes the preview URL the component created for it (see **Preview URL lifetime**), never a consumer's. A no-op while `computedDisabled()` (no `filesChange`, #568) — write `value` / the form model to clear files then |

#### Validation Logic

- **Type check:** Parsed from `accept` input. Supports MIME prefix globs (`image/*`), exact MIME types (`application/pdf`), and file extensions (`.pdf`).
- **Size check:** Files exceeding `maxSize` bytes are rejected. Skipped when `maxSize === 0`.
- **Count check / single-file replace:** when `multiple === false` the value holds at most one file, and a new file **replaces** it.
  - Counted per batch (one pick or one drop), never against the file already selected.
  - Browse, drop and the cover **Replace** action all take this path: an accepted file replaces the current one, the preview URL the component created for it is revoked (a consumer-supplied one is not — see **Preview URL lifetime**), `filesChange` / `value` emit `[replacement]`, and the error list is replaced by this batch's errors (empty when the batch is one accepted file).
  - A rejected file (type / size) leaves the current file and its preview untouched; the error names the real reason.
  - A multi-file drop keeps its **first accepted** file and reports the rest with **one** `code: 'count'` error (`errorSingleFile`), not one per extra file.
  - Order per file: count → type → size, so `[bad.pdf, b.png]` under `accept="image/*"` keeps `b.png` with a type error for `bad.pdf`.
  - Programmatic writes (`value.set`, `setValue`, `ngModel`) are not validated — a two-file array written from outside is held as given.
  - Fixed 2026-09 (#313): the check read `_files().length + newFiles.length >= 1`, true whenever a file was present, so every second file was refused with "Only one file is allowed." and the replace branch plus its revoke never ran. Patch, not breaking — it restores what `apps/docs` examples 1 and 7, the `errorSingleFile` i18n JSDoc ("more than one file is dropped") and the `replaceFile` key already documented.
- Validation errors stored in `_errors` signal and rendered in `[role=alert]` list with `aria-live="assertive"`.
- **Rejection messages are translated** (2026-08). Each `MlvFileValidationError.message` is resolved from `MLV_FILE_UPLOAD_I18N` through `MlvI18nResolverService`, not hard-coded English: `errorSingleFile` (count), `errorFileType` (`{name}`), `errorFileSize` (`{name}`, `{size}` in MB, one decimal). Consumers reading `error.message` get the active language pack's string.
- **`title` / `actionLabel` defaults are pack-backed (#371).** Both are now `string | undefined` (default `undefined`) and resolve input → optional `MLV_FILE_UPLOAD_I18N` key (`dropFiles` / `browseFiles`) → English fallback (`OPTIONAL_MESSAGE_FALLBACKS`, byte-identical to the old defaults). Translated in all 14 packs; a live switch re-renders both (`file-upload-i18n.spec.ts`). Minor (row 115); a read typed `string` (`const t: string = upload.title()`) now fails TS2322 — add `?? ''`. `subtitle` keeps its `''` default (nothing to translate). The per-item "Uploading …" loader label is still English — #393.
- **`replaceFile`** was added to `MlvFileUploadI18n` (and `MLV_FILE_UPLOAD_I18N_CONTEXT`) for the cover toolbar's replace button, and is translated in all fourteen packs. `MlvFileUploadI18n` now has 8 keys.
- **No native tooltip from `title`.** `title` names the zone's heading, but written as a static attribute (`title="Image"`) it also lands in the DOM and gives the whole zone a browser tooltip repeating that heading. The host therefore binds `'[attr.title]': 'null'` to strip it. Regression-tested in `file-upload-cover.spec.ts`.
- No `aria-required`: the drop zone's focus target is a `<button>`, and ARIA does not allow `aria-required` on `button`. The inherited `required` input therefore has no ARIA effect on `mlv-file-upload` — express the requirement in the surrounding `mlv-form-field` / label copy instead.

#### Content Projection

The drop zone's action row (`.mlv-file-upload__zone-action`) has two projection
slots around the built-in browse button:

```html
<ng-content select="[mlvFileUploadAction]:not([position=end])" />
<button mlvButton …>{{ actionLabel() }}</button>
<ng-content select="[mlvFileUploadAction][position=end]" />
```

DOM order equals visual order — nothing is reordered with CSS `order` — so the
keyboard tab sequence always matches what the user sees. The row is an
`inline-flex`, centre-aligned, `flex-wrap: wrap` line with a
`var(--mlv-spacing-2)` gap; in `compact` mode it drops the stacked layout's
`margin-top` so it stays on the row baseline.

**The two slots live on a single container that is never duplicated.** In cover
state that same element re-labels itself `.mlv-file-upload__toolbar` and only
its built-in buttons swap inside `@if` branches. This is a hard Angular
constraint, not a style choice: a projected node is assigned to the **first**
`<ng-content>` whose selector matches it, so repeating a selector — even across
mutually exclusive `@if`/`@else` branches — leaves the later copy permanently
empty. Verified in `file-upload-cover.spec.ts`, which asserts the projected
buttons land in the action row in list mode and in the toolbar in cover mode.

#### Cover preview (`previewMode="cover"`)

Opt-in and non-breaking; `previewMode` defaults to `'list'`, today's behaviour.

**Activation.** `_coverFile()` resolves to the covered file only when all of
these hold, and the zone silently falls back to the list layout otherwise:

1. `previewMode() === 'cover'`,
2. `multiple()` is `false`,
3. exactly one file is selected, and
4. that file has a truthy `previewUrl`.

`previewUrl` is generated automatically for any dropped/picked `image/*` file.
For an **edit-mode seed**, set it yourself on the `MlvUploadedFile` — a remote
`https://…` or a `data:` URL works exactly like the generated `blob:` one.
`MlvUploadedFile.file` stays required, so a seed that never went through the
picker passes a placeholder (`new File([], name)`).

**Markup.** The host gains `mlv-file-upload--cover` and the zone renders:

- `.mlv-file-upload__cover-image` — a plain `<img>` (not `NgOptimizedImage`:
  the source is a runtime blob/data/remote URL of unknown intrinsic size),
  absolutely filling the zone with `object-fit: cover`, `border-radius:
inherit`, and `pointer-events: none` so it never intercepts a drop.
- `.mlv-file-upload__toolbar` — the floating bar, bottom-centred inside the
  zone on `--mlv-background-raised` / `--mlv-shadow-floating` /
  `--mlv-radius-l`. Contents, in DOM and visual order:
  `[start actions] [Replace] [end actions] [Remove]`. Both built-ins are
  `button[mlvButton] shape="square" variant="transparent"` (`lucideRefreshCw`
  → `openFilePicker()`, `lucideTrash2` → `removeFile(id)`), they
  `stopPropagation()` like the browse button, and they take `disabled` from
  `computedDisabled()`.
- Title, subtitle and the browse button are not rendered in this state.

The zone gets `position: relative`, `overflow: hidden`, `padding: 0`,
`flex: 1 1 auto` and `min-block-size: var(--mlv-file-upload-cover-min-height)`
(default `12rem`) — so it honours an explicit height set on the host and
otherwise keeps a sensible floor. The whole zone remains the drag-and-drop
target; dropping a new file, or picking one from **Replace**, replaces the
current one (see **Count check / single-file replace** above).

**Visibility.** The toolbar is always in the DOM. It is hidden with
`opacity: 0; pointer-events: none` and revealed on `.mlv-file-upload__zone`
`:hover` / `:focus-within`, plus unconditionally under `@media (hover: none)`.
It deliberately does **not** use `visibility: hidden`: that would drop the
buttons out of the tab order, and Replace is the keyboard entry point once the
browse button is gone, so `:focus-within` could never fire. `pointer-events:
none` while hidden also keeps drags passing straight through to the zone.
`mixins.reduced-motion('mlv-file-upload')` makes the fade instant under
`prefers-reduced-motion`.

**Uploading.** A covered file with `state === 'uploading'` and `progress < 100`
keeps the cover and overlays `.mlv-file-upload__cover-progress`
(`mlv-loader variant="bar"`, already a dependency of this library) across the
top of the image — it does **not** fall back to list mode.

**File list.** The single file's `mlv-file-upload-item` row is suppressed in
cover state: it would only repeat the image and a second remove control that
the toolbar already provides. The validation error list still renders below the
zone as usual.

#### Preview URL lifetime

Fixed 2026-09 (#352). Before, the only revocations were `removeFile` and the
single-file replace, and both revoked **any** `previewUrl` — a consumer's own
`blob:` URL included — while an external write (form `reset()`, `[(value)]`
set to `[]`) or a destroy revoked nothing, so every reset kept each selected
image's object URL (and the `File` behind it) registered until the page
unloaded.

- **Owned URLs only.** The component creates a `blob:` URL for each accepted
  `image/*` file through the internal root service `MlvFileUploadPreviewUrls`
  (`file-upload-preview-urls.ts`, not exported) and revokes only those.
  Ownership follows the URL **string**: an owned URL copied into a new entry,
  another upload's value or the consumer's own state stays owned.
- **Consumer-supplied URLs are the consumer's to revoke.** A `previewUrl` the
  consumer supplies (edit-mode seed: `https://…`, `data:`, or its own `blob:`)
  is never revoked. Before #352 `removeFile` and the single-file replace
  revoked it anyway, and their JSDoc promised so with no ownership condition —
  so a consumer that seeded its own `blob:` preview and let those two clean it
  up now keeps it alive until unload. **Do:** revoke a `blob:` URL you created
  when you drop the entry (in your `filesChange` handler, or where you clear
  the value). Patch-class under the #316 template: ticket-prescribed, memory
  only.
- **Revoked when it leaves the value, after the render.** `_syncPreviews(files)`
  reconciles the owned URLs the instance holds with the value: an `effect` over
  `_files()` catches every write (form `reset()` / `setValue`, `ngModel`,
  `[(value)]`, a signal-forms model write — the forms interop writes the model
  during change detection, not synchronously — and `removeFile`), and
  `_validateAndAdd` also calls it synchronously, before `filesChange`, so a
  pick a consumer filters out of a one-way `[value]` in that handler has been
  retained and is released (never retained, it would never be revoked). A
  release to zero does not revoke on the spot: the registry queues the URL and
  revokes it in an `afterNextRender` flush **only if it is still at zero**.
  Constructor effects run in view order, so a file moved between two mounted
  uploads in one tick (`a.set([]); b.set(moved)`, or a copy into `b` followed
  by `a.removeFile()`, or a replaced file archived into `b` from `filesChange`)
  touches zero before the target retains it; revoking there handed the target
  a dead URL. A microtask is not enough: the replace and `removeFile` run in an
  event handler, and the zoneless render — where the target retains — is a
  later task. On the server `afterNextRender` never runs, but nothing is ever
  queued there: URLs are created only from browser `change` / `drop` events.
  At application teardown the flush is not deferred: `ApplicationRef.destroy()`
  marks the root injector destroyed **before** it destroys the views, so an
  upload dropping a URL from its destroy hook (a `removeFile` or write in the
  same task — a micro-frontend or Angular Elements unmount, a Storybook story
  switch) would call `afterNextRender` on a destroyed injector, which throws
  NG0205 out of `appRef.destroy()` and skips every later destroy hook. With the
  injector destroyed the registry revokes what is queued at once — no upload can
  mount to retain it — including anything queued behind a flush scheduled before
  the teardown, which Angular destroys unrun after the views. TestBed never
  reaches this order (it destroys fixtures before its injector); the specs boot
  a real `createApplication`. A write that keeps an entry — an immutable
  progress patch `{ ...file, progress }` — keeps its URL. O(files) per value
  change.
- **Destroy hands on, it does not revoke.** The value outlives the upload in
  the consumer's hands (a form, a signal, a dialog result), so `onDestroy`
  reconciles once more (a direct model write in the same tick lands before any
  effect could) and then releases what the value still holds **without**
  revoking it. An upload later mounted with that value retains the URL and
  revokes it when it leaves that upload's value. Deliberately not the issue's
  proposal ("revoke all on destroy"): revoking there breaks every upload that
  sits in an `@if` over a value kept outside it — measured in Chromium 153, an
  `<img>` created after `URL.revokeObjectURL()` fails to load — which is the
  docs website-builder hero image (background image → colour → image) and the
  publishing-workspace media section (open, then close, version comparison).
  Ablating the hand-off turns exactly the re-mount spec red.
- **Several mounted uploads.** The registry counts, per URL, the mounted
  uploads whose value references it; a URL is revoked only when the last of
  them drops it. A value an unmounted upload handed on is not counted: if a
  mounted upload still shares the URL and later drops it, it is revoked, and
  the handed-on value re-mounts with a dead preview — the contract is
  "referenced by a mounted upload".
- **Residual leak, by design.** A value discarded while it still holds owned
  previews — the upload destroyed and the consumer's state dropped with it,
  never cleared — keeps those URLs until the page unloads, as before; the
  component cannot tell a discarded value from one kept for a re-mount. So does
  a value dropped in the same change detection that destroys the upload through
  a binding (`files.set([])`, a reactive `reset()` or a signal-forms model write,
  plus an `@if` turning false): the binding never reaches the destroyed view,
  and so does every route leave. Clear the value while the upload is mounted,
  or revoke the previews yourself (`apps/docs`' publishing-workspace revokes its
  attachments' `blob:` URLs on destroy, and the website-builder revokes the
  hero image's when the block dialog closes, in `clearEditing()`;
  `@malva-ui/editor`'s image-upload dialog revokes its one preview on close). A consumer revoke
  leaves only a string entry in the registry; a second revoke by the registry
  is a no-op. Reclaiming discarded values is a follow-up filed from #352: a
  `FinalizationRegistry` keyed on `entry.file` (never on the entry object,
  which every immutable progress patch replaces while the URL stays live).
- **Consumer caveat.** A consumer that copies an owned `previewUrl` elsewhere
  sees it die with the entry. For a preview that must outlive the entry, create
  one from `entry.file` with `URL.createObjectURL` and own it.
- Specs: `file-upload-preview-urls.spec.ts` — 18 cases asserting **which** URLs
  were revoked through a `URL.revokeObjectURL` spy; 14 are red on the
  pre-#352 component (the two teardown specs and the `@if`-receiver spec pass
  there, since it never deferred a revoke). Ablations, each turning its own
  specs red: the effect; the `_validateAndAdd` sync (the veto spec); the
  destroy-time sync (plus both teardown specs); the hand-off
  (`release(url, true)` at destroy); the refcount; the deferred flush (revoking
  at zero turns the four same-tick move specs red, the `@if`-created receiver
  among them); the zero check at flush (the move specs); an `afterNextRender` →
  microtask swap (the archive spec, among others); the teardown guard (both
  teardown specs — NG0205 escapes `appRef.destroy()`); the guard placed after
  the scheduled-flush check (the queued-before-teardown spec).

#### Forms behaviour

- External `value` model writes replace the internal file list; transient `ngModel` null initialization is normalized to an empty list. They also revoke the owned preview URLs the new list no longer references (see **Preview URL lifetime**).
- `registerOnChange(fn)` — called with the full `MlvUploadedFile[]` array on every add, remove or replace.
- Form-bound disabled state drives the base `disabled` input and `computedDisabled()`.
- Provides `MLV_FORM_CONTROL`, `useExisting` itself (2026-09, #217). It was the
  only `MlvSignalFormUiControlBase` subclass in the workspace that did not, so an
  enclosing `mlv-form-field` skipped it entirely: its
  `contentChild(MLV_FORM_CONTROL)` resolved whichever **other** control the field
  held, and a projected `<mlv-label>` then pointed its `for` at that unrelated
  control. `_externalLabelStrategy()` is the base `'none'`, so the zone now
  reports no label target and the field correctly emits nothing and warns. See
  `.claude/projects/libs-form-utils.md` § _The field resolves the outermost
  control_.

### Known gap: the zone takes no name from `label` / `ariaLabel`

`MlvFileUpload` inherits `label` and `ariaLabel` from
`MlvSignalFormUiControlBase` and **renders neither**: there is no `<mlv-label>`
in its template and no host `[attr.aria-label]`, and the native `<input>` is
`aria-hidden`. The zone's only AT entry point is the browse `<button>`, whose
accessible name is `actionLabel()`.

That makes `mlv-form-field`'s dev-mode "names nothing" warning give advice the
component cannot honour — it says _"Give the control its own [label] or
[ariaLabel]"_, and both are inert here. The warning is not new (a `'none'`
control always drew it) but since #217 it fires under this component's own name
instead of an unrelated sibling's, so the dead advice is now legible.

Not fixed here, deliberately: making the inputs work means choosing which
element takes the name, and both candidates change shipped rendering —
overriding the browse button's "Browse files" would be a regression, and naming
the zone means giving a plain `<div>` a role it does not have today.
`mlv-rating` has the same shape and is worse (its host `aria-label` is a
hardcoded i18n string that silently overrides `[ariaLabel]`), so this is a class
of at least two and belongs in its own issue. Until then, name a
`mlv-file-upload` from the consuming markup — `aria-labelledby` on a heading you
already render, or a `<label>` you own.

---

### `MlvFileUploadItem`

**File:** `libs/core/file-upload/src/lib/file-upload-item/file-upload-item.ts`
**Template:** `libs/core/file-upload/src/lib/file-upload-item/file-upload-item.html`
**Styles:** `libs/core/file-upload/src/lib/file-upload-item/file-upload-item.scss`

- **Selector:** `mlv-file-upload-item`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`

#### Inputs

| Name       | Type              | Default  | Description                                                                                                                                                                             |
| ---------- | ----------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file`     | `MlvUploadedFile` | required | The uploaded file descriptor to render                                                                                                                                                  |
| `disabled` | `BooleanInput`    | `false`  | Disables the remove button (native `disabled`: out of the tab order, not activatable) and stops `remove`. `mlv-file-upload` binds its `computedDisabled()`; row ink is its scope (#568) |

#### Outputs

| Name     | Type                     | Description                                                          |
| -------- | ------------------------ | -------------------------------------------------------------------- |
| `remove` | `OutputEmitterRef<void>` | Emits when the user clicks the remove button; never while `disabled` |

#### Internal Computed Signals

| Signal           | Description                                                    |
| ---------------- | -------------------------------------------------------------- |
| `_formattedSize` | Human-readable size string (`"1.2 MB"`, `"500 B"`, `"2.5 KB"`) |
| `_showProgress`  | `true` when `file().state === 'uploading'`                     |
| `_progress`      | Current progress value from `file().progress ?? 0`             |

#### Template Behaviour

- **Thumbnail:** Renders `<img>` when `file().previewUrl` is set; otherwise `<svg lucideFile>`.
- **Meta:** Shows `file().error.message` when `file.error` is set; otherwise `_formattedSize()`.
- **Progress bar:** `<mlv-loader variant="bar">` visible only when `state === 'uploading'`.
- **Status icons:** `lucideCircleCheck` for `success`, `lucideCircleX` for `error`.
- **Remove button:** Always visible. `aria-label="Remove {file.name}"`. Takes `[disabled]="disabled()"` through `MlvButtonClose.disabled`; its handler also returns early while disabled, so a click dispatched on the `mlv-button-close` host emits nothing.

#### Host Bindings

```ts
host: {
  'class': 'mlv-file-upload-item',
  '[class.mlv-file-upload-item--uploading]': 'file().state === "uploading"',
  '[class.mlv-file-upload-item--success]': 'file().state === "success"',
  '[class.mlv-file-upload-item--error]': 'file().state === "error"',
}
```

---

## Directives

### `MlvFileUploadAction`

**File:** `libs/core/file-upload/src/lib/file-upload-action.ts`
**Selector:** `[mlvFileUploadAction]`

Marks a projected control as an extra action in the drop zone's action row,
next to the built-in browse button — an icon-only "generate with AI" button, a
"pick from library" trigger, and so on.

#### Inputs

| Name       | Type                          | Default   | Description                                                                          |
| ---------- | ----------------------------- | --------- | ------------------------------------------------------------------------------------ |
| `position` | `MlvFileUploadActionPosition` | `'start'` | `'start'` renders before the browse button, `'end'` after it (adds `…__action--end`) |

#### Host Bindings

```ts
host: {
  class: 'mlv-file-upload__action',
  '[class.mlv-file-upload__action--end]': "position() === 'end'",
  '(click)': '$event.stopPropagation()',
}
```

#### Notes

- **`position` is matched as a static attribute.** The slot is chosen by the
  component's `<ng-content select>`, which reads template attributes — write
  `position="end"`, not `[position]="…"`, exactly like the other Malva UI slot
  markers. A binding still drives the modifier class but cannot move the node
  between slots.
- **Clicks stop at the slot.** The host `(click)` calls `stopPropagation()`, so
  a projected control — including Enter/Space activation of a `<button>` —
  never also triggers the surrounding zone and opens the native file picker.
  Same-element handlers are unaffected, so the consumer's own `(click)` still
  fires.
- **Disabled state is the consumer's job.** `mlv-file-upload` paints the zone
  with the disabled surface and sets `pointer-events: none` on the host while the
  control is disabled, but it never writes `disabled` onto projected content.
  It cannot declare a disabled surface for content it does not render, so a
  projected action keeps `opacity: var(--mlv-disabled-opacity)` (allow-listed in
  `scripts/check-disabled-surface.mjs`, the `mlv-expand` rationale). The dim is
  visual and the host's `pointer-events: none` stops only the pointer: bind
  `[disabled]` on the action so the keyboard is blocked too.
- Give icon-only actions an `aria-label`; the directive adds no accessible name.

---

## Types

### `MlvUploadedFile`

```ts
interface MlvUploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl?: string;
  state: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: MlvFileValidationError;
}
```

`previewUrl`: generated for picked / dropped images and revoked by the
component when the entry leaves the value; a supplied one is never revoked (see
**Preview URL lifetime**).

### `MlvFileValidationError`

```ts
interface MlvFileValidationError {
  code: 'size' | 'type' | 'count';
  message: string;
}
```

### `MlvFileUploadPreviewMode`

```ts
type MlvFileUploadPreviewMode = 'list' | 'cover';
```

`'list'` is the default. See **Cover preview** above for what `'cover'` needs
before it engages.

---

## Accessibility

- Drop zone click target is a `<button mlvButton>` — keyboard and screen-reader accessible.
- Hidden `<input type="file">` has `aria-hidden="true"` and `tabindex="-1"`.
- Validation errors rendered in `[role=alert][aria-live="assertive"]` list.
- File list rendered with `aria-label="Selected files"` and `aria-live="polite"`.
- Remove buttons have `aria-label="Remove {filename}"`.
- Status icons have `aria-label` and `role="img"`.
- Projected `[mlvFileUploadAction]` controls sit in DOM order around the browse
  button, so the tab sequence matches the visual sequence. Icon-only actions
  need their own `aria-label`.
- In cover state the toolbar stays in the DOM and tabbable while visually
  hidden, so **Replace** — the keyboard entry point once the browse button is
  gone — can be reached, and focusing it reveals the bar via `:focus-within`.
- The cover `<img>` takes its `alt` from the file's `name`.
- Replace is labelled from the `replaceFile` i18n key; Remove reuses
  `removeFile` with the covered file's `{name}`.

---

## Usage Examples

```html
<!-- Basic usage -->
<mlv-file-upload [(ngModel)]="files" />

<!-- Reactive forms with constraints -->
<mlv-file-upload [formControl]="uploadCtrl" accept="image/*,.pdf" [maxSize]="5242880" [multiple]="false" title="Upload your document" subtitle="PDF or image, max 5 MB" actionLabel="Choose file" />

<!-- Compact single-row drop zone -->
<mlv-file-upload [formControl]="ctrl" compact />

<!-- Extra action before the browse button (default position="start") -->
<mlv-file-upload title="Image" subtitle="Or drag and drop in this area" actionLabel="Choose image" accept="image/*" [multiple]="false">
  <button mlvButton mlvFileUploadAction type="button" shape="square" aria-label="Generate image with AI" (click)="generate()">
    <svg lucideSparkles [size]="16" />
  </button>
</mlv-file-upload>

<!-- Extra action after the browse button — static attribute, never [position] -->
<mlv-file-upload actionLabel="Choose files">
  <button mlvButton mlvFileUploadAction position="end" type="button" variant="transparent" (click)="openLibrary()">From library</button>
</mlv-file-upload>

<!-- Cover preview: the selected image fills the zone, and the projected
     actions move into the floating [AI][Replace][Remove] toolbar. -->
<mlv-file-upload previewMode="cover" accept="image/*" [multiple]="false" title="Image" subtitle="Or drag and drop in this area" actionLabel="Choose image" [(value)]="image">
  <button mlvButton mlvFileUploadAction type="button" shape="square" variant="transparent" aria-label="Generate image with AI" (click)="generate()">
    <svg lucideSparkles [size]="16" />
  </button>
</mlv-file-upload>
```

```ts
// Seeding an edit form from a stored image — `previewUrl` is what triggers
// cover state; the File is only a placeholder for a value that never went
// through the picker.
readonly image = signal<MlvUploadedFile[]>([
  {
    id: 'hero',
    file: new File([], 'campaign-hero.jpg', { type: 'image/jpeg' }),
    name: 'campaign-hero.jpg',
    size: 0,
    previewUrl: 'https://cdn.example.com/campaign-hero.jpg',
    state: 'success',
  },
]);
```

---

## Dependencies

### Angular / third-party

- `@angular/core`
- `@angular/forms`
- `@angular/cdk/coercion`
- `@lucide/angular`

### Internal

- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase<T>` signal-control base class
- `@malva-ui/core/button` — `MlvButton` for the browse button
- `@malva-ui/core/loader` — `MlvLoader` for upload progress bar

## Disabled surface (2026-09, #366)

- Host opacity removed. `--disabled`: zone `--mlv-background-disabled` + `cursor: not-allowed`, zone icon / title / subtitle `--mlv-text-disabled`. Error border and rejection list kept.
- File rows: `.mlv-file-upload--disabled .mlv-file-upload-item` remaps `--mlv-text-primary` / `--mlv-text-secondary` → `--mlv-text-disabled` (name, size meta, placeholder file icon; an error message, the status icons and the progress bar keep their tone, the row fill its neutral surface); each row's remove button is natively disabled through `MlvFileUploadItem.disabled` and `removeFile()` is a no-op (#568, which the host opacity used to mask — Tab + Enter removed a file).
- Three allow-listed `opacity: var(--mlv-disabled-opacity)` sites, each content the component has no token for: `__cover-image` and row `__thumbnail-img` (picture data), and projected `__action` content (consumer-owned, see _Disabled state is the consumer's job_).
- Specs: `file-upload-disabled-styles.spec.ts` (zone, row remap, the three opacity sites), `file-upload-disabled.spec.ts` (remove buttons disabled, not focusable or clickable, `removeFile()` no-op, re-enable, axe sweep), `file-upload-item.spec.ts` § _while disabled_.
- Guard: `styles:check-disabled-surface` (`scripts/check-disabled-surface.mjs`, a `styles:lint` dependency) fails any other disabled `opacity` and any `--state-success/warning/info` rule.
