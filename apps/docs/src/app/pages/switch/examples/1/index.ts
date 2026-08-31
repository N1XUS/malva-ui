import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { MlvSwitch } from '@malva-ui/core/switch';

@Component({
  selector: 'docs-switch-basic-example',
  imports: [MlvSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class SwitchBasicExampleComponent {
  readonly checked = signal(false);
}
