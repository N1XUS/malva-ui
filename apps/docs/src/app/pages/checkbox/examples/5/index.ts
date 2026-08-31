import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvCheckbox } from '@malva-ui/core/checkbox';

@Component({
  selector: 'docs-checkbox-label-example',
  imports: [MlvCheckbox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class CheckboxLabelExampleComponent {}
