import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="editor-collaboration"
  />`,
})
export class EditorCollaborationPageComponent {
  readonly meta: DocPageMeta = {
    title: 'Collaboration',
    description:
      'Real-time collaboration for the editor from @malva-ui/editor/collaboration: a shared Yjs document over a transport the host supplies, presence with named remote carets, offline editing and a connection status that is announced to assistive technology.',
  };

  readonly examples = new Array(2).fill(0).map((_, index) => index + 1);
}
