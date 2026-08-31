import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvLink } from '@malva-ui/core/link';

@Component({
  selector: 'docs-link-variants-example',
  imports: [MlvLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class LinkVariantsExampleComponent {}
