import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page [meta]="meta" [examples]="examples" header="chat" />`,
})
export class ChatPageComponent {
  examples = new Array(5).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Chat',
    description:
      'Data-driven chat surface. Renders an oldest-to-newest message array as author groups with date separators, delivery ticks, embedded reply quotes, an image/gif/video grid, audio playback, a typing indicator, loading skeletons, and reverse infinite pagination.',
  };
}
