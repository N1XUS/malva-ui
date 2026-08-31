import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MlvCombobox } from '@malva-ui/core/combobox';

@Component({
  selector: 'docs-combobox-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCombobox, FormField],
  templateUrl: './index.html',
})
export default class DocsComboboxSignalFormsExampleComponent {
  readonly frameworks = ['Angular', 'React', 'Vue'];
  readonly model = signal<{ framework: string | null }>({
    framework: 'Angular',
  });
  readonly fields = form(this.model);
}
