import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';

/**
 * Persistent help text rendered below a form control, in front of the
 * validation message. Projected into `mlv-form-control-wrapper` through its
 * `mlv-description` slot and referenced by the control's `aria-describedby`,
 * so it stays readable while a validation message is shown.
 *
 * @example
 * <mlv-description [id]="descriptionId">
 *   We only use this address for receipts.
 * </mlv-description>
 */
@Component({
  selector: 'mlv-description',
  template: `<ng-content />`,
  styleUrl: './description.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-description',
  },
})
export class MlvDescription {}
