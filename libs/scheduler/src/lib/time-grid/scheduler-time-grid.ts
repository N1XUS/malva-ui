import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';

/** Week / day time grid. Filled in by the time-grid task; this stub only reserves the selector. */
@Component({
  selector: 'mlv-scheduler-time-grid',
  template: '',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-scheduler-time-grid' },
})
export class MlvSchedulerTimeGrid {}
