import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page [meta]="meta" [examples]="examples" header="editor" />`,
})
export class EditorPageComponent {
  readonly meta: DocPageMeta = {
    title: 'Editor',
    description:
      'A nullable HTML, Markdown, or JSON rich-text form control powered by Tiptap, with Malva toolbars, tables, image uploads, accessible status, and literal extension replacement.',
  };

  readonly examples = new Array(14).fill(0).map((_, index) => index + 1);
}
