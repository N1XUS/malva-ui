import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import { MlvDataTable } from '@malva-ui/core/data-table';

interface Ticket {
  id: string;
  subject: string;
  reporter: string;
  assignee: string;
  priority: string;
  status: string;
  created: string;
  updated: string;
  comments: number;
}

const TICKETS: Ticket[] = [
  {
    id: 'TCK-101',
    subject: 'Login button disabled on Safari',
    reporter: 'amelia',
    assignee: 'ben',
    priority: 'High',
    status: 'Open',
    created: '2026-04-02',
    updated: '2026-04-09',
    comments: 8,
  },
  {
    id: 'TCK-102',
    subject: 'Dashboard charts mis-aligned',
    reporter: 'ben',
    assignee: 'cara',
    priority: 'Medium',
    status: 'In Review',
    created: '2026-04-01',
    updated: '2026-04-08',
    comments: 4,
  },
  {
    id: 'TCK-103',
    subject: 'Export CSV truncates long names',
    reporter: 'cara',
    assignee: 'dan',
    priority: 'Low',
    status: 'Open',
    created: '2026-03-28',
    updated: '2026-04-05',
    comments: 2,
  },
  {
    id: 'TCK-104',
    subject: 'Billing email missing invoice',
    reporter: 'dan',
    assignee: 'eva',
    priority: 'High',
    status: 'Resolved',
    created: '2026-03-25',
    updated: '2026-04-07',
    comments: 12,
  },
  {
    id: 'TCK-105',
    subject: 'Dark mode contrast on inputs',
    reporter: 'eva',
    assignee: 'finn',
    priority: 'Medium',
    status: 'Open',
    created: '2026-04-05',
    updated: '2026-04-09',
    comments: 3,
  },
  {
    id: 'TCK-106',
    subject: 'SSO callback URL mismatch',
    reporter: 'finn',
    assignee: 'gia',
    priority: 'Critical',
    status: 'In Review',
    created: '2026-04-06',
    updated: '2026-04-09',
    comments: 15,
  },
  {
    id: 'TCK-107',
    subject: 'Mobile nav drawer glitch',
    reporter: 'gia',
    assignee: 'huan',
    priority: 'Low',
    status: 'Open',
    created: '2026-04-03',
    updated: '2026-04-04',
    comments: 1,
  },
  {
    id: 'TCK-108',
    subject: '2FA recovery code flow',
    reporter: 'huan',
    assignee: 'amelia',
    priority: 'High',
    status: 'Resolved',
    created: '2026-03-20',
    updated: '2026-04-02',
    comments: 6,
  },
];

@Component({
  selector: 'docs-data-table-columns-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDataTable],
  templateUrl: './index.html',
})
export default class DataTableColumnsExampleComponent {
  readonly tickets = TICKETS;

  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'ID', width: '100px', sortable: true },
    { key: 'subject', title: 'Subject', sortable: true },
    { key: 'reporter', title: 'Reporter', width: '120px', hideable: true },
    { key: 'assignee', title: 'Assignee', width: '120px', hideable: true },
    { key: 'priority', title: 'Priority', width: '110px', hideable: true },
    { key: 'status', title: 'Status', width: '120px' },
    {
      key: 'created',
      title: 'Created',
      width: '130px',
      hideable: true,
      sortable: true,
    },
    {
      key: 'updated',
      title: 'Updated',
      width: '130px',
      hideable: true,
      sortable: true,
    },
    {
      key: 'comments',
      title: 'Comments',
      width: '110px',
      align: 'right',
      hideable: true,
    },
  ];
}
