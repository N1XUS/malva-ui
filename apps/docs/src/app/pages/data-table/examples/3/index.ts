import {
  Component,
  ChangeDetectionStrategy,
  computed,
  signal,
} from '@angular/core';
import type {
  MlvColumnResizeEvent,
  MlvDataTableColumn,
} from '@malva-ui/core/data-table';
import { MlvDataTable } from '@malva-ui/core/data-table';

interface Transaction {
  id: string;
  date: string;
  account: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  status: string;
  reference: string;
}

const TRANSACTIONS: Transaction[] = [
  {
    id: 'TXN001',
    date: '2026-03-20',
    account: 'ACC-001',
    merchant: 'Stripe Payments',
    category: 'Revenue',
    amount: 4250.0,
    currency: 'USD',
    status: 'Completed',
    reference: 'REF-A001',
  },
  {
    id: 'TXN002',
    date: '2026-03-20',
    account: 'ACC-002',
    merchant: 'AWS Services',
    category: 'Cloud',
    amount: -890.5,
    currency: 'USD',
    status: 'Completed',
    reference: 'REF-A002',
  },
  {
    id: 'TXN003',
    date: '2026-03-19',
    account: 'ACC-001',
    merchant: 'Shopify Store',
    category: 'Revenue',
    amount: 1340.0,
    currency: 'USD',
    status: 'Pending',
    reference: 'REF-A003',
  },
  {
    id: 'TXN004',
    date: '2026-03-19',
    account: 'ACC-003',
    merchant: 'Figma Inc',
    category: 'Software',
    amount: -75.0,
    currency: 'USD',
    status: 'Completed',
    reference: 'REF-A004',
  },
  {
    id: 'TXN005',
    date: '2026-03-18',
    account: 'ACC-001',
    merchant: 'Vercel Pro',
    category: 'Hosting',
    amount: -20.0,
    currency: 'USD',
    status: 'Completed',
    reference: 'REF-A005',
  },
  {
    id: 'TXN006',
    date: '2026-03-18',
    account: 'ACC-002',
    merchant: 'Google Ads',
    category: 'Marketing',
    amount: -580.0,
    currency: 'USD',
    status: 'Completed',
    reference: 'REF-A006',
  },
  {
    id: 'TXN007',
    date: '2026-03-17',
    account: 'ACC-001',
    merchant: 'PayPal Transfer',
    category: 'Revenue',
    amount: 2100.0,
    currency: 'USD',
    status: 'Completed',
    reference: 'REF-A007',
  },
  {
    id: 'TXN008',
    date: '2026-03-17',
    account: 'ACC-003',
    merchant: 'Notion Teams',
    category: 'Software',
    amount: -16.0,
    currency: 'USD',
    status: 'Failed',
    reference: 'REF-A008',
  },
  {
    id: 'TXN009',
    date: '2026-03-16',
    account: 'ACC-001',
    merchant: 'Digital Ocean',
    category: 'Hosting',
    amount: -48.0,
    currency: 'USD',
    status: 'Completed',
    reference: 'REF-A009',
  },
  {
    id: 'TXN010',
    date: '2026-03-16',
    account: 'ACC-002',
    merchant: 'Intercom',
    category: 'Support',
    amount: -74.0,
    currency: 'USD',
    status: 'Completed',
    reference: 'REF-A010',
  },
];

@Component({
  selector: 'docs-data-table-pinned-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDataTable],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DataTablePinnedExampleComponent {
  readonly transactions = TRANSACTIONS;
  readonly lastResize = signal<MlvColumnResizeEvent | null>(null);

  readonly resizeStatus = computed(() => {
    const event = this.lastResize();
    if (!event) return '';
    const label =
      this.columns.find((column) => column.key === event.key)?.title ??
      event.key;
    if (event.source === 'reset') {
      return `${label} returned to its declared width.`;
    }
    return `${label} resized to ${event.width}px with ${event.source}.`;
  });

  readonly columns: MlvDataTableColumn[] = [
    {
      key: 'id',
      title: 'ID',
      pinned: true,
      pinSide: 'left',
      width: '90px',
      minWidth: '72px',
      maxWidth: '160px',
      resizable: true,
      pinnable: true,
    },
    {
      key: 'date',
      title: 'Date',
      pinned: true,
      pinSide: 'left',
      width: '110px',
      minWidth: '96px',
      maxWidth: '200px',
      resizable: true,
      sortable: true,
      pinnable: true,
    },
    {
      key: 'account',
      title: 'Account',
      width: '110px',
      minWidth: '96px',
      maxWidth: '240px',
      resizable: true,
      pinnable: true,
    },
    {
      key: 'merchant',
      title: 'Merchant',
      width: '180px',
      minWidth: '140px',
      maxWidth: '360px',
      resizable: true,
      sortable: true,
      pinnable: true,
    },
    {
      key: 'category',
      title: 'Category',
      width: '120px',
      minWidth: '100px',
      maxWidth: '240px',
      resizable: true,
      pinnable: true,
    },
    {
      key: 'currency',
      title: 'Currency',
      width: '90px',
      align: 'center',
      pinnable: true,
    },
    { key: 'status', title: 'Status', width: '100px', pinnable: true },
    { key: 'reference', title: 'Reference', width: '120px', pinnable: true },
    {
      key: 'amount',
      title: 'Amount',
      pinned: true,
      pinSide: 'right',
      width: '110px',
      align: 'right',
      sortable: true,
      pinnable: true,
    },
  ];
}
