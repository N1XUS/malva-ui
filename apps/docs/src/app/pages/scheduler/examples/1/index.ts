import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import type { MlvSchedulerEvent, MlvSchedulerView } from '@malva-ui/scheduler';
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
  selector: 'docs-scheduler-views-example',
  imports: [MlvButton, MlvScheduler],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SchedulerViewsExample {
  readonly view = signal<MlvSchedulerView>('week');
  /** Tuesday of the visible week, so the day view opens on a populated day. */
  readonly date = signal(day(1));
  readonly events = signal<MlvSchedulerEvent[]>([
    {
      id: 'standup',
      title: 'Standup',
      start: at(1, 9, 30),
      end: at(1, 9, 45),
      tone: 'info',
    },
    {
      id: 'design',
      title: 'Design review',
      start: at(1, 11),
      end: at(1, 12, 30),
    },
    {
      id: 'lunch',
      title: 'Team lunch',
      start: at(2, 12),
      end: at(2, 13),
      tone: 'success',
    },
    {
      id: 'retro',
      title: 'Retro',
      start: at(3, 15),
      end: at(3, 16),
      tone: 'warning',
    },
  ]);

  protected addEvent(): void {
    const n = this.events().length + 1;
    this.events.update((list) => [
      ...list,
      { id: `new-${n}`, title: `Event ${n}`, start: at(1, 14), end: at(1, 15) },
    ]);
  }
}
