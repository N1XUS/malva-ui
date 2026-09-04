import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import type {
  MlvSchedulerCanChange,
  MlvSchedulerEvent,
  MlvSchedulerEventChange,
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
    { id: 'a', title: 'Movable', start: at(1, 9), end: at(1, 10) },
    {
      id: 'b',
      title: 'Pinned (draggable: false)',
      start: at(1, 11),
      end: at(1, 12),
      draggable: false,
      tone: 'warning',
    },
    {
      id: 'c',
      title: 'Fixed length (resizable: false)',
      start: at(2, 13),
      end: at(2, 14),
      resizable: false,
    },
    {
      id: 'd',
      title: 'Business hours only',
      start: at(3, 10),
      end: at(3, 11),
      tone: 'info',
    },
  ]);

  /** Vetoes a move that would leave 08:00–18:00 for the `d` event. */
  readonly canMove: MlvSchedulerCanChange = (event, next) => {
    if (event.id !== 'd') return true;
    if (next.allDay) return false;

    // Both edges are measured from the START day's midnight, so an end that
    // lands exactly on midnight reads as 1440, not as 0 — `getHours()` would
    // accept it, and so would any end on a later day.
    const midnight = new Date(next.start);
    midnight.setHours(0, 0, 0, 0);
    const startMinutes = (next.start.getTime() - midnight.getTime()) / 60000;
    const endMinutes = (next.end.getTime() - midnight.getTime()) / 60000;

    return startMinutes >= 8 * 60 && endMinutes <= 18 * 60;
  };

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
