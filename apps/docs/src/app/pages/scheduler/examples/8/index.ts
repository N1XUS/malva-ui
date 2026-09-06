import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideCopy,
  LucidePencil,
  LucidePlus,
  LucideTrash2,
} from '@lucide/angular';
import { MlvDialogService } from '@malva-ui/core/dialog';
import { MlvListItem, MlvListItemPrefix } from '@malva-ui/core/list';
import { MlvMenuItem, MlvMenuSeparator } from '@malva-ui/core/menu';
import type {
  MlvSchedulerEvent,
  MlvSchedulerNextRange,
} from '@malva-ui/scheduler';
import {
  MlvScheduler,
  MlvSchedulerEventMenuDef,
  MlvSchedulerSlotMenuDef,
} from '@malva-ui/scheduler';

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
  selector: 'docs-scheduler-context-menu-example',
  imports: [
    MlvScheduler,
    MlvSchedulerSlotMenuDef,
    MlvSchedulerEventMenuDef,
    MlvListItem,
    MlvListItemPrefix,
    MlvMenuItem,
    MlvMenuSeparator,
    LucideCopy,
    LucidePencil,
    LucidePlus,
    LucideTrash2,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SchedulerContextMenuExample {
  private readonly _dialog = inject(MlvDialogService);

  /**
   * `takeUntilDestroyed()` outside a field initializer needs the ref passed
   * explicitly — a method body is not an injection context.
   */
  private readonly _destroyRef = inject(DestroyRef);

  readonly events = signal<MlvSchedulerEvent[]>([
    { id: 'a', title: 'Design review', start: at(1, 10), end: at(1, 11) },
    {
      id: 'b',
      title: 'Sprint planning',
      start: at(2, 14),
      end: at(2, 15, 30),
      tone: 'info',
    },
    {
      id: 'c',
      title: 'Offsite',
      start: day(3),
      end: day(5),
      allDay: true,
      tone: 'success',
    },
  ]);
  readonly log = signal<string[]>([]);
  private _n = 0;

  /** "New event" on a cell, a slot or a pending keyboard selection. */
  protected create(range: MlvSchedulerNextRange): void {
    this._n += 1;
    const event: MlvSchedulerEvent = {
      id: `n${this._n}`,
      title: `New event ${this._n}`,
      start: range.start,
      end: range.end,
      allDay: range.allDay,
    };
    this.events.update((list) => [...list, event]);
    this._log(`Created "${event.title}"`);
  }

  protected rename(event: MlvSchedulerEvent): void {
    const title = `${event.title} (edited)`;
    this.events.update((list) =>
      list.map((item) => (item.id === event.id ? { ...item, title } : item)),
    );
    this._log(`Renamed "${event.title}" to "${title}"`);
  }

  protected duplicate(event: MlvSchedulerEvent): void {
    this._n += 1;
    const copy: MlvSchedulerEvent = {
      ...event,
      id: `n${this._n}`,
      title: `${event.title} (copy)`,
    };
    this.events.update((list) => [...list, copy]);
    this._log(`Duplicated "${event.title}"`);
  }

  /** Destructive, so it goes through a confirmation dialog first. */
  protected remove(event: MlvSchedulerEvent): void {
    this._dialog
      .confirm({
        title: `Delete “${event.title}”?`,
        message: 'The event is removed from the calendar.',
        confirmLabel: 'Delete',
        destructive: true,
      })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.events.update((list) =>
          list.filter((item) => item.id !== event.id),
        );
        this._log(`Deleted "${event.title}"`);
      });
  }

  private _log(line: string): void {
    this.log.update((lines) => [line, ...lines].slice(0, 6));
  }
}
