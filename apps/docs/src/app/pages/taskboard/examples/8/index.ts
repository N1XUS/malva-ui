import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvButton } from '@malva-ui/core/button';
import { MlvDialogService } from '@malva-ui/core/dialog';
import { MlvTaskboard, MlvTaskboardItemDef } from '@malva-ui/taskboard';
import type {
  MlvTaskboardBeforeMove,
  MlvTaskboardColumn,
  MlvTaskboardCsvField,
  MlvTaskboardSnapshot,
} from '@malva-ui/taskboard';
import { firstValueFrom } from 'rxjs';

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
    id: 'MLV-801',
    title: 'Draft the release note',
    description: 'One paragraph per breaking change.',
    tags: ['docs'],
    owner: 'Ada Lovelace',
    status: 'todo',
  },
  {
    id: 'MLV-802',
    title: 'Bump the peer range',
    tags: ['release'],
    owner: 'Grace Hopper',
    status: 'todo',
  },
  {
    id: 'MLV-803',
    title: 'Re-run the a11y sweep',
    description: 'Axe over every example, both themes.',
    tags: ['a11y'],
    owner: 'Linus Pauling',
    status: 'doing',
  },
  {
    id: 'MLV-804',
    title: 'Tag the package',
    tags: ['release'],
    owner: 'Ada Lovelace',
    status: 'doing',
  },
  {
    id: 'MLV-805',
    title: 'Publish the docs page',
    tags: ['docs'],
    owner: 'Grace Hopper',
    status: 'done',
  },
];

/** The card properties `exportCsv` emits, in column order. */
const CSV_FIELDS: readonly MlvTaskboardCsvField<Ticket>[] = [
  { field: 'id', heading: 'Ticket' },
  { field: 'title', heading: 'Summary' },
  { field: 'owner', heading: 'Owner' },
];

@Component({
  selector: 'docs-taskboard-history-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAvatar, MlvButton, MlvTaskboard, MlvTaskboardItemDef],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class TaskboardHistoryExampleComponent {
  /** @private Opens the confirmation the `beforeMove` guard awaits. */
  private readonly _dialogs = inject(MlvDialogService);

  /** The board instance the toolbar calls the imperative methods on. */
  readonly board = viewChild.required<MlvTaskboard<Ticket>>('board');

  readonly columns = signal<readonly MlvTaskboardColumn[]>([
    { id: 'todo', label: 'To do', accent: 'var(--mlv-background-info-1)' },
    {
      id: 'doing',
      label: 'In progress',
      accent: 'var(--mlv-background-warning-1)',
    },
    { id: 'done', label: 'Done', accent: 'var(--mlv-background-success-1)' },
  ]);

  readonly tickets = signal<readonly Ticket[]>(TICKETS);

  /** Type carrier for the card template; never read at runtime. */
  readonly ticketType = TICKETS[0];

  /**
   * The stored snapshot, or `null` while nothing has been captured. It carries
   * the cards as well as the UI state, so a restore puts both back.
   */
  readonly storedSnapshot = signal<MlvTaskboardSnapshot<Ticket> | null>(null);

  /** Text of the last export, rendered under the toolbar. */
  readonly output = signal('');

  /** Status line describing the result of the last toolbar action. */
  readonly status = signal('Drag a card into Done to see the guard.');

  /**
   * Reverses the column order without touching the cards, so a restore has a
   * column order to put back as well as a card placement.
   */
  reverseColumns(): void {
    this.columns.update((columns) => [...columns].reverse());
    this.status.set('Reversed the column order.');
  }

  /**
   * Asks for confirmation before anything lands in Done, and lets every other
   * move through. Returning `false` leaves `items` referentially unchanged and
   * the board emits `moveCancelled` with `before-move-rejected`.
   */
  readonly confirmMove: MlvTaskboardBeforeMove<Ticket> = async (request) => {
    if (String(request.target.columnId) !== 'done') return true;
    return firstValueFrom(
      this._dialogs.confirm({
        title: 'Close this ticket?',
        message: `Moving ${request.itemId} into Done marks it shipped.`,
        confirmLabel: 'Move to Done',
      }),
    );
  };

  /** Reverts the newest board-originated move. */
  undo(): void {
    this.status.set(
      this.board().undo() ? 'Undid the last move.' : 'Nothing left to undo.',
    );
  }

  /** Replays the move `undo()` reverted. */
  redo(): void {
    this.status.set(
      this.board().redo() ? 'Redid the last move.' : 'Nothing left to redo.',
    );
  }

  /** Captures the cards plus column order, collapse, selection, focus and scroll. */
  captureSnapshot(): void {
    this.storedSnapshot.set(this.board().snapshot());
    this.status.set(
      'Snapshot captured — move a card and reverse the columns, then restore.',
    );
  }

  /**
   * Puts the stored cards and UI state back as one undoable command; unknown
   * identifiers are dropped silently.
   */
  restoreSnapshot(): void {
    const snapshot = this.storedSnapshot();
    if (snapshot === null) return;
    this.board().restore(snapshot);
    this.status.set(
      'Snapshot restored — cards and column order are both back.',
    );
  }

  /** Serializes the whole board — cards, structure and snapshot — as data. */
  exportJson(): void {
    this.output.set(JSON.stringify(this.board().exportJson(), null, 2));
    this.status.set('Exported the board as JSON.');
  }

  /** Exports one column's cards as CSV, one row per card in board order. */
  exportCsv(): void {
    this.output.set(this.board().exportCsv('doing', CSV_FIELDS));
    this.status.set('Exported the In progress column as CSV.');
  }

  /** Expands every virtual cell, then asks the browser to print. */
  print(): void {
    this.board().print();
  }
}
