import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvTaskboard, MlvTaskboardItemDef } from '@malva-ui/taskboard';
import type {
  MlvTaskboardCardEvent,
  MlvTaskboardColumn,
  MlvTaskboardKey,
} from '@malva-ui/taskboard';

interface Ticket {
  readonly id: string;
  readonly title: string;
  readonly status: string;
}

const TICKETS: readonly Ticket[] = [
  { id: 'MLV-401', title: 'Split the sortable adapter', status: 'todo' },
  { id: 'MLV-402', title: 'Name the denial reasons', status: 'todo' },
  { id: 'MLV-403', title: 'Cover the SSR path', status: 'todo' },
  { id: 'MLV-404', title: 'Trim the announcement layer', status: 'doing' },
  { id: 'MLV-405', title: 'Publish the locale packs', status: 'doing' },
  { id: 'MLV-406', title: 'Freeze the DOM contract', status: 'done' },
];

@Component({
  selector: 'docs-taskboard-selection-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton, MlvTaskboard, MlvTaskboardItemDef],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class TaskboardSelectionExampleComponent {
  readonly columns = signal<readonly MlvTaskboardColumn[]>([
    { id: 'todo', label: 'To do' },
    { id: 'doing', label: 'In progress' },
    { id: 'done', label: 'Done' },
  ]);

  readonly tickets = signal<readonly Ticket[]>(TICKETS);

  readonly ticketType = TICKETS[0];

  /** The board's selection model is a `ReadonlySet` of card keys. */
  readonly selected = signal<ReadonlySet<MlvTaskboardKey>>(
    new Set<MlvTaskboardKey>(),
  );

  /** Selected keys in a stable order, for the toolbar readout. */
  readonly selectedIds = computed(() =>
    this.tickets()
      .filter((ticket) => this.selected().has(ticket.id))
      .map((ticket) => ticket.id),
  );

  /** Last card the board reported as activated (click or Enter). */
  readonly lastActivated = signal('No card activated yet.');

  /** Stores the replacement selection the board hands over. */
  onSelectionChange(next: ReadonlySet<MlvTaskboardKey>): void {
    this.selected.set(next);
  }

  /** Names the activated card and the gesture that activated it. */
  onCardActivated(event: MlvTaskboardCardEvent<Ticket>): void {
    const gesture =
      event.nativeEvent instanceof KeyboardEvent ? 'Enter' : 'click';
    this.lastActivated.set(`${event.item.id} activated by ${gesture}.`);
  }

  /** Bulk action: rewrites every selected card into the given column. */
  moveSelectedTo(status: string): void {
    const keys = this.selected();
    if (keys.size === 0) return;
    this.tickets.update((current) =>
      current.map((ticket) =>
        keys.has(ticket.id) ? { ...ticket, status } : ticket,
      ),
    );
  }

  /** Empties the selection through the same model the board writes. */
  clearSelection(): void {
    this.selected.set(new Set<MlvTaskboardKey>());
  }
}
