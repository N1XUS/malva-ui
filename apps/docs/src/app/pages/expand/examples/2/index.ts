import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvExpand } from '@malva-ui/core/expand';
import { MlvButton } from '@malva-ui/core/button';
import { MlvBadge } from '@malva-ui/core/badge';

@Component({
  selector: 'docs-expand-controlled-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvExpand, MlvButton, MlvBadge],
  templateUrl: './index.html',
})
export default class ExpandControlledExampleComponent {
  readonly isOpen = signal(false);
}
