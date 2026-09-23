import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MlvLink } from '@malva-ui/core/link';

@Component({
  selector: 'docs-link-variants-example',
  imports: [MlvLink, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class LinkVariantsExampleComponent {}
