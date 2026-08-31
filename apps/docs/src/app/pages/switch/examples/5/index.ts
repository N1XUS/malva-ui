import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MlvSwitch } from '@malva-ui/core/switch';

@Component({
  selector: 'docs-switch-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSwitch, FormField],
  templateUrl: './index.html',
})
export default class DocsSwitchSignalFormsExampleComponent {
  readonly model = signal({ notifications: true });
  readonly fields = form(this.model);
}
