import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import { MlvDataTable } from '@malva-ui/core/data-table';
import { MlvButton } from '@malva-ui/core/button';

interface Product {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}

const PRODUCTS: Product[] = [
  {
    sku: 'SKU-001',
    name: 'Wireless Mouse',
    category: 'Peripherals',
    price: 29.99,
    stock: 142,
  },
  {
    sku: 'SKU-002',
    name: 'USB-C Hub',
    category: 'Accessories',
    price: 49.0,
    stock: 87,
  },
  {
    sku: 'SKU-003',
    name: 'Mechanical Keyboard',
    category: 'Peripherals',
    price: 129.0,
    stock: 34,
  },
  {
    sku: 'SKU-004',
    name: '4K Monitor',
    category: 'Displays',
    price: 349.99,
    stock: 12,
  },
  {
    sku: 'SKU-005',
    name: 'Laptop Stand',
    category: 'Accessories',
    price: 39.5,
    stock: 203,
  },
  {
    sku: 'SKU-006',
    name: 'Webcam 1080p',
    category: 'Peripherals',
    price: 79.0,
    stock: 56,
  },
  {
    sku: 'SKU-007',
    name: 'Desk Mat',
    category: 'Accessories',
    price: 19.99,
    stock: 318,
  },
  {
    sku: 'SKU-008',
    name: 'HDMI Cable 2m',
    category: 'Cables',
    price: 9.99,
    stock: 540,
  },
];

@Component({
  selector: 'docs-data-table-loading-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDataTable, MlvButton],
  templateUrl: './index.html',
})
export default class DataTableLoadingExampleComponent {
  readonly products = signal<Product[]>(PRODUCTS);
  readonly isLoading = signal(false);

  readonly columns: MlvDataTableColumn[] = [
    { key: 'sku', title: 'SKU', width: '110px', sortable: true },
    { key: 'name', title: 'Name', sortable: true },
    { key: 'category', title: 'Category', width: '160px' },
    {
      key: 'price',
      title: 'Price',
      width: '100px',
      align: 'right',
      sortable: true,
    },
    {
      key: 'stock',
      title: 'Stock',
      width: '100px',
      align: 'right',
      sortable: true,
    },
  ];

  simulateLoad(): void {
    this.isLoading.set(true);
    setTimeout(() => this.isLoading.set(false), 1800);
  }
}
