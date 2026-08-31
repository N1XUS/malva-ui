import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvSelect } from '@malva-ui/core/select';

@Component({
  selector: 'docs-select-single-example',
  imports: [MlvSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class SelectSingleExampleComponent {
  fruits = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape'];
}
