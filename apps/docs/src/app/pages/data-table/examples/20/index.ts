import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import { MlvDataTable, MlvDataTableError } from '@malva-ui/core/data-table';
import { MlvButton } from '@malva-ui/core/button';

interface Invoice {
  number: string;
  customer: string;
  amount: number;
}

const INVOICES: Invoice[] = [
  { number: 'INV-1042', customer: 'Northstar', amount: 1290 },
  { number: 'INV-1043', customer: 'Canopy', amount: 480 },
  { number: 'INV-1044', customer: 'Fieldwork', amount: 2350 },
];

@Component({
  selector: 'docs-data-table-error-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDataTable, MlvDataTableError, MlvButton],
  templateUrl: './index.html',
})
export default class DataTableErrorExampleComponent {
  readonly rows = signal<Invoice[]>(INVOICES);
  readonly isLoading = signal(false);
  /** `false` = healthy, `true` = default message, string = custom message. */
  readonly error = signal<boolean | string>(false);
  readonly customTemplate = signal(false);

  readonly columns: MlvDataTableColumn<Invoice>[] = [
    { key: 'number', title: 'Invoice', width: '140px' },
    { key: 'customer', title: 'Customer' },
    { key: 'amount', title: 'Amount', width: '120px', align: 'right' },
  ];

  /** Simulates a request that fails with a server-supplied message. */
  fail(): void {
    this.rows.set([]);
    this.error.set('The billing service returned a 500. Please try again.');
  }

  /** Simulates a successful refetch triggered by the error block's Retry. */
  reload(): void {
    this.isLoading.set(true);
    setTimeout(() => {
      this.error.set(false);
      this.rows.set(INVOICES);
      this.isLoading.set(false);
    }, 1200);
  }
}
