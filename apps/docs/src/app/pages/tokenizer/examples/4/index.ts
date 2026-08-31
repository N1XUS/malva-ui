import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvTokenizer, MlvTokenTemplate } from '@malva-ui/core/tokenizer';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';

@Component({
  selector: 'docs-tokenizer-custom-template-example',
  imports: [MlvTokenizer, MlvTokenTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class TokenizerCustomTemplateExampleComponent {
  userTokens = signal<MlvSelectOption<{ email: string }>[]>([]);

  createUserToken = (value: string): MlvSelectOption<{ email: string }> => ({
    label: value,
    value: { email: value },
  });
}
