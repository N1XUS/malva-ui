import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="editor-ai"
  />`,
})
export class EditorAiPageComponent {
  readonly meta: DocPageMeta = {
    title: 'AI Kit',
    description:
      'The AI toolkit for the editor from @malva-ui/editor/ai: a bring-your-own-backend provider contract, streaming selection transforms with stop and undo semantics, and reviewable tracked suggestions with save gating.',
  };

  readonly examples = new Array(2).fill(0).map((_, index) => index + 1);
}
