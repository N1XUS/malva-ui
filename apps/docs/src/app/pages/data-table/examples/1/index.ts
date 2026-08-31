import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import { MlvDataTable } from '@malva-ui/core/data-table';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
}

const PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Wireless Headphones',
    category: 'Audio',
    price: 79.99,
    stock: 142,
  },
  {
    id: 2,
    name: 'Mechanical Keyboard',
    category: 'Peripherals',
    price: 129.99,
    stock: 56,
  },
  {
    id: 3,
    name: 'USB-C Hub',
    category: 'Accessories',
    price: 34.99,
    stock: 210,
  },
  { id: 4, name: '4K Monitor', category: 'Displays', price: 399.99, stock: 18 },
  {
    id: 5,
    name: 'Laptop Stand',
    category: 'Accessories',
    price: 49.99,
    stock: 87,
  },
  {
    id: 6,
    name: 'Webcam 1080p',
    category: 'Peripherals',
    price: 89.99,
    stock: 63,
  },
  { id: 7, name: 'Desk Lamp', category: 'Lighting', price: 44.99, stock: 105 },
  {
    id: 8,
    name: 'Mouse Pad XL',
    category: 'Accessories',
    price: 19.99,
    stock: 300,
  },
  {
    id: 9,
    name: 'Ergonomic Chair',
    category: 'Furniture',
    price: 549.99,
    stock: 9,
  },
  {
    id: 10,
    name: 'Cable Management',
    category: 'Accessories',
    price: 14.99,
    stock: 450,
  },
  {
    id: 11,
    name: 'Gaming Mouse',
    category: 'Peripherals',
    price: 59.99,
    stock: 78,
  },
  { id: 12, name: 'Microphone', category: 'Audio', price: 99.99, stock: 34 },
];

@Component({
  selector: 'docs-data-table-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDataTable],
  templateUrl: './index.html',
})
export default class DataTableBasicExampleComponent {
  readonly products = PRODUCTS;

  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: '#', width: '60px', align: 'center' },
    { key: 'name', title: 'Product', sortable: true },
    { key: 'category', title: 'Category', sortable: true },
    { key: 'price', title: 'Price', sortable: true, align: 'right' },
    { key: 'stock', title: 'Stock', sortable: true, align: 'right' },
  ];
}
