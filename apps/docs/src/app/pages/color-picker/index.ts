import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="color-picker"
  />`,
})
export class ColorPickerPageComponent {
  examples = new Array(5).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Color Picker',
    description:
      'HEX/RGB/HSL color picker with configurable output formats, hue and opacity controls, and inline or popup variants for every Angular forms API.',
  };
}
