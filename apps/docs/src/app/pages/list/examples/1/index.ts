import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvList, MlvListItem } from '@malva-ui/core/list';

@Component({
  selector: 'docs-list-basic-example',
  imports: [MlvList, MlvListItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ListBasicExampleComponent {}
