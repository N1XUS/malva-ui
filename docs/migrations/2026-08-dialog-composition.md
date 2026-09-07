# 2026-08 — Dialog composition on `@angular/cdk/dialog`

`@malva-ui/core/dialog` was rebuilt around one composition model: every dialog
is a `<mlv-dialog>` surface with `mlv-dialog-header` / `mlv-dialog-body` /
`mlv-dialog-footer` parts and `[mlvDialogClose]` buttons — whether opened
from a template, a component, a string, `confirm()`, or a route. Angular CDK
`Dialog` is the engine (overlay, container, focus trap/restore, ARIA,
`closeOnNavigation`); Malva adds animation, granular Escape/backdrop opt-outs,
`initialFocus: 'auto'`, size presets, the parts, `confirm()`, and routable
dialogs. **No path draws chrome for another** — the content owns its header,
so the double-header bug from `4dfac038` cannot recur.

There are no deprecated aliases. Design spec:
`docs/superpowers/specs/2026-08-16-dialog-composition-design.md`.

---

## 1. Declarative dialogs: `<ng-template [(mlvDialog)]>` replaces the `<mlv-dialog [(opened)]>` host

**Was**

```html
<mlv-dialog [(opened)]="open" size="s" closeButton [closeOnBackdropClick]="false">
  <h4 *mlvDialogHeaderDef mlvDialogHeader>Invite teammate</h4>
  <ng-template mlvDialogContent>
    <div mlvDialogBody>…</div>
    <div mlvDialogFooter>
      <mlv-toolbar
        ><mlv-toolbar-spacer />
        <button mlvButton variant="secondary" (click)="open.set(false)">Cancel</button>
        <button mlvButton (click)="open.set(false)">Invite</button>
      </mlv-toolbar>
    </div>
  </ng-template>
</mlv-dialog>
```

**Now**

```html
<ng-template [(mlvDialog)]="open" [mlvDialogOptions]="{ size: 's', closeOnBackdrop: false }" (mlvDialogClosed)="onClosed($event)">
  <mlv-dialog>
    <mlv-dialog-header title="Invite teammate" />
    <mlv-dialog-body>…</mlv-dialog-body>
    <mlv-dialog-footer>
      <button mlvButton variant="secondary" mlvDialogClose>Cancel</button>
      <button mlvButton mlvDialogClose="invited">Invite</button>
    </mlv-dialog-footer>
  </mlv-dialog>
</ng-template>
```

| Before                                                                                                                                                           | After                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<mlv-dialog [(opened)] size appearance closeButton hasBackdrop closeOnBackdropClick closeOnEscape initialFocus (afterOpened) (afterClosed)>` (`MlvDialog` host) | `<ng-template [(mlvDialog)] [mlvDialogOptions] (mlvDialogOpened) (mlvDialogClosed)>` (`MlvDialogTemplate`) wrapping `<mlv-dialog>` + parts. Options are the same `MlvDialogConfig` the service takes. |
| `<ng-template mlvDialogHeaderDef>` / `*mlvDialogHeaderDef` (`MlvDialogHeaderDef`)                                                                                | removed — `<mlv-dialog-header title="…" />` or `<mlv-dialog-header><h3>…</h3></mlv-dialog-header>` inside the content                                                                                 |
| `<ng-template mlvDialogContent>` (`MlvDialogContentDef`)                                                                                                         | removed — the `<ng-template [(mlvDialog)]>` _is_ the content                                                                                                                                          |
| `[mlvDialogHeader]` directive **on a heading**                                                                                                                   | `mlv-dialog-header` is a **container** component (`mlv-dialog-header, [mlvDialogHeader]`); project the heading inside it                                                                              |
| `[mlvDialogBody]` attribute-only, `DialogBodyDirective` alias                                                                                                    | `mlv-dialog-body, [mlvDialogBody]` (`MlvDialogBody`); alias removed                                                                                                                                   |
| `[mlvDialogFooter]` bare class, `.mlv-dialog__actions` helper, toolbar + spacer                                                                                  | `mlv-dialog-footer, [mlvDialogFooter]` — flex row, `gap`, `align="start\|end\|center\|between"` (default `end`); `.mlv-dialog__actions` removed                                                       |
| `(click)="open.set(false)"` on every button                                                                                                                      | `mlvDialogClose` / `mlvDialogClose="result"` (sets `type="button"` on buttons)                                                                                                                        |
| `class="…"` on the old host                                                                                                                                      | `class="…"` on `<mlv-dialog>` (surface); `panelClass` / `backdropClass` in the options for the pane/backdrop                                                                                          |
| `closeOnBackdropClick`                                                                                                                                           | `closeOnBackdrop` (config key; same name the service always used)                                                                                                                                     |

`MlvDialogTemplate` instantiates the template only while the dialog is open.
Setting the model back to `true` while the leave animation is still playing is
deferred, not dropped: the old instance emits `mlvDialogClosed` and is disposed,
then a fresh dialog opens. The one exception is re-opening from **inside** an
`(mlvDialogClosed)` handler — that runs before the model settles, so re-open
from a later tick instead.

## 2. Service-opened content must render `<mlv-dialog>`; the service draws no chrome

**Was:** `MlvDialogService.open(component | template, { title, showCloseButton })` wrapped the content in a header row + close button; content rendered only body/footer.

**Now:** the service renders nothing around template/component content. Wrap it:

```html
<mlv-dialog>
  <mlv-dialog-header />
  <!-- title falls back to config.title; X per config.closable -->
  <mlv-dialog-body>…</mlv-dialog-body>
  <mlv-dialog-footer><button mlvButton mlvDialogClose="saved">Save</button></mlv-dialog-footer>
