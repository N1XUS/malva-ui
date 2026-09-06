import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideLock } from '@lucide/angular';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvTaskboard, MlvTaskboardItemDef } from '@malva-ui/taskboard';
import type {
  MlvTaskboardCanDropFn,
  MlvTaskboardColumn,
  MlvTaskboardKey,
  MlvTaskboardMoveCancelledEvent,
  MlvTaskboardTransition,
} from '@malva-ui/taskboard';

interface Ticket {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly owner: string;
  readonly status: string;
  readonly needsReview: boolean;
}

const TICKETS: readonly Ticket[] = [
  {
    id: 'MLV-301',
    title: 'Draft the RFC',
    description: 'Scope the controlled-state contract before any code.',
    tags: ['rfc'],
    owner: 'Ada Lovelace',
    status: 'draft',
    needsReview: true,
  },
  {
    id: 'MLV-302',
    title: 'Prototype the panel',
    tags: ['spike'],
    owner: 'Grace Hopper',
    status: 'draft',
    needsReview: false,
  },
  {
    id: 'MLV-303',
    title: 'Implement the guard',
    description: 'One answer per drop, sync or async.',
    tags: ['policy'],
    owner: 'Linus Pauling',
    status: 'active',
    needsReview: true,
  },
  {
    id: 'MLV-304',
    title: 'Write the migration',
    tags: ['docs'],
    owner: 'Katherine Johnson',
    status: 'active',
    needsReview: false,
  },
  {
    id: 'MLV-305',
    title: 'Archived spike',
    description: 'Kept for the record; nothing leaves this column.',
    tags: ['spike'],
    owner: 'Grace Hopper',
    status: 'archived',
    needsReview: false,
  },
];

@Component({
  selector: 'docs-taskboard-policies-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideLock, MlvAvatar, MlvTaskboard, MlvTaskboardItemDef],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class TaskboardPoliciesExampleComponent {
  /** `archived` is locked: nothing enters it and nothing leaves it. */
  readonly columns = signal<readonly MlvTaskboardColumn[]>([
    { id: 'draft', label: 'Draft', accent: 'var(--mlv-background-info-1)' },
    {
      id: 'active',
      label: 'Active',
      accent: 'var(--mlv-background-success-1)',
    },
    {
      id: 'blocked',
      label: 'Blocked',
      accent: 'var(--mlv-background-warning-1)',
    },
    // The locked column wears the danger accent, so the stripe says what the
    // cursor and the `data-mlv-taskboard-column-locked` attribute already do.
    {
      id: 'archived',
      label: 'Archived',
      locked: true,
      accent: 'var(--mlv-background-danger-1)',
    },
  ]);

  /** Only these column changes exist; every other pair is refused. */
  readonly transitions: readonly MlvTaskboardTransition[] = [
    { from: 'draft', to: 'draft' },
    { from: 'draft', to: 'active' },
    { from: 'active', to: 'active' },
    { from: 'active', to: 'blocked' },
    { from: 'blocked', to: 'blocked' },
    { from: 'blocked', to: 'active' },
  ];

  /** One card is pinned wherever it is, whatever the transitions allow. */
  readonly lockedItemIds: readonly MlvTaskboardKey[] = ['MLV-304'];

  readonly tickets = signal<readonly Ticket[]>(TICKETS);

  readonly ticketType = TICKETS[0];

  /** Why the last started move never landed. */
  readonly lastRefusal = signal('Drag a card to see the policies answer.');

  /**
   * Synchronous permission policy. It is consulted for every candidate slot a
   * drag enumerates — whatever locks, transitions and WIP limits answered for
   * that slot — so it must stay cheap and free of side effects. Only the
   * recorded denial reason ranks it last, behind those three gates.
   */
  readonly canDrop: MlvTaskboardCanDropFn<Ticket> = (card, target) =>
    !(card.item.needsReview && target.column.id === 'blocked');

  /** Reports the reason the board gave for a move that changed nothing. */
  onMoveCancelled(event: MlvTaskboardMoveCancelledEvent<Ticket>): void {
    this.lastRefusal.set(`Move ended as “${event.reason}”.`);
  }

  /** Whether a card is in the immutable lock list. */
  isLocked(id: string): boolean {
    return this.lockedItemIds.includes(id);
  }
}
