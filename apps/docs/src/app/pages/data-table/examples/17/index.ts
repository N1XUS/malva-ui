import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import {
  MlvDataTable,
  type MlvDataSourceFilterOperator,
  type MlvFilterState,
  type MlvDataTableColumn,
} from '@malva-ui/core/data-table';
import {
  MlvFilter,
  type MlvFilterCondition,
  type MlvFilterOption,
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

function toTableFilter(
  key: string,
  conditions: readonly MlvFilterCondition[],
): MlvFilterState | null {
  const condition = conditions[0];
  if (!condition || !isTableOperator(condition.operator)) return null;
  return { key, operator: condition.operator, value: condition.value };
}

@Component({
  selector: 'docs-data-table-simple-filter-example',
  imports: [MlvDataTable, MlvFilter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DataTableSimpleFilterExampleComponent {
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
  ];

  readonly columns: MlvDataTableColumn<WorkItem>[] = [
    { key: 'title', title: 'Title', sortable: true },
    { key: 'owner', title: 'Owner', filterable: true },
    { key: 'priority', title: 'Priority' },
    { key: 'status', title: 'Status', filterable: true },
  ];

  readonly statusOptions: readonly MlvFilterOption<string>[] = [
    { label: 'Draft', value: 'Draft' },
    { label: 'Requested', value: 'Requested' },
    { label: 'Published', value: 'Published' },
  ];
  readonly ownerOptions: readonly MlvFilterOption<string>[] = [
    { label: 'Maya', value: 'Maya' },
    { label: 'Noah', value: 'Noah' },
    { label: 'Lina', value: 'Lina' },
  ];

  readonly statusConditions = signal<readonly MlvFilterCondition[]>([]);
  readonly ownerConditions = signal<readonly MlvFilterCondition[]>([]);

  readonly activeFilters = computed<MlvFilterState[]>(() => {
    const filters = [
      toTableFilter('status', this.statusConditions()),
      toTableFilter('owner', this.ownerConditions()),
    ];
    return filters.filter(
      (filter): filter is MlvFilterState => filter !== null,
    );
  });
}
