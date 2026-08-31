import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvTable, MlvTableCell } from '@malva-ui/core/table';

@Component({
  selector: 'docs-table-bordered-hover-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTable, MlvTableCell],
  templateUrl: './index.html',
})
export default class TableBorderedHoverExampleComponent {}
