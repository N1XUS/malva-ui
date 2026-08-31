import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvList,
  MlvListItem,
  MlvListItemSelectable,
  MlvListSelectable,
} from '@malva-ui/core/list';

@Component({
  selector: 'docs-list-single-selection-example',
  imports: [MlvList, MlvListItem, MlvListItemSelectable, MlvListSelectable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ListSingleSelectionExampleComponent {}
