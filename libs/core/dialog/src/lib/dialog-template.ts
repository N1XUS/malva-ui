import {
  DestroyRef,
  Directive,
  effect,
  inject,
  input,
  model,
  output,
  TemplateRef,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type {
  MlvDialogConfig,
  MlvDialogTemplateContext,
} from './dialog-config';
import type { MlvDialogRef } from './dialog-ref';
import { MlvDialogService } from './dialog.service';

/**
 * Declarative sugar over `MlvDialogService.open(templateRef, options)`.
 *
 * ```html
 * <ng-template [(mlvDialog)]="editing" [mlvDialogOptions]="{ size: 's' }" let-dialog>
 *   <mlv-dialog>
 *     <mlv-dialog-header title="Edit user" />
 *     <mlv-dialog-body>…</mlv-dialog-body>
 *     <mlv-dialog-footer><button mlvButton mlvDialogClose="saved">Save</button></mlv-dialog-footer>
 *   </mlv-dialog>
 * </ng-template>
 * ```
 *
 * The template is instantiated only while open (lazy by default) and gets
 * the same context as `open(templateRef)`: the ref as `let-dialog`,
 * `let-data="data"`, `let-config="config"`. Setting the model to `true` opens,
 * `false` closes (leave animation included), and closing from inside —
 * `[mlvDialogClose]`, Escape, backdrop, `dialog.close()` — flips the model
 * back to `false` and emits `mlvDialogClosed` with the result.
 *
 * Setting the model back to `true` while the previous instance is still
 * leaving is honoured: the intent is remembered and a fresh dialog opens as
 * soon as that instance is disposed, after its `mlvDialogClosed` has fired.
 * Re-opening from **inside** an `(mlvDialogClosed)` handler is the one case
 * that does not work: the handler runs before the model settles, so the write
 * is overwritten. Re-open from a later tick, or while the dialog is leaving.
 *
 * If the host is destroyed while a dialog is open, that dialog is closed too — outputs are not emitted after the host is destroyed.
 */
@Directive({
  selector: 'ng-template[mlvDialog]',
  exportAs: 'mlvDialog',
})
export class MlvDialogTemplate<R = unknown, D = unknown> {
  /** Whether the dialog is open. Two-way bindable: `[(mlvDialog)]="open"`. */
  readonly mlvDialog = model<boolean>(false);

  /** Options passed to `MlvDialogService.open()`. Read when the dialog opens; later changes apply to the next open. */
  readonly mlvDialogOptions = input<MlvDialogConfig<D>>();

  /** Emits after the dialog has been opened. */
  readonly mlvDialogOpened = output<void>();

  /** Emits the close result once the dialog is disposed. */
  readonly mlvDialogClosed = output<R | undefined>();

  /** @private The wrapped template. */
  private readonly _template =
    inject<TemplateRef<MlvDialogTemplateContext<R, D>>>(TemplateRef);
  /** @private Opens the template. */
  private readonly _dialogs = inject(MlvDialogService);
  /** @private Ref of the currently open (or leaving) dialog. */
  private _ref: MlvDialogRef<R, D> | null = null;
  /** @private Tears the `afterClosed()` subscription down with the host. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @private Set when the model turned `true` while the previous instance was still leaving. */
  private _reopenPending = false;

  /** The ref of the open dialog (held until the leave animation completes), or `null`. */
  get ref(): MlvDialogRef<R, D> | null {
    return this._ref;
  }

  constructor() {
    effect(() => {
      const open = this.mlvDialog();
      untracked(() => {
        if (open) {
          if (this._ref) {
            // Still leaving (or open) — remember the intent instead of
            // dropping it, so the re-open happens once the old instance goes.
            this._reopenPending = this._ref.animationState() === 'leave';
            return;
          }
          this._open();
        } else {
          this._reopenPending = false;
          this._ref?.close();
        }
      });
    });
    this._destroyRef.onDestroy(() => {
      // The `afterClosed()` subscription is torn down with the host, so nothing
      // clears `_ref` afterwards — drop it here so `ref` never hands out a
      // disposed handle.
      this._ref?.close();
      this._ref = null;
    });
  }

  /** Sets the model to `true`. */
  open(): void {
    this.mlvDialog.set(true);
  }

  /** Sets the model to `false`. */
  close(): void {
    this.mlvDialog.set(false);
  }

  /** @private Opens through the service. Callers guarantee no dialog is live. */
  private _open(): void {
    const ref = this._dialogs.open<R, D>(
      this._template,
      this.mlvDialogOptions(),
    );
    this._ref = ref;
    // Subscribed before the output fires: a handler that synchronously disposes
    // the dialog must still clear `_ref` and flip the model back to `false`.
    // `takeUntilDestroyed` drops the callback with the host, so nothing is
    // emitted and the model is not touched after destruction.
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((result) => {
        if (this._ref !== ref) {
          return;
        }
        this._ref = null;
        this.mlvDialogClosed.emit(result);
        const reopen = this._reopenPending && this.mlvDialog();
        this._reopenPending = false;
        if (reopen) {
          this._open();
        } else {
          this.mlvDialog.set(false);
        }
      });
    this.mlvDialogOpened.emit();
  }

  /** Type guard so `let-dialog` / `let-data` are typed in the template. */
  static ngTemplateContextGuard<R, D>(
    _dir: MlvDialogTemplate<R, D>,
    _ctx: unknown,
  ): _ctx is MlvDialogTemplateContext<R, D> {
    return true;
  }
}
