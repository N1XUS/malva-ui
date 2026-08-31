import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import { MlvDataTable, MlvDataTableCell } from '@malva-ui/core/data-table';
import type { MlvBadgeTone } from '@malva-ui/core/badge';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvAvatar, MlvColorFromTextPipe } from '@malva-ui/core/avatar';
import { MlvChip } from '@malva-ui/core/chip';
import { LucideExternalLink } from '@lucide/angular';

type Priority = 'critical' | 'high' | 'medium' | 'low';
type IssueStatus = 'open' | 'in-progress' | 'review' | 'done' | 'closed';

interface Issue {
  id: string;
  title: string;
  status: IssueStatus;
  priority: Priority;
  assignee: { name: string; avatar?: string };
  labels: string[];
  created: string;
  updated: string;
}

const ISSUES: Issue[] = [
  {
    id: 'LUM-1042',
    title: 'Data table column resize breaks on Firefox',
    status: 'open',
    priority: 'critical',
    assignee: { name: 'Sofia Andersson' },
    labels: ['bug', 'data-table'],
    created: '2026-04-08',
    updated: '2026-04-09',
  },
  {
    id: 'LUM-1041',
    title: 'Add virtual scroll support to combobox dropdown',
    status: 'in-progress',
    priority: 'high',
    assignee: { name: 'Marcus Chen' },
    labels: ['enhancement', 'combobox'],
    created: '2026-04-07',
    updated: '2026-04-09',
  },
  {
    id: 'LUM-1040',
    title: 'Calendar keyboard navigation skips disabled dates',
    status: 'review',
    priority: 'high',
    assignee: { name: 'Priya Sharma' },
    labels: ['bug', 'a11y', 'calendar'],
    created: '2026-04-07',
    updated: '2026-04-08',
  },
  {
    id: 'LUM-1039',
    title: 'Design new color-picker opacity slider',
    status: 'in-progress',
    priority: 'medium',
    assignee: { name: 'Marcus Chen' },
    labels: ['design', 'color-picker'],
    created: '2026-04-06',
    updated: '2026-04-08',
  },
  {
    id: 'LUM-1038',
    title: 'Tooltip arrow misaligned in RTL mode',
    status: 'open',
    priority: 'medium',
    assignee: { name: 'Omar Hassan' },
    labels: ['bug', 'rtl', 'tooltip'],
    created: '2026-04-05',
    updated: '2026-04-07',
  },
  {
    id: 'LUM-1037',
    title: 'Implement date-range-picker presets',
    status: 'done',
    priority: 'medium',
    assignee: { name: 'Yuki Tanaka' },
    labels: ['enhancement', 'date-range'],
    created: '2026-04-04',
    updated: '2026-04-07',
  },
  {
    id: 'LUM-1036',
    title: 'Sidebar collapse animation jank on mobile',
    status: 'closed',
    priority: 'low',
    assignee: { name: "James O'Connor" },
    labels: ['bug', 'sidebar'],
    created: '2026-04-03',
    updated: '2026-04-06',
  },
  {
    id: 'LUM-1035',
    title: 'Add density support to file-upload component',
    status: 'done',
    priority: 'low',
    assignee: { name: 'Elena Popova' },
    labels: ['enhancement', 'density'],
    created: '2026-04-02',
    updated: '2026-04-05',
  },
  {
    id: 'LUM-1034',
    title: 'Pagination shows NaN for empty datasets',
    status: 'closed',
    priority: 'high',
    assignee: { name: 'Ana Silva' },
    labels: ['bug', 'pagination'],
    created: '2026-04-01',
    updated: '2026-04-04',
  },
  {
    id: 'LUM-1033',
    title: 'Tree component lazy-load flickers on expand',
    status: 'open',
    priority: 'medium',
    assignee: { name: 'Sofia Andersson' },
    labels: ['bug', 'tree'],
    created: '2026-03-31',
    updated: '2026-04-03',
  },
];

@Component({
  selector: 'docs-data-table-rich-cells-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvDataTable,
    MlvDataTableCell,
    MlvBadge,
    MlvAvatar,
    MlvChip,
    LucideExternalLink,
    MlvColorFromTextPipe,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DataTableRichCellsExampleComponent {
  readonly issues = ISSUES;

  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'Issue', width: '110px', sortable: true },
    { key: 'title', title: 'Title', sortable: true, filterable: true },
    {
      key: 'status',
      title: 'Status',
      width: '130px',
      filterable: true,
      filterConfig: {
        options: [
          { label: 'Open', value: 'open' },
          { label: 'In Progress', value: 'in-progress' },
          { label: 'Review', value: 'review' },
          { label: 'Done', value: 'done' },
          { label: 'Closed', value: 'closed' },
        ],
      },
    },
    { key: 'priority', title: 'Priority', width: '110px', sortable: true },
    { key: 'assignee', title: 'Assignee', width: '180px' },
    { key: 'labels', title: 'Labels', width: '220px' },
    { key: 'updated', title: 'Updated', width: '110px', sortable: true },
  ];

  statusColor(status: IssueStatus): MlvBadgeTone {
    switch (status) {
      case 'open':
        return 'info';
      case 'in-progress':
        return 'warning';
      case 'review':
        return 'accent';
      case 'done':
        return 'success';
      case 'closed':
        return 'default';
    }
  }

  statusLabel(status: IssueStatus): string {
    switch (status) {
      case 'open':
        return 'Open';
      case 'in-progress':
        return 'In Progress';
      case 'review':
        return 'Review';
      case 'done':
        return 'Done';
      case 'closed':
        return 'Closed';
    }
  }

  priorityColor(priority: Priority): MlvBadgeTone {
    switch (priority) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
    }
  }
}
