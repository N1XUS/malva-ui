import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MlvCheckbox } from '@malva-ui/core/checkbox';

@Component({
  selector: 'docs-checkbox-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCheckbox, FormField],
  templateUrl: './index.html',
})
export default class DocsCheckboxSignalFormsExampleComponent {
  readonly model = signal({ accepted: false });
  readonly fields = form(this.model);
}
