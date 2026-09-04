import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import type { MlvSelectOption } from '@malva-ui/core/select';
import { MlvSelect } from '@malva-ui/core/select';
import type {
  MlvSchedulerBusinessHours,
  MlvSchedulerEvent,
} from '@malva-ui/scheduler';
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

/** `day(index)` at `hours`:`minutes`. */
const at = (index: number, hours: number, minutes = 0): Date => {
  const d = day(index);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

@Component({
  selector: 'docs-scheduler-hours-example',
  imports: [MlvCheckbox, MlvSelect, MlvScheduler],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SchedulerHoursExample {
  readonly hideWeekend = signal(true);
  readonly slotDuration = signal(15);
  readonly slotOptions = [15, 30, 60];
  readonly slotToOption = (minutes: number): MlvSelectOption<number> => ({
    label: `${minutes} minutes`,
    value: minutes,
  });
  readonly businessHours: MlvSchedulerBusinessHours = {
    start: '09:00',
    end: '17:30',
    days: [1, 2, 3, 4, 5],
  };
  readonly events = signal<MlvSchedulerEvent[]>([
    { id: 'a', title: 'Focus block', start: at(1, 9), end: at(1, 11) },
    { id: 'b', title: 'Support rota', start: at(2, 13), end: at(2, 17) },
  ]);
}
