import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvSelect } from '@malva-ui/core/select';

@Component({
  selector: 'docs-select-with-states-example',
  imports: [MlvSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class SelectWithStatesExampleComponent {
  fruits = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape'];
}
