import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="avatar-group"
  />`,
})
export class AvatarGroupPageComponent {
  examples = new Array(5).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Avatar Group',
    description:
      'Displays a horizontal stack of overlapping avatars with a configurable max count, a +N overflow chip, and a hover popup showing all members.',
  };
}
