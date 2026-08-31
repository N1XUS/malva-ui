import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvTokenizer } from '@malva-ui/core/tokenizer';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';

@Component({
  selector: 'docs-tokenizer-error-state-example',
  imports: [MlvTokenizer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class TokenizerErrorStateExampleComponent {
  errorTokens = signal<MlvSelectOption<string>[]>([]);
}
