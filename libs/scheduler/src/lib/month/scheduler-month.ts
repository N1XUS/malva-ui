import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';

/** Month grid. Filled in by the month-view task; this stub only reserves the selector. */
@Component({
  selector: 'mlv-scheduler-month',
  template: '',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-scheduler-month' },
})
export class MlvSchedulerMonth {}
