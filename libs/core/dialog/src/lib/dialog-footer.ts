import {
  ChangeDetectionStrategy,
  Component,
  input,
  ViewEncapsulation,
} from '@angular/core';

/** Horizontal alignment of a dialog footer's actions. */
export type MlvDialogFooterAlign = 'start' | 'end' | 'center' | 'between';

/**
 * Footer row of a dialog: a wrapping flex row of actions, end-aligned by
 * default. Replaces the toolbar + spacer boilerplate.
 */
@Component({
  // Attribute form intentionally enhances the consumer's own footer container.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'mlv-dialog-footer, [mlvDialogFooter]',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-dialog__footer',
    '[class]': '"mlv-dialog__footer--align-" + align()',
  },
})
export class MlvDialogFooter {
  /** Where the actions sit: `'start'`, `'end'` (default), `'center'`, or `'between'`. */
  readonly align = input<MlvDialogFooterAlign>('end');
}
