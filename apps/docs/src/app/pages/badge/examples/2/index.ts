import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvBadge } from '@malva-ui/core/badge';

@Component({
  selector: 'docs-badge-muted-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvBadge],
  templateUrl: './index.html',
})
export default class BadgeMutedExampleComponent {}
