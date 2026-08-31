import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  MlvDataTable,
  type MlvDataTableColumn,
} from '@malva-ui/core/data-table';

interface WorkItem {
  title: string;
  owner: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Draft' | 'Requested' | 'Published';
}

@Component({
  selector: 'docs-data-table-column-filter-example',
  imports: [MlvDataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class DataTableColumnFilterExampleComponent {
  readonly rows: WorkItem[] = [
    {
      title: 'Pricing page',
      owner: 'Maya',
      priority: 'High',
      status: 'Requested',
    },
    {
      title: 'Empty states',
      owner: 'Noah',
      priority: 'Medium',
      status: 'Draft',
    },
    {
      title: 'Billing email',
      owner: 'Maya',
      priority: 'Low',
      status: 'Published',
    },
    { title: 'Role editor', owner: 'Lina', priority: 'High', status: 'Draft' },
    {
      title: 'Audit history',
      owner: 'Noah',
      priority: 'Medium',
      status: 'Requested',
    },
  ];

  readonly columns: MlvDataTableColumn<WorkItem>[] = [
    { key: 'title', title: 'Title', sortable: true, searchable: true },
    { key: 'owner', title: 'Owner', filterable: true },
    {
      key: 'priority',
      title: 'Priority',
      filterable: true,
      filterConfig: {
        options: ['Low', 'Medium', 'High'].map((value) => ({
          label: value,
          value,
        })),
      },
    },
    {
      key: 'status',
      title: 'Status',
      filterable: true,
      filterConfig: {
        options: ['Draft', 'Requested', 'Published'].map((value) => ({
          label: value,
          value,
        })),
      },
    },
  ];
}
