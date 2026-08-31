import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MlvNumberInput } from '@malva-ui/core/number-input';

@Component({
  selector: 'docs-number-input-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvNumberInput, FormField],
  templateUrl: './index.html',
})
export default class DocsNumberInputSignalFormsExampleComponent {
  readonly model = signal<{ quantity: number | null }>({ quantity: 2 });
  readonly fields = form(this.model);
}
