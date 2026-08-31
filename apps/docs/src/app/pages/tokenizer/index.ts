import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="tokenizer"
  />`,
})
export class TokenizerPageComponent {
  exampleArray = new Array(6).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Tokenizer',
    description:
      'A token input component for managing lists of tags, emails, or other values with support for custom templates and validation.',
  };
}
