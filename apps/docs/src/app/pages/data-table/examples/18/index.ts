import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  MlvDataTable,
  type MlvDataSourceFilterOperator,
  type MlvFilterState,
  type MlvDataTableColumn,
} from '@malva-ui/core/data-table';
import {
  MlvSmartFilterBar,
  type MlvFilterDefinition,
  type MlvFilterExecutionPayload,
  type MlvFilterFieldState,
  type MlvFilterOperator,
} from '@malva-ui/core/filter';

interface WorkItem {
  title: string;
  owner: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Draft' | 'Requested' | 'Published';
}

function isTableOperator(
  operator: MlvFilterOperator,
): operator is MlvDataSourceFilterOperator {
  return [
    'contains',
    'not-contains',
    'equals',
    'not-equals',
    'in',
    'not-in',
  ].includes(operator);
}

function toTableFilters(
  states: readonly MlvFilterFieldState[],
): MlvFilterState[] {
  return states.flatMap((state) =>
    state.conditions.flatMap((condition) =>
      isTableOperator(condition.operator)
        ? [
            {
              key: state.key,
              operator: condition.operator,
              value: condition.value,
            },
          ]
        : [],
    ),
  );
}

@Component({
  selector: 'docs-data-table-smart-filter-example',
  imports: [MlvDataTable, MlvSmartFilterBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DataTableSmartFilterExampleComponent {
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
    {
      title: 'Mobile navigation',
      owner: 'Lina',
      priority: 'Low',
      status: 'Published',
    },
    {
      title: 'Usage report',
      owner: 'Maya',
      priority: 'Medium',
      status: 'Draft',
    },
    {
      title: 'Export workflow',
      owner: 'Noah',
      priority: 'High',
      status: 'Published',
    },
  ];

  readonly columns: MlvDataTableColumn<WorkItem>[] = [
    { key: 'title', title: 'Title', sortable: true, searchable: true },
    { key: 'owner', title: 'Owner', searchable: true, filterable: true },
    { key: 'priority', title: 'Priority', filterable: true },
    { key: 'status', title: 'Status', searchable: true, filterable: true },
  ];

  readonly definitions: readonly MlvFilterDefinition[] = [
    {
      key: 'status',
      label: 'Status',
      defaultVisible: true,
      multiple: true,
      options: ['Draft', 'Requested', 'Published'].map((value) => ({
        label: value,
        value,
      })),
    },
    {
      key: 'owner',
      label: 'Owner',
      defaultVisible: true,
      options: ['Maya', 'Noah', 'Lina'].map((value) => ({
        label: value,
        value,
      })),
    },
    {
      key: 'priority',
      label: 'Priority',
      defaultVisible: true,
      multiple: true,
      options: ['Low', 'Medium', 'High'].map((value) => ({
        label: value,
        value,
      })),
    },
    {
      key: 'title',
      label: 'Title',
      editor: 'text',
      allowMultipleConditions: false,
      operators: ['contains', 'not-contains', 'equals'],
    },
  ];

  readonly filters = signal<readonly MlvFilterFieldState[]>([]);
  readonly visibleKeys = signal<readonly string[]>([]);
  readonly searchValue = signal('');
  readonly tableFilters = signal<MlvFilterState[]>([]);
  readonly executedSearch = signal('');
  readonly lastAction = signal('Adjust the query, then choose Go');

  execute(payload: MlvFilterExecutionPayload, action = 'Query applied'): void {
    this.executedSearch.set(payload.search);
    this.tableFilters.set(toTableFilters(payload.filters));
    this.lastAction.set(action);
  }
}
