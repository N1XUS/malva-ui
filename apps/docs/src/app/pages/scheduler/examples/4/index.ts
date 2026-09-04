import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvAvatar } from '@malva-ui/core/avatar';
import type { MlvSchedulerEvent } from '@malva-ui/scheduler';
import { MlvScheduler, MlvSchedulerEventDef } from '@malva-ui/scheduler';

interface Meeting {
  owner: string;
  room: string;
}

const at = (dayOffset: number, hours: number, minutes = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
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
      start: at(0, 9),
      end: at(0, 10, 30),
      color: '#7c3aed',
      data: { owner: 'Ada', room: 'Sky' },
    },
    {
      id: '2',
      title: 'Hiring sync',
      start: at(0, 11),
      end: at(0, 11, 45),
      tone: 'success',
      data: { owner: 'Lin', room: 'Oak' },
    },
    {
      id: '3',
      title: 'Incident review',
      start: at(1, 14),
      end: at(1, 15),
      tone: 'danger',
      data: { owner: 'Max', room: 'Ash' },
    },
    {
      id: '4',
      title: 'All hands',
      start: at(2, 0),
      end: at(3, 0),
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
