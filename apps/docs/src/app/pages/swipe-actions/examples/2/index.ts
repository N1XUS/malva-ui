import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  LucideCheck,
  LucideEllipsis,
  LucidePin,
  LucideTrash2,
} from '@lucide/angular';
import { MlvSwipeAction, MlvSwipeActions } from '@malva-ui/core/swipe-actions';

interface Task {
  id: number;
  title: string;
  due: string;
  done: boolean;
  pinned: boolean;
}

@Component({
  selector: 'docs-swipe-actions-both-sides-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvSwipeActions,
    MlvSwipeAction,
    LucideCheck,
    LucidePin,
    LucideEllipsis,
    LucideTrash2,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SwipeActionsBothSidesExampleComponent {
  readonly tasks = signal<Task[]>([
    {
      id: 1,
      title: 'Review the scrubber extraction',
      due: 'Today',
      done: false,
      pinned: true,
    },
    {
      id: 2,
      title: 'Write the migration note for core/date',
      due: 'Tomorrow',
      done: false,
      pinned: false,
    },
    {
      id: 3,
      title: 'Sweep motion literals onto tokens',
      due: 'Friday',
      done: true,
      pinned: false,
    },
  ]);

  readonly status = signal(
    'The first row peeks its end actions once to teach the gesture.',
  );

  complete(task: Task): void {
    this.update(task, { done: !task.done });
    this.status.set(
      `${task.title}: ${task.done ? 'reopened' : 'marked done'}.`,
    );
  }

  pin(task: Task): void {
    this.update(task, { pinned: !task.pinned });
    this.status.set(`${task.title}: ${task.pinned ? 'unpinned' : 'pinned'}.`);
  }

  more(task: Task): void {
    this.status.set(`More options for “${task.title}”.`);
  }

  remove(task: Task): void {
    this.tasks.update((all) => all.filter((t) => t !== task));
    this.status.set(`Deleted “${task.title}”.`);
  }

  private update(task: Task, patch: Partial<Task>): void {
    this.tasks.update((all) =>
      all.map((t) => (t === task ? { ...t, ...patch } : t)),
    );
  }
}
