import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvTaskboard, MlvTaskboardItemDef } from '@malva-ui/taskboard';
import type {
  MlvTaskboardColumn,
  MlvTaskboardMoveResult,
} from '@malva-ui/taskboard';

/** The application's own card shape — the board never wraps or copies it. */
interface Ticket {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly owner: string;
  readonly status: string;
}

const TICKETS: readonly Ticket[] = [
  {
    id: 'MLV-101',
    title: 'Audit the focus ring',
    description: 'Every interactive surface, both themes.',
    tags: ['a11y', 'tokens'],
    owner: 'Ada Lovelace',
    status: 'todo',
  },
  {
    id: 'MLV-102',
    title: 'Ship the dark palette',
    description: 'Contrast pass over the elevation ramp.',
    tags: ['theme'],
    owner: 'Grace Hopper',
    status: 'todo',
  },
  {
    id: 'MLV-103',
    title: 'Split the overlay base',
    tags: ['cdk', 'refactor'],
    owner: 'Linus Pauling',
    status: 'doing',
  },
  {
    id: 'MLV-104',
    title: 'Translate the toast pack',
    description: 'Fourteen locales, ICU plurals included.',
    tags: ['i18n'],
    owner: 'Ada Lovelace',
    status: 'doing',
  },
  {
    id: 'MLV-105',
    title: 'Retire the legacy grid',
    tags: ['cleanup'],
    owner: 'Grace Hopper',
    status: 'done',
  },
];

@Component({
  selector: 'docs-taskboard-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAvatar, MlvTaskboard, MlvTaskboardItemDef],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class TaskboardBasicExampleComponent {
  /** Application-owned column collection, two-way bound so header drags land here. */
  readonly columns = signal<readonly MlvTaskboardColumn[]>([
    // `accent` colours the stripe along the column panel's top edge. Any CSS
    // `<color>` works; a token keeps it theme-aware.
    { id: 'todo', label: 'To do', accent: 'var(--mlv-background-info-1)' },
    {
      id: 'doing',
      label: 'In progress',
      accent: 'var(--mlv-background-warning-1)',
    },
    { id: 'done', label: 'Done', accent: 'var(--mlv-background-success-1)' },
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
