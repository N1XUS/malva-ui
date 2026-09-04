import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import type { MlvSchedulerEvent, MlvSchedulerView } from '@malva-ui/scheduler';
import { MlvScheduler } from '@malva-ui/scheduler';

const at = (dayOffset: number, hours: number, minutes = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

@Component({
  selector: 'docs-scheduler-views-example',
  imports: [MlvButton, MlvScheduler],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SchedulerViewsExample {
  readonly view = signal<MlvSchedulerView>('week');
  readonly date = signal(new Date());
  readonly events = signal<MlvSchedulerEvent[]>([
    {
      id: 'standup',
      title: 'Standup',
      start: at(0, 9, 30),
      end: at(0, 9, 45),
      tone: 'info',
    },
    {
      id: 'design',
      title: 'Design review',
      start: at(0, 11),
      end: at(0, 12, 30),
    },
    {
      id: 'lunch',
      title: 'Team lunch',
      start: at(1, 12),
      end: at(1, 13),
      tone: 'success',
    },
    {
      id: 'retro',
      title: 'Retro',
      start: at(2, 15),
      end: at(2, 16),
      tone: 'warning',
    },
  ]);

  protected addEvent(): void {
    const n = this.events().length + 1;
    this.events.update((list) => [
      ...list,
      { id: `new-${n}`, title: `Event ${n}`, start: at(0, 14), end: at(0, 15) },
    ]);
  }
}
