import type { AfterViewInit, ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import type {
  MlvSchedulerEvent,
  MlvSchedulerExternalDropEvent,
} from '@malva-ui/scheduler';
import { MlvScheduler, MlvSchedulerHeaderDef } from '@malva-ui/scheduler';
import Sortable from 'sortablejs';

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
  selector: 'docs-scheduler-header-example',
  imports: [
    LucideChevronLeft,
    LucideChevronRight,
    MlvButton,
    MlvScheduler,
    MlvSchedulerHeaderDef,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SchedulerHeaderExample implements AfterViewInit {
  readonly backlog = signal([
    'Write release notes',
    'Review PR #53',
    'Plan Q4',
  ]);
  readonly events = signal<MlvSchedulerEvent[]>([
    { id: 'kickoff', title: 'Kickoff', start: at(1, 10), end: at(1, 11) },
  ]);

  private readonly _list =
    viewChild.required<ElementRef<HTMLElement>>('backlogList');
  private readonly _destroyRef = inject(DestroyRef);

  ngAfterViewInit(): void {
    const sortable = Sortable.create(this._list().nativeElement, {
      // `pull: true`, never `'clone'`: the scheduler inserts no foreign DOM and
      // hands the dragged element back to this list, so a clone left behind by
      // SortableJS would be an untracked duplicate Angular cannot remove.
      group: { name: 'docs-planner', pull: true, put: false },
      sort: false,
      forceFallback: true,
      fallbackOnBody: true,
    });
    this._destroyRef.onDestroy(() => sortable.destroy());
  }

  protected onDrop(drop: MlvSchedulerExternalDropEvent): void {
    const title = drop.element.textContent?.trim() ?? 'Task';
    this.events.update((list) => [
      ...list,
      {
        id: `task-${Date.now()}`,
        title,
        start: drop.start,
        end: drop.end,
        allDay: drop.allDay,
        tone: 'info',
      },
    ]);
    this.backlog.update((items) => items.filter((item) => item !== title));
  }
}
