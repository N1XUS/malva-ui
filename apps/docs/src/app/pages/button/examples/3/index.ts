import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvButtonVariant } from '@malva-ui/core/button';
import { MlvButtonIcon } from '@malva-ui/core/button';
import { MlvButton } from '@malva-ui/core/button';
import { LucidePlus } from '@lucide/angular';

@Component({
  selector: 'docs-button-shapes-example',
  imports: [MlvButton, LucidePlus, MlvButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonShapesExampleComponent {
  readonly variants: MlvButtonVariant[] = [
    'primary',
    'secondary',
    'outlined',
    'accent',
    'transparent',
    'error',
    'warning',
    'info',
    'elevated',
  ];
}
