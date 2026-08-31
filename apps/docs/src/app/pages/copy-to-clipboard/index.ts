import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="copy-to-clipboard"
  />`,
})
export class CopyToClipboardPageComponent {
  examples = new Array(5).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Copy to Clipboard',
    description:
      'Invisible-chrome inline component <mlv-copy-to-clipboard> that wraps projected text and copies it on click, Enter, or Space. Reveals a subtle hover tint and a small copy icon that morphs into a check on success, with an aria-live confirmation region and a (copied) output.',
  };
}
