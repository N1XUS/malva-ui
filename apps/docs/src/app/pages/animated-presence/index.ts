import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="animated-presence"
  />`,
})
export class AnimatedPresencePageComponent {
  examples = new Array(3).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Animated Presence',
    description:
      'Structural directive (*mlvAnimatedPresence) that plays enter/leave CSS animations on conditionally rendered content — solving the Angular limitation where @if destroys the DOM immediately, cutting off leave animations.',
  };
}
