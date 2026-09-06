import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvTaskboard, MlvTaskboardItemDef } from '@malva-ui/taskboard';
import type {
  MlvTaskboardColumn,
  MlvTaskboardMoveResult,
} from '@malva-ui/taskboard';

/** The application's own card shape — the board never wraps or copies it. */
interface Ticket {
  readonly id: string;
  readonly title: string;
  readonly owner: string;
  readonly status: string;
}

const TICKETS: readonly Ticket[] = [
  {
    id: 'MLV-101',
    title: 'Audit the focus ring',
    owner: 'Ada',
    status: 'todo',
  },
  {
    id: 'MLV-102',
    title: 'Ship the dark palette',
    owner: 'Grace',
    status: 'todo',
  },
  {
    id: 'MLV-103',
    title: 'Split the overlay base',
    owner: 'Linus',
    status: 'doing',
  },
  {
    id: 'MLV-104',
    title: 'Translate the toast pack',
    owner: 'Ada',
    status: 'doing',
  },
  {
    id: 'MLV-105',
    title: 'Retire the legacy grid',
    owner: 'Grace',
    status: 'done',
  },
];

@Component({
  selector: 'docs-taskboard-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTaskboard, MlvTaskboardItemDef],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class TaskboardBasicExampleComponent {
  /** Application-owned column collection, two-way bound so header drags land here. */
  readonly columns = signal<readonly MlvTaskboardColumn[]>([
    { id: 'todo', label: 'To do' },
    { id: 'doing', label: 'In progress' },
    { id: 'done', label: 'Done' },
  ]);

  /** Application-owned cards. Every committed drop replaces this array. */
  readonly tickets = signal<readonly Ticket[]>(TICKETS);

  /**
   * Carries `Ticket` into the card template's context so `card.title` is typed.
   * The board never reads this value at runtime.
   */
  readonly ticketType = TICKETS[0];

  /** Last committed move, rendered under the board. */
  readonly lastMove = signal('Nothing moved yet.');

  /** Records the committed move the board reports after it rewrites `items`. */
  onMoved(result: MlvTaskboardMoveResult<Ticket>): void {
    this.lastMove.set(
      `${result.item.id} → ${result.target.columnId} at position ${result.target.index + 1}`,
    );
  }
}
