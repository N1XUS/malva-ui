import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="status-indicator"
  />`,
})
export class StatusIndicatorPageComponent {
  examples = new Array(3).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Status Indicator',
    description:
      'Small circular status dot for presence, health, or state. Shares the badge/chip semantic tone vocabulary, supports an optional infinite ripple pulse (respecting prefers-reduced-motion), and is decorative by default with an opt-in accessible name.',
  };
}
