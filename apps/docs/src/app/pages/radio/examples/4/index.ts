import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MlvRadio, MlvRadioGroup } from '@malva-ui/core/radio';

@Component({
  selector: 'docs-radio-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvRadioGroup, MlvRadio, FormField],
  templateUrl: './index.html',
})
export default class DocsRadioSignalFormsExampleComponent {
  readonly model = signal({ plan: 'pro' });
  readonly fields = form(this.model);
}
