import {
  ChangeDetectionStrategy,
  Component,
  inject,
  InjectionToken,
  ViewEncapsulation,
} from '@angular/core';

import { MlvDialog } from './dialog/dialog';
import { MlvDialogBody } from './dialog-body';
import { DIALOG_CONFIG } from './dialog-config';
import { MlvDialogHeader } from './dialog-header';

/** @internal The string passed to `MlvDialogService.open()`. */
export const MLV_DIALOG_TEXT = new InjectionToken<string>('MLV_DIALOG_TEXT');

/**
 * @internal Renders string content: a surface with the standard header (title
 * from `config.title`, close button per `config.closable`) and a body holding
 * the escaped text. Composes the same public parts consumers use.
 */
@Component({
  selector: 'mlv-dialog-text-content',
  imports: [MlvDialog, MlvDialogHeader, MlvDialogBody],
  template: `
    <mlv-dialog>
      @if (_showHeader) {
        <mlv-dialog-header />
      }
      <mlv-dialog-body>
        <p class="mlv-dialog__text">{{ _text }}</p>
      </mlv-dialog-body>
    </mlv-dialog>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-dialog-text-content' },
})
export class MlvDialogTextContent {
  /** @protected Text rendered through interpolation (escaped, never HTML). */
  protected readonly _text = inject(MLV_DIALOG_TEXT);
  /** @private Per-open configuration. */
  private readonly _config = inject(DIALOG_CONFIG);
  /**
   * @protected A header is worth rendering when it has a title or a close
   * button. `appearance: 'confirm'` forces the close button off inside
   * `MlvDialogHeader`, so a titleless confirm surface would otherwise render an
   * empty header bar.
   */
  protected readonly _showHeader =
    !!this._config.title ||
    (this._config.closable !== false && this._config.appearance !== 'confirm');
}
