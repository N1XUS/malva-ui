import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import { MlvDataTable, MlvDataTableCell } from '@malva-ui/core/data-table';
import type { MlvBadgeTone } from '@malva-ui/core/badge';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvButton } from '@malva-ui/core/button';

type MlvDensity = 'tight' | 'compact' | 'comfortable' | 'spacious' | 'airy';

interface Order {
  orderId: string;
  customer: string;
  product: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: 'pending' | 'shipped' | 'delivered' | 'returned';
  region: string;
  channel: string;
  date: string;
}

const ORDERS: Order[] = [
  {
    orderId: 'ORD-9001',
    customer: 'Acme Corp',
    product: 'Enterprise License',
    quantity: 5,
    unitPrice: 2400,
    total: 12000,
    status: 'delivered',
    region: 'North America',
    channel: 'Direct',
    date: '2026-04-08',
  },
  {
    orderId: 'ORD-9002',
    customer: 'TechStart Inc',
    product: 'Team Plan',
    quantity: 20,
    unitPrice: 49,
    total: 980,
    status: 'shipped',
    region: 'North America',
    channel: 'Website',
    date: '2026-04-08',
  },
  {
    orderId: 'ORD-9003',
    customer: 'Globex GmbH',
    product: 'Enterprise License',
    quantity: 3,
    unitPrice: 2400,
    total: 7200,
    status: 'pending',
    region: 'Europe',
    channel: 'Partner',
    date: '2026-04-07',
  },
  {
    orderId: 'ORD-9004',
    customer: 'Initech Ltd',
    product: 'Pro Plan',
    quantity: 10,
    unitPrice: 99,
    total: 990,
    status: 'delivered',
    region: 'Europe',
    channel: 'Website',
    date: '2026-04-07',
  },
  {
    orderId: 'ORD-9005',
    customer: 'Soylent Corp',
    product: 'Custom Integration',
    quantity: 1,
    unitPrice: 15000,
    total: 15000,
    status: 'shipped',
    region: 'North America',
    channel: 'Direct',
    date: '2026-04-06',
  },
  {
    orderId: 'ORD-9006',
    customer: 'Umbrella Inc',
    product: 'Team Plan',
    quantity: 50,
    unitPrice: 49,
    total: 2450,
    status: 'returned',
    region: 'Asia Pacific',
    channel: 'Website',
    date: '2026-04-06',
  },
  {
    orderId: 'ORD-9007',
    customer: 'Wayne Tech',
    product: 'Enterprise License',
    quantity: 10,
    unitPrice: 2400,
    total: 24000,
    status: 'delivered',
    region: 'North America',
    channel: 'Direct',
    date: '2026-04-05',
  },
  {
    orderId: 'ORD-9008',
    customer: 'Stark Industries',
    product: 'Custom Integration',
    quantity: 1,
    unitPrice: 45000,
    total: 45000,
    status: 'pending',
    region: 'North America',
    channel: 'Direct',
    date: '2026-04-05',
  },
  {
    orderId: 'ORD-9009',
    customer: 'Cyberdyne Ltd',
    product: 'Pro Plan',
    quantity: 25,
    unitPrice: 99,
    total: 2475,
    status: 'shipped',
    region: 'Asia Pacific',
    channel: 'Partner',
    date: '2026-04-04',
  },
  {
    orderId: 'ORD-9010',
    customer: 'Oscorp',
    product: 'Team Plan',
    quantity: 15,
    unitPrice: 49,
    total: 735,
    status: 'delivered',
    region: 'Europe',
    channel: 'Website',
    date: '2026-04-04',
  },
  {
    orderId: 'ORD-9011',
    customer: 'Weyland Corp',
    product: 'Enterprise License',
    quantity: 8,
    unitPrice: 2400,
    total: 19200,
    status: 'delivered',
    region: 'Europe',
    channel: 'Partner',
    date: '2026-04-03',
  },
  {
    orderId: 'ORD-9012',
    customer: 'Massive Dynamic',
    product: 'Custom Integration',
    quantity: 1,
    unitPrice: 28000,
    total: 28000,
    status: 'shipped',
    region: 'North America',
    channel: 'Direct',
    date: '2026-04-02',
  },
];

@Component({
  selector: 'docs-data-table-density-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDataTable, MlvDataTableCell, MlvBadge, MlvButton],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DataTableDensityExampleComponent {
  readonly orders = ORDERS;
  readonly activeDensity = signal<MlvDensity>('comfortable');
  readonly densities: MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];

  readonly columns: MlvDataTableColumn[] = [
    { key: 'orderId', title: 'Order', width: '110px', sortable: true },
    { key: 'customer', title: 'Customer', sortable: true, filterable: true },
    { key: 'product', title: 'Product', sortable: true },
    { key: 'quantity', title: 'Qty', width: '70px', align: 'center' },
    {
      key: 'total',
      title: 'Total',
      width: '120px',
      align: 'right',
      sortable: true,
    },
    { key: 'status', title: 'Status', width: '120px' },
    {
      key: 'region',
      title: 'Region',
      width: '140px',
      responsive: { 0: 'hidden', 700: 'visible' },
    },
    {
      key: 'channel',
      title: 'Channel',
      width: '110px',
      responsive: { 0: 'hidden', 800: 'visible' },
    },
    { key: 'date', title: 'Date', width: '110px', sortable: true },
  ];

  statusColor(status: string): MlvBadgeTone {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'shipped':
        return 'info';
      case 'delivered':
        return 'success';
      case 'returned':
        return 'danger';
      default:
        return 'default';
    }
  }

  setDensity(density: MlvDensity): void {
    this.activeDensity.set(density);
  }
}
