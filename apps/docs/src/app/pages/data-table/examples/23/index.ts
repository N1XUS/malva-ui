import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvDataTable,
  MlvDataTableToolbarActions,
  type MlvDataTableColumn,
  type MlvDataTablePresentationState,
} from '@malva-ui/core/data-table';

interface Order {
  customer: string;
  amount: number;
  status: string;
}

@Component({
  selector: 'docs-data-table-toolbar-example',
  imports: [MlvButton, MlvDataTable, MlvDataTableToolbarActions],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class DataTableToolbarExampleComponent {
  readonly orders: Order[] = [
    { customer: 'Northwind', amount: 18_400, status: 'Processing' },
    { customer: 'Acme', amount: 24_500, status: 'Ready' },
    { customer: 'Initech', amount: 8_200, status: 'Draft' },
  ];

  readonly columns: MlvDataTableColumn<Order>[] = [
    {
      key: 'customer',
      title: 'Customer',
      sortable: true,
      searchable: true,
    },
    {
      key: 'amount',
      title: 'Amount',
      sortable: true,
      searchable: true,
      align: 'right',
      valueLabels: {
        '18400': '€18,400',
        '24500': '€24,500',
        '8200': '€8,200',
      },
    },
    { key: 'status', title: 'Status', hideable: true },
  ];

  readonly query = signal('');
  readonly lastState = signal<MlvDataTablePresentationState | null>(null);
  readonly exportMessage = signal('');

  export(): void {
    this.exportMessage.set(`Prepared ${this.orders.length} orders for export.`);
  }
}
