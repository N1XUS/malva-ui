import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MlvPinInput } from '@malva-ui/core/pin-input';

@Component({
  selector: 'docs-pin-input-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPinInput, FormField],
  templateUrl: './index.html',
})
export default class DocsPinInputSignalFormsExampleComponent {
  readonly model = signal({ code: '2468' });
  readonly fields = form(this.model);
}
