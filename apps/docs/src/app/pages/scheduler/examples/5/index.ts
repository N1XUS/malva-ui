import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import type { MlvSelectOption } from '@malva-ui/core/select';
import { MlvSelect } from '@malva-ui/core/select';
import type {
  MlvSchedulerBusinessHours,
  MlvSchedulerEvent,
} from '@malva-ui/scheduler';
import { MlvScheduler } from '@malva-ui/scheduler';

const at = (dayOffset: number, hours: number, minutes = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
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
    { id: 'a', title: 'Focus block', start: at(0, 9), end: at(0, 11) },
    { id: 'b', title: 'Support rota', start: at(1, 13), end: at(1, 17) },
  ]);
}
