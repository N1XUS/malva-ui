import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import type { MlvTone } from '@malva-ui/cdk/utils';
import { mlvNextId } from '@malva-ui/cdk/utils';
import type { MlvButtonVariant } from '@malva-ui/core/button';
import { MlvButton } from '@malva-ui/core/button';
import { MLV_DIALOG_I18N } from '@malva-ui/i18n';

import type { MlvConfirmDialogOptions } from './confirm-dialog-options';
import { MlvDialog } from './dialog/dialog';
import { MlvDialogBody } from './dialog-body';
import { DIALOG_CONFIG } from './dialog-config';
import { MlvDialogFooter } from './dialog-footer';
import { MlvDialogHeader } from './dialog-header';
import { MlvDialogRef } from './dialog-ref';

/** @internal Class on the confirm button — also the `initialFocus` selector. */
export const MLV_CONFIRM_DIALOG_CONFIRM_CLASS = 'mlv-confirm-dialog__confirm';

/** @internal Class on the cancel button — also the `initialFocus` selector. */
export const MLV_CONFIRM_DIALOG_CANCEL_CLASS = 'mlv-confirm-dialog__cancel';

/**
 * @internal Confirm-button variant per tone. `'danger'` never reaches the
 * lookup — `mlvIsDestructiveConfirm()` catches it first — but it is listed so
 * the record stays exhaustive over `MlvTone`.
 */
const CONFIRM_VARIANT_BY_TONE: Record<MlvTone, MlvButtonVariant> = {
  danger: 'error',
  warning: 'warning',
  info: 'info',
  success: 'primary',
};

/**
 * @internal Content of a `MlvDialogService.confirm()` dialog: the standard
 * surface with a titled header (no close button — the service opens it with
 * `appearance: 'confirm'`), the message, and the two actions. Options arrive
 * through `MlvDialogRef.data`, so this file never imports the service.
 */
@Component({
  selector: 'mlv-confirm-dialog',
  imports: [
    MlvButton,
    MlvDialog,
    MlvDialogHeader,
    MlvDialogBody,
    MlvDialogFooter,
  ],
  template: `
    <mlv-dialog>
      <mlv-dialog-header [title]="_options.title" />
      <mlv-dialog-body>
        <p class="mlv-dialog__text" [id]="_messageId">{{ _options.message }}</p>
      </mlv-dialog-body>
      <mlv-dialog-footer>
        <button
          type="button"
          mlvButton
          variant="secondary"
          class="mlv-confirm-dialog__cancel"
          (click)="_cancel()"
        >
          {{ _cancelLabel() }}
        </button>
        <button
          type="button"
          mlvButton
          [variant]="_confirmVariant"
          class="mlv-confirm-dialog__confirm"
          (click)="_confirm()"
        >
          {{ _confirmLabel() }}
        </button>
      </mlv-dialog-footer>
    </mlv-dialog>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-confirm-dialog' },
})
export class MlvConfirmDialog {
  /** @private Handle used to resolve the confirmation. */
  private readonly _ref =
    inject<MlvDialogRef<boolean, MlvConfirmDialogOptions>>(MlvDialogRef);
  /** @private i18n strings for the default labels. */
  private readonly _i18n = inject(MLV_DIALOG_I18N);
  /** @protected The options this confirmation was opened with. */
  protected readonly _options = this._ref.data;
  /**
   * @protected Id of the message paragraph. `confirm()` generates it and puts
   * it on `MlvDialogConfig.ariaDescribedBy`, so the container already points at
   * this element; reading it back here keeps `MlvConfirmDialogOptions` free of
   * an id the caller never supplies. The fallback only matters if the component
   * is ever opened without that config — the paragraph still gets a unique id.
   */
  protected readonly _messageId =
    inject(DIALOG_CONFIG).ariaDescribedBy ?? mlvNextId('mlv-confirm-message');
  /** @protected Resolved label of the confirming action; follows the active language. */
  protected readonly _confirmLabel = computed(
    () => this._options.confirmLabel ?? this._i18n().confirm,
  );
  /** @protected Resolved label of the dismissing action; follows the active language. */
  protected readonly _cancelLabel = computed(
    () => this._options.cancelLabel ?? this._i18n().cancel,
  );

  /**
   * @protected Button variant of the confirming action. `destructive` and the
   * `'danger'` tone both mean "cannot be undone", so either makes it dangerous;
   * every other tone maps through {@link CONFIRM_VARIANT_BY_TONE}, and no tone
   * at all stays `'primary'`.
   */
  protected readonly _confirmVariant: MlvButtonVariant =
    mlvIsDestructiveConfirm(this._options)
      ? 'error'
      : this._options.tone
        ? CONFIRM_VARIANT_BY_TONE[this._options.tone]
        : 'primary';

  /** @protected Resolves the confirmation as accepted. */
  protected _confirm(): void {
    this._ref.close(true);
  }

  /** @protected Resolves the confirmation as declined. */
  protected _cancel(): void {
    this._ref.close(false);
  }
}

/**
 * @internal Whether a confirmation describes an irreversible action. Shared by
 * the component (button variant) and the service (initial focus) so the two
 * cannot disagree about which action is the safe one.
 */
export function mlvIsDestructiveConfirm(
  options: MlvConfirmDialogOptions,
): boolean {
  return options.destructive === true || options.tone === 'danger';
}
