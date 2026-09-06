import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvAvatar } from '@malva-ui/core/avatar';
import type { MlvSchedulerEvent } from '@malva-ui/scheduler';
import { MlvScheduler, MlvSchedulerEventDef } from '@malva-ui/scheduler';

interface Meeting {
  owner: string;
  room: string;
}

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
  selector: 'docs-scheduler-template-example',
  imports: [MlvAvatar, MlvScheduler, MlvSchedulerEventDef],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SchedulerTemplateExample {
  readonly events = signal<MlvSchedulerEvent<Date, Meeting>[]>([
    {
      id: '1',
      title: 'Roadmap',
      start: at(1, 9),
      end: at(1, 10, 30),
      color: '#7c3aed',
      data: { owner: 'Ada', room: 'Sky' },
    },
    {
      id: '2',
      title: 'Hiring sync',
      start: at(1, 11),
      end: at(1, 11, 45),
      tone: 'success',
      data: { owner: 'Lin', room: 'Oak' },
    },
    {
      id: '3',
      title: 'Incident review',
      start: at(2, 14),
      end: at(2, 15),
      tone: 'danger',
      data: { owner: 'Max', room: 'Ash' },
    },
    {
      id: '4',
      title: 'All hands',
      start: day(3),
      end: day(4),
      allDay: true,
      color: '#0ea5e9',
      data: { owner: 'Ops', room: 'Main' },
    },
  ]);

  /**
   * The chip template's context is typed `MlvSchedulerEvent<Date, unknown>` —
   * the def directive has no inputs, so `TData` cannot be inferred in the
   * template. Narrow the payload here instead of casting in the markup.
   */
  protected meeting(event: MlvSchedulerEvent<Date, unknown>): Meeting | null {
    return (event.data as Meeting | undefined) ?? null;
  }
}
