import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvRadio, MlvRadioGroup } from '@malva-ui/core/radio';

@Component({
  selector: 'docs-radio-disabled-group-example',
  imports: [MlvRadio, MlvRadioGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class RadioDisabledGroupExampleComponent {}
