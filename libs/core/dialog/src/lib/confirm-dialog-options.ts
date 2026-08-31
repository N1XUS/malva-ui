import type { Injector } from '@angular/core';
import type { MlvTone } from '@malva-ui/cdk/utils';

import type { MlvDialogSize } from './dialog-config';

/**
 * Options accepted by `MlvDialogService.confirm()`.
 *
 * Everything but `title` and `message` is optional; labels fall back to the
 * dialog i18n pack so a confirmation is one call with no wiring.
 *
 * Kept in its own file so the public barrel can re-export the shape without
 * also exporting the internal confirmation component that consumes it.
 */
export interface MlvConfirmDialogOptions {
  /** Heading rendered in the dialog's header row and used as its accessible name. */
  title: string;
  /** Body text. Rendered as escaped text, never as HTML. */
  message: string;
  /** Label of the confirming action. Defaults to the localized "Confirm". */
  confirmLabel?: string;
  /** Label of the dismissing action. Defaults to the localized "Cancel". */
  cancelLabel?: string;
  /**
   * Semantic tone of the confirmation. Drives the confirm button's variant;
   * `'danger'` also implies {@link MlvConfirmDialogOptions.destructive}.
   */
  tone?: MlvTone;
  /**
   * Marks the action as irreversible: the confirm button turns danger-coloured
   * and initial focus goes to **Cancel**, so a stray Enter dismisses rather
   * than destroys.
   */
  destructive?: boolean;
  /** Size preset name or explicit size config. Defaults to `'s'`. */
  size?: MlvDialogSize;
  /** Whether a backdrop click resolves the confirmation as `false`. Defaults to `true`. */
  closeOnBackdrop?: boolean;
  /** Whether Escape resolves the confirmation as `false`. Defaults to `true`. */
  closeOnEscape?: boolean;
  /** Parent injector for the confirmation dialog. Defaults to the root injector. */
  injector?: Injector;
}
