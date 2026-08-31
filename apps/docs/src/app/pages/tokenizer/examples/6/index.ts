import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { MlvTokenizer } from '@malva-ui/core/tokenizer';

@Component({
  selector: 'docs-tokenizer-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTokenizer, FormField],
  templateUrl: './index.html',
})
export default class DocsTokenizerSignalFormsExampleComponent {
  readonly model = signal<{ tokens: MlvSelectOption<string>[] }>({
    tokens: [{ label: 'Angular', value: 'angular' }],
  });
  readonly fields = form(this.model);
}
