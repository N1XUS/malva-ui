import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvSwitch, MlvSwitchGroup } from '@malva-ui/core/switch';

@Component({
  selector: 'docs-switch-group-example',
  imports: [MlvSwitch, MlvSwitchGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class SwitchGroupExampleComponent {}
