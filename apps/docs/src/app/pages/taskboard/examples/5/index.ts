import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucidePlus } from '@lucide/angular';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvButton } from '@malva-ui/core/button';
import { MlvListItem } from '@malva-ui/core/list';
import {
  MlvContextMenuTrigger,
  MlvMenu,
  MlvMenuItem,
} from '@malva-ui/core/menu';
import {
  MlvTaskboard,
  MlvTaskboardCardAddDef,
  MlvTaskboardColumnHeaderDef,
  MlvTaskboardDropIndicatorDef,
  MlvTaskboardEmptyStateDef,
  MlvTaskboardHeaderDef,
  MlvTaskboardItemDef,
} from '@malva-ui/taskboard';
import type {
  MlvTaskboardAddRequest,
  MlvTaskboardCardEvent,
  MlvTaskboardColumn,
} from '@malva-ui/taskboard';

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
    id: 'MLV-501',
    title: 'Replace the column header',
    description: 'A projected header owns its own count and controls.',
    tags: ['slots'],
    owner: 'Ada Lovelace',
    status: 'inbox',
  },
  {
    id: 'MLV-502',
    title: 'Replace the add affordance',
    tags: ['slots'],
    owner: 'Grace Hopper',
    status: 'inbox',
  },
  {
    id: 'MLV-503',
    title: 'Replace the empty state',
    description: 'Right-click a card for the context menu.',
    tags: ['slots', 'menu'],
    owner: 'Linus Pauling',
    status: 'staged',
  },
];

@Component({
  selector: 'docs-taskboard-slots-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucidePlus,
    MlvAvatar,
    MlvButton,
    MlvContextMenuTrigger,
    MlvListItem,
    MlvMenu,
    MlvMenuItem,
    MlvTaskboard,
    MlvTaskboardCardAddDef,
    MlvTaskboardColumnHeaderDef,
    MlvTaskboardDropIndicatorDef,
    MlvTaskboardEmptyStateDef,
    MlvTaskboardHeaderDef,
    MlvTaskboardItemDef,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class TaskboardSlotsExampleComponent {
  readonly columns = signal<readonly MlvTaskboardColumn[]>([
    { id: 'inbox', label: 'Inbox', accent: 'var(--mlv-background-info-1)' },
    {
      id: 'staged',
      label: 'Staged',
      wipLimit: 4,
      accent: 'var(--mlv-background-warning-1)',
    },
    {
      id: 'released',
      label: 'Released',
      accent: 'var(--mlv-background-success-1)',
    },
  ]);

  readonly tickets = signal<readonly Ticket[]>(TICKETS);

  readonly ticketType = TICKETS[0];

  /** The card the last right-click landed on — the menu acts on it. */
  readonly menuTarget = signal<Ticket | null>(null);

  /** Last thing the example did in response to a board request. */
  readonly lastRequest = signal('Right-click a card, or use the add buttons.');

  /** @private Suffix for generated card keys. */
  private _nextId = 600;

  /** Adds a card where the board's add affordance asked for one. */
  onAddRequested(request: MlvTaskboardAddRequest): void {
    this._nextId += 1;
    const id = `MLV-${this._nextId}`;
    this.tickets.update((current) => [
      ...current,
      {
        id,
        title: 'New card',
        tags: ['new'],
        owner: 'Unassigned',
        status: String(request.column.id),
      },
    ]);
    this.lastRequest.set(`Added ${id} to ${request.column.label}.`);
  }

  /** Records which card the context menu should act on. */
  onContextMenu(event: MlvTaskboardCardEvent<Ticket>): void {
    this.menuTarget.set(event.item);
  }

  /** Removes the card the context menu was opened on. */
  removeTarget(): void {
    const target = this.menuTarget();
    if (target === null) return;
    this.tickets.update((current) =>
      current.filter((ticket) => ticket.id !== target.id),
    );
    this.lastRequest.set(`Removed ${target.id}.`);
    this.menuTarget.set(null);
  }

  /** Sends the card the context menu was opened on to the last column. */
  releaseTarget(): void {
    const target = this.menuTarget();
    if (target === null) return;
    this.tickets.update((current) =>
      current.map((ticket) =>
        ticket.id === target.id ? { ...ticket, status: 'released' } : ticket,
      ),
    );
    this.lastRequest.set(`Released ${target.id}.`);
    this.menuTarget.set(null);
  }
}
