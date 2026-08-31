import { Component, ChangeDetectionStrategy } from '@angular/core';
import type {
  MlvDataTableColumn,
  MlvDataTableColumnGroup,
} from '@malva-ui/core/data-table';
import { MlvDataTable, MlvDataTableCell } from '@malva-ui/core/data-table';

interface QuarterlyReport {
  department: string;
  headcount: number;
  q1Revenue: number;
  q1Expenses: number;
  q1Profit: number;
  q2Revenue: number;
  q2Expenses: number;
  q2Profit: number;
  yoyGrowth: string;
}

const REPORTS: QuarterlyReport[] = [
  {
    department: 'Engineering',
    headcount: 48,
    q1Revenue: 1250000,
    q1Expenses: 890000,
    q1Profit: 360000,
    q2Revenue: 1380000,
    q2Expenses: 920000,
    q2Profit: 460000,
    yoyGrowth: '+18%',
  },
  {
    department: 'Sales',
    headcount: 32,
    q1Revenue: 2100000,
    q1Expenses: 680000,
    q1Profit: 1420000,
    q2Revenue: 2340000,
    q2Expenses: 710000,
    q2Profit: 1630000,
    yoyGrowth: '+24%',
  },
  {
    department: 'Marketing',
    headcount: 18,
    q1Revenue: 450000,
    q1Expenses: 520000,
    q1Profit: -70000,
    q2Revenue: 620000,
    q2Expenses: 490000,
    q2Profit: 130000,
    yoyGrowth: '+8%',
  },
  {
    department: 'Support',
    headcount: 24,
    q1Revenue: 180000,
    q1Expenses: 340000,
    q1Profit: -160000,
    q2Revenue: 210000,
    q2Expenses: 350000,
    q2Profit: -140000,
    yoyGrowth: '-2%',
  },
  {
    department: 'Product',
    headcount: 12,
    q1Revenue: 0,
    q1Expenses: 420000,
    q1Profit: -420000,
    q2Revenue: 0,
    q2Expenses: 450000,
    q2Profit: -450000,
    yoyGrowth: '+5%',
  },
  {
    department: 'Operations',
    headcount: 8,
    q1Revenue: 90000,
    q1Expenses: 210000,
    q1Profit: -120000,
    q2Revenue: 95000,
    q2Expenses: 215000,
    q2Profit: -120000,
    yoyGrowth: '+1%',
  },
  {
    department: 'HR',
    headcount: 6,
    q1Revenue: 0,
    q1Expenses: 180000,
    q1Profit: -180000,
    q2Revenue: 0,
    q2Expenses: 185000,
    q2Profit: -185000,
    yoyGrowth: '0%',
  },
  {
    department: 'Legal',
    headcount: 4,
    q1Revenue: 120000,
    q1Expenses: 290000,
    q1Profit: -170000,
    q2Revenue: 135000,
    q2Expenses: 295000,
    q2Profit: -160000,
    yoyGrowth: '+3%',
  },
];

@Component({
  selector: 'docs-data-table-groups-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDataTable, MlvDataTableCell],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DataTableGroupsExampleComponent {
  readonly reports = REPORTS;

  readonly columns: MlvDataTableColumn[] = [
    {
      key: 'department',
      title: 'Department',
      sortable: true,
      filterable: true,
    },
    { key: 'headcount', title: 'HC', width: '70px', align: 'center' },
    {
      key: 'q1Revenue',
      title: 'Revenue',
      width: '120px',
      align: 'right',
      sortable: true,
    },
    { key: 'q1Expenses', title: 'Expenses', width: '120px', align: 'right' },
    {
      key: 'q1Profit',
      title: 'Profit',
      width: '120px',
      align: 'right',
      sortable: true,
    },
    {
      key: 'q2Revenue',
      title: 'Revenue',
      width: '120px',
      align: 'right',
      sortable: true,
    },
    { key: 'q2Expenses', title: 'Expenses', width: '120px', align: 'right' },
    {
      key: 'q2Profit',
      title: 'Profit',
      width: '120px',
      align: 'right',
      sortable: true,
    },
    { key: 'yoyGrowth', title: 'YoY Growth', width: '110px', align: 'center' },
  ];

  readonly columnGroups: MlvDataTableColumnGroup[] = [
    { title: 'Q1 2026', columns: ['q1Revenue', 'q1Expenses', 'q1Profit'] },
    { title: 'Q2 2026', columns: ['q2Revenue', 'q2Expenses', 'q2Profit'] },
  ];

  formatCurrency(value: number): string {
    if (value === 0) return '—';
    const abs = Math.abs(value);
    const formatted =
      abs >= 1000000
        ? `$${(abs / 1000000).toFixed(1)}M`
        : `$${(abs / 1000).toFixed(0)}K`;
    return value < 0 ? `(${formatted})` : formatted;
  }
}
