import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvCheckbox, MlvCheckboxGroup } from '@malva-ui/core/checkbox';

@Component({
  selector: 'docs-checkbox-group-example',
  imports: [MlvCheckbox, MlvCheckboxGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class CheckboxGroupExampleComponent {}
