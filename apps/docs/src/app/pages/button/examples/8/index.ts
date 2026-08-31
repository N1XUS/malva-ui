import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton, type MlvButtonVariant } from '@malva-ui/core/button';
import { MlvSwitch } from '@malva-ui/core/switch';

@Component({
  selector: 'docs-button-loading-example',
  imports: [MlvButton, MlvSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
  host: { class: 'docs-button-loading-example' },
})
export default class ButtonLoadingExampleComponent {
  /** Controls the loading presentation shown by the example button. */
  readonly loading = signal(false);

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
