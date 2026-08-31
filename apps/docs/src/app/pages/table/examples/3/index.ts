import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvTable, MlvTableCell } from '@malva-ui/core/table';

@Component({
  selector: 'docs-table-responsive-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTable, MlvTableCell],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class TableResponsiveExampleComponent {}
