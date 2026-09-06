import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MlvSearchField } from '@malva-ui/core/search-field';
import { MlvTaskboard, MlvTaskboardItemDef } from '@malva-ui/taskboard';
import type { MlvTaskboardColumn } from '@malva-ui/taskboard';

interface Ticket {
  readonly id: string;
  readonly title: string;
  readonly status: string;
}

const COLUMN_IDS = ['backlog', 'ready', 'doing', 'done'] as const;

const TOPICS = [
  'Audit',
  'Migrate',
  'Document',
  'Benchmark',
  'Refactor',
  'Translate',
] as const;

const SUBJECTS = [
  'the drag adapter',
  'the focus ring',
  'the locale pack',
  'the virtual cell',
  'the drop policy',
  'the keyboard map',
] as const;

/** 500 deterministic cards spread evenly over four columns. */
function buildTickets(): readonly Ticket[] {
  const tickets: Ticket[] = [];
  for (let index = 0; index < 500; index += 1) {
    tickets.push({
      id: `MLV-${7000 + index}`,
      title: `${TOPICS[index % TOPICS.length]} ${SUBJECTS[index % SUBJECTS.length]}`,
      status: COLUMN_IDS[index % COLUMN_IDS.length],
    });
  }
  return tickets;
}

const TICKETS = buildTickets();

@Component({
  selector: 'docs-taskboard-virtual-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSearchField, MlvTaskboard, MlvTaskboardItemDef],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class TaskboardVirtualExampleComponent {
  readonly columns = signal<readonly MlvTaskboardColumn[]>([
    { id: 'backlog', label: 'Backlog' },
    { id: 'ready', label: 'Ready' },
    { id: 'doing', label: 'In progress' },
    { id: 'done', label: 'Done' },
  ]);

  /** Every card the board owns — 500 of them, 125 per column. */
  readonly tickets = signal<readonly Ticket[]>(TICKETS);

  /** Live filter text; empty means "show everything". */
  readonly query = signal('');

  /**
   * The filtered view handed to `visibleItems`. `items` stays canonical, so
   * WIP counts and move validation keep seeing all 500 cards.
   */
  readonly visibleTickets = computed<readonly Ticket[] | undefined>(() => {
    const query = this.query().trim().toLowerCase();
    if (query === '') return undefined;
    return this.tickets().filter(
      (ticket) =>
        ticket.title.toLowerCase().includes(query) ||
        ticket.id.toLowerCase().includes(query),
    );
  });

  /** How many cards the filter currently keeps. */
  readonly visibleCount = computed(
    () => (this.visibleTickets() ?? this.tickets()).length,
  );

  /** Type carrier for the card template; never read at runtime. */
  readonly ticketType = TICKETS[0];
}
