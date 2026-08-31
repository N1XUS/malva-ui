import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import type {
  MlvDataTableColumn,
  MlvLoadMoreEvent,
} from '@malva-ui/core/data-table';
import { MlvDataTable } from '@malva-ui/core/data-table';

interface Transaction {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  status: 'Completed' | 'Pending' | 'Failed';
}

const MERCHANTS = [
  'Acme Corp',
  'Globex',
  'Initech',
  'Umbrella',
  'Stark Industries',
  'Wayne Enterprises',
  'Oscorp',
  'Wonka Co',
  'Hooli',
  'Pied Piper',
];
const CATEGORIES = [
  'Software',
  'Hardware',
  'Consulting',
  'Travel',
  'Office Supplies',
];
const STATUSES: Transaction['status'][] = ['Completed', 'Pending', 'Failed'];

const PAGE_SIZE = 15;
const TOTAL_PAGES = 6;

const buildPage = (page: number): Transaction[] =>
  Array.from({ length: PAGE_SIZE }, (_, i) => {
    const n = (page - 1) * PAGE_SIZE + i + 1;
    return {
      id: `TX-${String(n).padStart(5, '0')}`,
      merchant: MERCHANTS[n % MERCHANTS.length],
      category: CATEGORIES[n % CATEGORIES.length],
      amount: Math.round((50 + ((n * 37) % 950)) * 100) / 100,
      status: STATUSES[n % STATUSES.length],
    };
  });

@Component({
  selector: 'docs-data-table-infinite-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDataTable],
  templateUrl: './index.html',
})
export default class DataTableInfiniteScrollExampleComponent {
  readonly rows = signal<Transaction[]>(buildPage(1));
  readonly isLoading = signal(false);
  readonly hasMore = signal(true);

  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'Transaction', width: '140px' },
    { key: 'merchant', title: 'Merchant', width: '200px' },
    { key: 'category', title: 'Category', width: '160px' },
    { key: 'amount', title: 'Amount', width: '120px', align: 'right' },
    { key: 'status', title: 'Status', width: '120px' },
  ];

  onLoadMore(event: MlvLoadMoreEvent): void {
    if (this.isLoading() || !this.hasMore()) return;
    this.isLoading.set(true);
    // Simulate async page fetch — append rows, flip the loading flag,
    // and clear hasMore once the final page has arrived.
    setTimeout(() => {
      const next = buildPage(event.page);
      this.rows.update((current) => [...current, ...next]);
      if (event.page >= TOTAL_PAGES) {
        this.hasMore.set(false);
      }
      this.isLoading.set(false);
    }, 700);
  }
}
