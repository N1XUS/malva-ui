import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvSwitch } from '@malva-ui/core/switch';

@Component({
  selector: 'docs-switch-disabled-example',
  imports: [MlvSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class SwitchDisabledExampleComponent {}
