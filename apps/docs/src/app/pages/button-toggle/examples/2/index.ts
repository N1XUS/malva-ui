import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvButtonGroup, MlvButtonToggle } from '@malva-ui/core/button';
import type { MlvButtonVariant } from '@malva-ui/core/button';

@Component({
  selector: 'docs-button-toggle-group-example',
  imports: [MlvButtonGroup, MlvButtonToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonToggleGroupExampleComponent {
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
