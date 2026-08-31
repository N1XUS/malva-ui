import { Component, ChangeDetectionStrategy, computed } from '@angular/core';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import { MlvDataTable, MlvDataTableFooter } from '@malva-ui/core/data-table';

interface LineItem {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

const ITEMS: LineItem[] = [
  {
    sku: 'LI-01',
    description: 'Design Strategy Workshop',
    quantity: 1,
    unitPrice: 4800,
    total: 4800,
  },
  {
    sku: 'LI-02',
    description: 'Brand Identity Package',
    quantity: 1,
    unitPrice: 3600,
    total: 3600,
  },
  {
    sku: 'LI-03',
    description: 'Website Design (8 pages)',
    quantity: 8,
    unitPrice: 680,
    total: 5440,
  },
  {
    sku: 'LI-04',
    description: 'Component Library (Malva UI)',
    quantity: 1,
    unitPrice: 5200,
    total: 5200,
  },
  {
    sku: 'LI-05',
    description: 'Motion Prototype',
    quantity: 2,
    unitPrice: 890,
    total: 1780,
  },
  {
    sku: 'LI-06',
    description: 'Accessibility Audit',
    quantity: 1,
    unitPrice: 1400,
    total: 1400,
  },
  {
    sku: 'LI-07',
    description: 'Developer Handoff Package',
    quantity: 1,
    unitPrice: 650,
    total: 650,
  },
];

@Component({
  selector: 'docs-data-table-footer-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDataTable, MlvDataTableFooter],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DataTableFooterExampleComponent {
  readonly items = ITEMS;

  readonly totalQuantity = computed(() =>
    this.items.reduce((sum, i) => sum + i.quantity, 0),
  );

  readonly subtotal = computed(() =>
    this.items.reduce((sum, i) => sum + i.total, 0),
  );

  readonly columns: MlvDataTableColumn[] = [
    { key: 'sku', title: 'SKU', width: '100px' },
    { key: 'description', title: 'Description' },
    { key: 'quantity', title: 'Qty', width: '80px', align: 'right' },
    { key: 'unitPrice', title: 'Unit Price', width: '120px', align: 'right' },
    { key: 'total', title: 'Total', width: '120px', align: 'right' },
  ];

  format(value: number): string {
    return '$' + value.toLocaleString('en-US');
  }
}
