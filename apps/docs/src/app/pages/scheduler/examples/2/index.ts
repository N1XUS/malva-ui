import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { MlvSchedulerEvent } from '@malva-ui/scheduler';
import { MlvScheduler } from '@malva-ui/scheduler';

/**
 * Midnight on weekday `index` of the current week, `0` = Monday (the default
 * `firstDayOfWeek`). Seeds are anchored to the visible week rather than to
 * "today + n", so every event stays inside the week view on any day it is read.
 */
const day = (index: number): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + index);
  return d;
};

/** `day(index)` at `h`:`m`. */
const at = (index: number, h: number, m = 0): Date => {
  const d = day(index);
  d.setHours(h, m);
  return d;
};

@Component({
  selector: 'docs-scheduler-all-day-example',
  imports: [MlvScheduler],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class SchedulerAllDayExample {
  readonly events = signal<MlvSchedulerEvent[]>([
    {
      id: 'conf',
      title: 'Conference',
      start: day(0),
      end: day(3),
      allDay: true,
      tone: 'info',
    },
    {
      id: 'holiday',
      title: 'Public holiday',
      start: day(4),
      end: day(5),
      allDay: true,
      tone: 'success',
    },
    {
      id: 'launch',
      title: 'Launch window',
      start: at(2, 22),
      end: at(3, 2),
      tone: 'danger',
    },
    {
      id: 'offsite',
      title: 'Offsite (36 h)',
      start: at(3, 10),
      end: at(4, 22),
    },
  ]);
}
