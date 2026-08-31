import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvTable, MlvTableCell, MlvTableRow } from '@malva-ui/core/table';

@Component({
  selector: 'docs-table-pop-in-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTable, MlvTableRow, MlvTableCell],
  templateUrl: './index.html',
})
export default class TablePopInExampleComponent {}
