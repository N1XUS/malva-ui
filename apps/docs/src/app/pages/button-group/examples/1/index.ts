import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvButton, MlvButtonGroup } from '@malva-ui/core/button';
import type { MlvButtonVariant } from '@malva-ui/core/button';

@Component({
  selector: 'docs-button-group-basic-example',
  imports: [MlvButton, MlvButtonGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonGroupBasicExampleComponent {
  readonly variants: MlvButtonVariant[] = [
    'primary',
    'secondary',
    'outlined',
    'accent',
    'transparent',
    'elevated',
    'error',
    'warning',
    'info',
  ];
}
