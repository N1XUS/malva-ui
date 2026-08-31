import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvTokenizer } from '@malva-ui/core/tokenizer';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';

@Component({
  selector: 'docs-tokenizer-with-label-example',
  imports: [MlvTokenizer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class TokenizerWithLabelExampleComponent {
  tokens = signal<MlvSelectOption<string>[]>([
    { label: 'Angular', value: 'angular' },
    { label: 'React', value: 'react' },
    { label: 'Vue', value: 'vue' },
    { label: 'Svelte', value: 'svelte' },
  ]);
}