</mlv-dialog>
```

| Before                                                                             | After                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MlvDialogConfig.showCloseButton`                                                  | `closable` (default `true`); also an input on `mlv-dialog-header` (input → config → `true`; forced off for `appearance: 'confirm'`)                                                                                                                       |
| `MlvDialogConfig.title` rendered by the service                                    | still exists: used by string content, as the `mlv-dialog-header` fallback title, and for the accessible name                                                                                                                                              |
| new                                                                                | `appearance`, `panelClass`, `backdropClass`, `hasBackdrop`, `closeOnNavigation`, `restoreFocus`, `role`, `ariaDescribedBy`, `id`                                                                                                                          |
| `MlvDialogRef extends MlvOverlayRef`                                               | wraps the CDK `DialogRef`; same `close`/`afterClosed`/`beforeClose`/`data`; new `config`, `id`, `animationState`, `updateSize`, `addPanelClass`, `removePanelClass`                                                                                       |
| `MlvDialogService.open` (string / template / component), `confirm()`               | unchanged signatures; new `closeAll()` and `openDialogs`                                                                                                                                                                                                  |
| `MlvDialogHeaderRow`, `MlvDialogServiceContent`, `MLV_DIALOG_SERVICE_*` (internal) | removed                                                                                                                                                                                                                                                   |
| `DIALOG_DATA` (Malva token)                                                        | now the CDK `DIALOG_DATA` token re-exported under the same name — `inject(DIALOG_DATA)` keeps working; the CDK `DialogRef` is injectable too                                                                                                              |
| `mlvGenerateRoutableDialogRoute` options                                           | unchanged (`Omit<MlvDialogConfig, 'data' \| 'injector'>`); the routed component must render `<mlv-dialog>`                                                                                                                                                |
| `.mlv-dialog-panel` global surface class                                           | removed (`libs/styles/src/lib/overlay.scss` keeps only `.mlv-dialog-backdrop`); the pane is `.cdk-overlay-pane.mlv-dialog-pane`, the surface `.mlv-dialog` always ships its own styles                                                                    |
| `role="dialog"` / `aria-labelledby` on `.mlv-dialog`                               | on the CDK container `mlv-dialog-container.mlv-dialog-container` (parent of the surface). Tests that queried `.mlv-dialog[role=dialog]` must query `.mlv-dialog-container`. The header's title id is `<dialogId>-title-<n>` (unique per header instance). |

**Accessible name** resolves as: `ariaLabelledBy` → `ariaLabel` → the `mlv-dialog-header` title (input, projected, or `config.title`) → string content text. A header that renders no title at all (used only to host the X) registers no label, so the dialog never ends up named by an empty element.

**A dialog with none of these is unnamed.** The old service always drew a titled header; now the content owns the chrome, so a `<mlv-dialog>` with no `mlv-dialog-header` title, no `config.title` and no `ariaLabel`/`ariaLabelledBy` has no accessible name — give it one.

**`aria-modal`** stays `false` on the container — CDK parity, and deliberate: with `aria-modal="true"` assistive tech treats everything outside the container as inert, including select/menu popups the CDK renders as siblings of the dialog. The CDK `aria-hidden`s the rest of the page instead.

## 3. Behaviour that did not change

Size presets (`s`/`m`/`l`/`fullscreen`, `DIALOG_SIZE_PRESETS`), `initialFocus`
(`'auto'` skips the close button and the body scroll viewport), Escape and
backdrop closing by default, the leave animation before disposal
(`afterClosed()` emits after it), `confirm()`'s contract, and `MlvDialogBody`'s
scroll viewport with inner padding.

One visual fix rides along: `size: 'fullscreen'` is now genuinely edge-to-edge
on desktop. The service adds `mlv-dialog-pane--fullscreen` to the pane for that
preset, and the surface drops its `md+` radius, border, and
`calc(100dvh - 2rem)` height cap under it.
