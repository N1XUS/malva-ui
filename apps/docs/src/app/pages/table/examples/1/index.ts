import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvTable, MlvTableCell } from '@malva-ui/core/table';

@Component({
  selector: 'docs-table-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTable, MlvTableCell],
  templateUrl: './index.html',
})
export default class TableBasicExampleComponent {}
