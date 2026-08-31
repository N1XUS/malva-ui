import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MlvSelect } from '@malva-ui/core/select';

@Component({
  selector: 'docs-select-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSelect, FormField],
  templateUrl: './index.html',
})
export default class DocsSelectSignalFormsExampleComponent {
  readonly countries = ['Romania', 'Germany', 'Japan'];
  readonly model = signal<{ country: string | null }>({ country: 'Romania' });
  readonly fields = form(this.model);
}
