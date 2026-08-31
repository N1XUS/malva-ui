import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import { MlvDataTable } from '@malva-ui/core/data-table';

interface Transaction {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  status: 'Completed' | 'Pending' | 'Failed';
  createdAt: string;
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
  'Massive Dynamic',
  'Soylent',
  'Cyberdyne',
  'Tyrell Corp',
  'Weyland-Yutani',
];
const CATEGORIES = [
  'Software',
  'Hardware',
  'Consulting',
  'Travel',
  'Office Supplies',
  'Marketing',
  'Legal',
];
const STATUSES: Transaction['status'][] = ['Completed', 'Pending', 'Failed'];

const ROW_COUNT = 10_000;

const buildDataset = (count: number): Transaction[] =>
  Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const dayOffset = n % 365;
    const date = new Date(2025, 0, 1 + dayOffset);
    return {
      id: `TX-${String(n).padStart(6, '0')}`,
      merchant: MERCHANTS[n % MERCHANTS.length],
      category: CATEGORIES[n % CATEGORIES.length],
      amount: Math.round((25 + ((n * 37) % 4975)) * 100) / 100,
      status: STATUSES[n % STATUSES.length],
      createdAt: date.toISOString().slice(0, 10),
    };
  });

@Component({
  selector: 'docs-data-table-virtual-scroll-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDataTable],
  templateUrl: './index.html',
})
export default class DataTableVirtualScrollExampleComponent {
  readonly rows = signal<Transaction[]>(buildDataset(ROW_COUNT));

  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'Transaction', width: '140px' },
    { key: 'merchant', title: 'Merchant', width: '200px' },
    { key: 'category', title: 'Category', width: '160px' },
    { key: 'amount', title: 'Amount', width: '120px', align: 'right' },
    { key: 'status', title: 'Status', width: '120px' },
    { key: 'createdAt', title: 'Created', width: '140px' },
  ];
}
