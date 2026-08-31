import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvButtonVariant } from '@malva-ui/core/button';
import { MlvButtonIcon } from '@malva-ui/core/button';
import { MlvButton } from '@malva-ui/core/button';
import { LucideSave } from '@lucide/angular';
import { MlvFade } from '@malva-ui/cdk';

@Component({
  selector: 'docs-button-fade-example',
  imports: [MlvButton, MlvFade, LucideSave, MlvFade, MlvButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonFadeExampleComponent {
  readonly variants: MlvButtonVariant[] = [
    'primary',
    'secondary',
    'outlined',
    'accent',
    'transparent',
  ];
}
