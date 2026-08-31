import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  MlvDataTable,
  type MlvDataTableColumn,
} from '@malva-ui/core/data-table';

interface Customer {
  name: string;
  company: string;
  city: string;
  plan: string;
}

@Component({
  selector: 'docs-data-table-search-example',
  imports: [MlvDataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class DataTableSearchExampleComponent {
  readonly customers: Customer[] = [
    { name: 'Amira Khan', company: 'Northstar', city: 'Berlin', plan: 'Pro' },
    { name: 'Bruno Silva', company: 'Canopy', city: 'Lisbon', plan: 'Team' },
    { name: 'Chloe Martin', company: 'Northstar', city: 'Paris', plan: 'Pro' },
    { name: 'Darius Cole', company: 'Fieldwork', city: 'London', plan: 'Free' },
    { name: 'Elena Pop', company: 'Canopy', city: 'Cluj', plan: 'Team' },
    { name: 'Farah Noor', company: 'Monument', city: 'Dubai', plan: 'Pro' },
  ];

  readonly columns: MlvDataTableColumn<Customer>[] = [
    { key: 'name', title: 'Customer', sortable: true, searchable: true },
    { key: 'company', title: 'Company', searchable: true },
    { key: 'city', title: 'City', searchable: true },
    { key: 'plan', title: 'Plan' },
  ];
}
