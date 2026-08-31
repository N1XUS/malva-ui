import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import { MlvDataTable } from '@malva-ui/core/data-table';
import type { MlvTone } from '@malva-ui/cdk/utils';

type DeployStatus = 'queued' | 'running' | 'succeeded' | 'failed';

interface Deployment {
  service: string;
  environment: 'dev' | 'staging' | 'prod';
  status: DeployStatus;
  duration: string;
}

const STATUS_TONES: Record<DeployStatus, MlvTone> = {
  queued: 'info',
  running: 'info',
  succeeded: 'success',
  failed: 'danger',
};

@Component({
  selector: 'docs-data-table-value-labels-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDataTable],
  templateUrl: './index.html',
})
export default class DataTableValueLabelsExampleComponent {
  readonly rows: Deployment[] = [
    {
      service: 'checkout-api',
      environment: 'prod',
      status: 'succeeded',
      duration: '2m 14s',
    },
    {
      service: 'billing-worker',
      environment: 'prod',
      status: 'failed',
      duration: '0m 42s',
    },
    {
      service: 'search-indexer',
      environment: 'staging',
      status: 'running',
      duration: '1m 03s',
    },
    {
      service: 'notifications',
      environment: 'dev',
      status: 'queued',
      duration: '—',
    },
  ];

  readonly columns: MlvDataTableColumn<Deployment>[] = [
    { key: 'service', title: 'Service', sortable: true },
    {
      key: 'environment',
      title: 'Environment',
      width: '160px',
      filterable: true,
      // No `valueLabels` — the default cell reuses these filter option labels.
      filterConfig: {
        options: [
          { label: 'Development', value: 'dev' },
          { label: 'Staging', value: 'staging' },
          { label: 'Production', value: 'prod' },
        ],
      },
    },
    {
      key: 'status',
      title: 'Status',
      width: '150px',
      valueLabels: {
        queued: 'Queued',
        running: 'Running',
        succeeded: 'Succeeded',
        failed: 'Failed',
      },
      tone: (row) => STATUS_TONES[row.status],
    },
    { key: 'duration', title: 'Duration', width: '120px', align: 'right' },
  ];
}
