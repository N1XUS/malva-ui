import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MlvSwitch } from '@malva-ui/core/switch';

@Component({
  selector: 'docs-switch-ngmodel-example',
  imports: [MlvSwitch, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class SwitchNgmodelExampleComponent {
  modelValue = false;
}
