import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';

/**
 * Scrollable body of a dialog. Wraps its content in `mlv-scrollbar` (padding
 * sits inside the scroll viewport so focus rings are never clipped).
 */
@Component({
  // Attribute form intentionally enhances the consumer's own body container.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'mlv-dialog-body, [mlvDialogBody]',
  imports: [MlvScrollbar],
  template: `
    <mlv-scrollbar class="mlv-dialog__body-scrollbar">
      <ng-content />
    </mlv-scrollbar>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-dialog__body' },
})
export class MlvDialogBody {}
