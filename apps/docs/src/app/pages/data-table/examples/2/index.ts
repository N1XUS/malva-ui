import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import { MlvDataTable, MlvDataTableCell } from '@malva-ui/core/data-table';

interface Employee {
  id: number;
  name: string;
  department: string;
  status: 'active' | 'on-leave' | 'inactive';
  salary: number;
}

const EMPLOYEES: Employee[] = [
  {
    id: 1,
    name: 'Alice Martin',
    department: 'Engineering',
    status: 'active',
    salary: 95000,
  },
  {
    id: 2,
    name: 'Bob Chen',
    department: 'Engineering',
    status: 'active',
    salary: 88000,
  },
  {
    id: 3,
    name: 'Carol White',
    department: 'Design',
    status: 'on-leave',
    salary: 78000,
  },
  {
    id: 4,
    name: 'David Lee',
    department: 'Product',
    status: 'active',
    salary: 105000,
  },
  {
    id: 5,
    name: 'Eva Rodriguez',
    department: 'Engineering',
    status: 'inactive',
    salary: 91000,
  },
  {
    id: 6,
    name: 'Frank Kim',
    department: 'Design',
    status: 'active',
    salary: 72000,
  },
  {
    id: 7,
    name: 'Grace Patel',
    department: 'Engineering',
    status: 'active',
    salary: 83000,
  },
  {
    id: 8,
    name: 'Henry Brown',
    department: 'Marketing',
    status: 'on-leave',
    salary: 67000,
  },
  {
    id: 9,
    name: 'Iris Zhang',
    department: 'Engineering',
    status: 'active',
    salary: 115000,
  },
  {
    id: 10,
    name: 'James Wilson',
    department: 'Sales',
    status: 'active',
    salary: 74000,
  },
  {
    id: 11,
    name: 'Karen Scott',
    department: 'Engineering',
    status: 'inactive',
    salary: 80000,
  },
  {
    id: 12,
    name: "Liam O'Brien",
    department: 'Product',
    status: 'active',
    salary: 98000,
  },
];

@Component({
  selector: 'docs-data-table-custom-cells-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDataTable, MlvDataTableCell],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DataTableCustomCellsExampleComponent {
  readonly employees = EMPLOYEES;

  readonly columns: MlvDataTableColumn[] = [
    { key: 'name', title: 'Name', sortable: true, filterable: true },
    {
      key: 'department',
      title: 'Department',
      sortable: true,
      filterable: true,
      filterConfig: {
        options: [
          { label: 'Engineering', value: 'Engineering' },
          { label: 'Design', value: 'Design' },
          { label: 'Product', value: 'Product' },
          { label: 'Marketing', value: 'Marketing' },
          { label: 'Sales', value: 'Sales' },
        ],
      },
    },
    {
      key: 'status',
      title: 'Status',
      filterable: true,
      filterConfig: {
        options: [
          { label: 'Active', value: 'active' },
          { label: 'On Leave', value: 'on-leave' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
    },
    { key: 'salary', title: 'Salary', sortable: true, align: 'right' },
  ];
}
