import { hasModifierKey } from '@angular/cdk/keycodes';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCombobox } from '@malva-ui/core/combobox';
import {
  MlvDialog,
  MlvDialogBody,
  MlvDialogFooter,
  MlvDialogHeader,
  MlvDialogRef,
  MlvDialogService,
} from '@malva-ui/core/dialog';
import { MlvForm } from '@malva-ui/core/form';
import { MlvInput } from '@malva-ui/core/input';
import { MlvSelect } from '@malva-ui/core/select';
import { filter, takeUntil } from 'rxjs';

@Component({
  selector: 'docs-profile-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvButton,
    MlvCombobox,
    MlvDialog,
    MlvDialogBody,
    MlvDialogFooter,
    MlvDialogHeader,
    MlvForm,
    MlvInput,
    MlvSelect,
  ],
  template: `
    <mlv-dialog>
      <!-- No X: every exit goes through attemptClose(). -->
      <mlv-dialog-header title="Edit profile" [closable]="false" />
      <mlv-dialog-body>
        <form mlvForm>
          <mlv-input label="Display name" (valueChange)="dirty.set(true)" />
          <mlv-select
            label="Role"
            [options]="roles"
            (valueChange)="dirty.set(true)"
          />
          <mlv-combobox
            label="Team"
            [options]="teams"
            (valueChange)="dirty.set(true)"
          />
        </form>
      </mlv-dialog-body>
      <mlv-dialog-footer>
        <button mlvButton variant="secondary" (click)="attemptClose()">
          Cancel
        </button>
        <button mlvButton (click)="ref.close('saved')">Save</button>
      </mlv-dialog-footer>
    </mlv-dialog>
  `,
})
export class ProfileFormDialogComponent {
  /** The handle of this dialog — the footer closes through it. */
  readonly ref = inject<MlvDialogRef<string>>(MlvDialogRef);

  /** Whether the user has edited any field, i.e. whether an exit needs a guard. */
  readonly dirty = signal(false);

  /** Options of the Role select. */
  readonly roles = ['Owner', 'Editor', 'Viewer'];

  /** Options of the Team combobox. */
  readonly teams = ['Design', 'Engineering', 'Marketing', 'Support'];

  /** @private Opens the discard confirmation on top of this dialog. */
  private readonly _dialogService = inject(MlvDialogService);

  /** @private `takeUntilDestroyed()` inside `attemptClose()` is outside an injection context. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Whether a discard confirmation is already open, so a second exit attempt is ignored. */
  private _confirming = false;

  constructor() {
    // The dialog was opened with `closeOnEscape: false` / `closeOnBackdrop:
    // false`, so both events arrive here instead of closing on their own. They
    // only emit while this dialog is the topmost layer that handles them.
    // `beforeClose()` emits synchronously at the start of `close()`, which
    // disarms the guard for the leave animation — the component outlives the
    // close by one `animationend`, and an Escape in that window would otherwise
    // re-enter `attemptClose()` and open an orphan confirmation.
    this.ref
      .keydownEvents()
      .pipe(
        filter((event) => event.key === 'Escape' && !hasModifierKey(event)),
        takeUntil(this.ref.beforeClose()),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        event.preventDefault();
        this.attemptClose();
      });

    this.ref
      .backdropClick()
      .pipe(takeUntil(this.ref.beforeClose()), takeUntilDestroyed())
      .subscribe(() => this.attemptClose());
  }

  /**
   * Closes straight away while the form is untouched; otherwise asks for
   * confirmation in a second dialog stacked on top of this one. A second call
   * while that confirmation is open is ignored (double Cancel clicks).
   */
  attemptClose(): void {
    if (this._confirming) {
      return;
    }

    if (!this.dirty()) {
      this.ref.close('cancelled');
      return;
    }

    this._confirming = true;
    this._dialogService
      .confirm({
        title: 'Discard changes?',
        message: 'Your edits to the profile will be lost.',
        confirmLabel: 'Discard',
        destructive: true,
      })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((discard) => {
        this._confirming = false;
        if (discard) {
          this.ref.close('discarded');
        }
      });
  }
}

@Component({
  selector: 'docs-dialog-stacked-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class DialogStackedExampleComponent {
  /** @private Opens the profile form dialog; the form's own guard runs inside it. */
  private readonly _dialogService = inject(MlvDialogService);

  /** @private `takeUntilDestroyed()` needs the ref passed explicitly inside a method. */
  private readonly _destroyRef = inject(DestroyRef);

  /** Result of the most recent form dialog, or the idle placeholder. */
  readonly lastResult = signal<string>('Nothing opened yet.');

  /** Opens the guarded profile form and records how it was closed. */
  editProfile(): void {
    this._dialogService
      .open<string>(ProfileFormDialogComponent, {
        size: 's',
        closeOnEscape: false,
        closeOnBackdrop: false,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((result) => this.lastResult.set(result ?? 'closed'));
  }
}
