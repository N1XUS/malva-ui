import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvSelect } from '@malva-ui/core/select';

@Component({
  selector: 'docs-select-multiple-example',
  imports: [MlvSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class SelectMultipleExampleComponent {
  fruits = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape'];
}
