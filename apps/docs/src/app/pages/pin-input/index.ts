import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="pin-input"
  />`,
})
export class PinInputPageComponent {
  examples = new Array(7).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'PIN Input',
    description:
      'A row of single-character input cells that behave as one logical Angular form control — for OTP codes, PINs, and short verification sequences.',
  };
}
