import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
} from '@angular/core';
import type {
  MlvDataTableColumn,
  MlvSelectionChangeEvent,
} from '@malva-ui/core/data-table';
import { MlvDataTable } from '@malva-ui/core/data-table';

interface Subscriber {
  id: string;
  email: string;
  plan: 'Free' | 'Pro' | 'Enterprise';
  mrr: number;
  joined: string;
}

const SUBSCRIBERS: Subscriber[] = [
  {
    id: 'U001',
    email: 'amelia@acme.co',
    plan: 'Pro',
    mrr: 49,
    joined: '2025-06-12',
  },
  {
    id: 'U002',
    email: 'ben@pixelworks.io',
    plan: 'Enterprise',
    mrr: 499,
    joined: '2024-11-03',
  },
  {
    id: 'U003',
    email: 'cara@studio.dev',
    plan: 'Free',
    mrr: 0,
    joined: '2026-01-18',
  },
  {
    id: 'U004',
    email: 'dan@fluxlabs.net',
    plan: 'Pro',
    mrr: 49,
    joined: '2025-09-27',
  },
  {
    id: 'U005',
    email: 'eva@minimal.design',
    plan: 'Pro',
    mrr: 49,
    joined: '2025-12-02',
  },
  {
    id: 'U006',
    email: 'finn@hexcraft.io',
    plan: 'Enterprise',
    mrr: 499,
    joined: '2024-07-15',
  },
  {
    id: 'U007',
    email: 'gia@nova.team',
    plan: 'Free',
    mrr: 0,
    joined: '2026-02-28',
  },
  {
    id: 'U008',
    email: 'huan@brightforge.com',
    plan: 'Pro',
    mrr: 49,
    joined: '2025-04-09',
  },
];

@Component({
  selector: 'docs-data-table-selection-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDataTable],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DataTableSelectionExampleComponent {
  readonly subscribers = SUBSCRIBERS;
  readonly selected = signal<Set<Record<string, unknown>>>(new Set());

  readonly selectedCount = computed(() => this.selected().size);

  readonly totalMrr = computed(() => {
    let sum = 0;
    for (const row of this.selected()) {
      sum += (row as unknown as Subscriber).mrr;
    }
    return sum;
  });

  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'ID', width: '90px', sortable: true },
    { key: 'email', title: 'Email', sortable: true },
    { key: 'plan', title: 'Plan', width: '140px' },
    {
      key: 'mrr',
      title: 'MRR',
      width: '100px',
      align: 'right',
      sortable: true,
    },
    { key: 'joined', title: 'Joined', width: '130px', sortable: true },
  ];

  onSelectionChange(event: MlvSelectionChangeEvent): void {
    // The table also updates selectedRows via two-way binding; this output lets
    // consumers react to changes without subscribing to the signal directly.
    console.log('Selection:', event.selectedRows.size);
  }
}
