import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { MlvSchedulerEvent } from '@malva-ui/scheduler';
import { MlvScheduler } from '@malva-ui/scheduler';

const day = (offset: number): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};
const at = (offset: number, h: number, m = 0): Date => {
  const d = day(offset);
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
      start: day(-1),
      end: day(2),
      allDay: true,
      tone: 'info',
    },
    {
      id: 'holiday',
      title: 'Public holiday',
      start: day(3),
      end: day(4),
      allDay: true,
      tone: 'success',
    },
    {
      id: 'launch',
      title: 'Launch window',
      start: at(1, 22),
      end: at(2, 2),
      tone: 'danger',
    },
    {
      id: 'offsite',
      title: 'Offsite (36 h)',
      start: at(4, 10),
      end: at(5, 22),
    },
  ]);
}
