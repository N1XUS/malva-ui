import type { AfterViewInit, ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import type {
  MlvSchedulerEvent,
  MlvSchedulerExternalDropEvent,
} from '@malva-ui/scheduler';
import { MlvScheduler, MlvSchedulerHeaderDef } from '@malva-ui/scheduler';
import Sortable from 'sortablejs';

const at = (dayOffset: number, hours: number, minutes = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

@Component({
  selector: 'docs-scheduler-header-example',
  imports: [MlvButton, MlvScheduler, MlvSchedulerHeaderDef],
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
    { id: 'kickoff', title: 'Kickoff', start: at(0, 10), end: at(0, 11) },
  ]);

  private readonly _list =
    viewChild.required<ElementRef<HTMLElement>>('backlogList');
  private readonly _destroyRef = inject(DestroyRef);

  ngAfterViewInit(): void {
    const sortable = Sortable.create(this._list().nativeElement, {
      group: { name: 'docs-planner', pull: 'clone', put: false },
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
