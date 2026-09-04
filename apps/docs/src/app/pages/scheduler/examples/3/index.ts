import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import type {
  MlvSchedulerCanChange,
  MlvSchedulerEvent,
  MlvSchedulerEventChange,
} from '@malva-ui/scheduler';
import { MlvScheduler } from '@malva-ui/scheduler';

const at = (dayOffset: number, hours: number, minutes = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

@Component({
  selector: 'docs-scheduler-drag-example',
  imports: [MlvCheckbox, MlvScheduler],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SchedulerDragExample {
  readonly editable = signal(true);
  readonly log = signal<string[]>([]);
  readonly events = signal<MlvSchedulerEvent[]>([
    { id: 'a', title: 'Movable', start: at(0, 9), end: at(0, 10) },
    {
      id: 'b',
      title: 'Pinned (draggable: false)',
      start: at(0, 11),
      end: at(0, 12),
      draggable: false,
      tone: 'warning',
    },
    {
      id: 'c',
      title: 'Fixed length (resizable: false)',
      start: at(1, 13),
      end: at(1, 14),
      resizable: false,
    },
    {
      id: 'd',
      title: 'Business hours only',
      start: at(2, 10),
      end: at(2, 11),
      tone: 'info',
    },
  ]);

  /** Vetoes a move that would leave 08:00–18:00 for the `d` event. */
  readonly canMove: MlvSchedulerCanChange = (event, next) =>
    event.id !== 'd' ||
    (next.start.getHours() >= 8 && next.end.getHours() <= 18 && !next.allDay);

  protected onChange(
    kind: 'moved' | 'resized',
    change: MlvSchedulerEventChange,
  ): void {
    const { event, previous, source } = change;
    this.log.update((lines) => [
      `${event.title} ${kind} by ${source}: ${previous.start.toLocaleString()} → ${event.start.toLocaleString()}`,
      ...lines.slice(0, 4),
    ]);
  }
}
