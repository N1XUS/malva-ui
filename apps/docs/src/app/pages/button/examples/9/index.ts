import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type MlvButtonVariant, MlvButtonClose } from '@malva-ui/core/button';

@Component({
  selector: 'docs-button-close-example',
  imports: [MlvButtonClose],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'docs-button-close-example' },
})
export default class ButtonCloseExampleComponent {
  /** Density values supported by the shared `mlvDensity` directive. */
  readonly densities: readonly ('tight' | 'compact' | 'comfortable')[] = [
    'tight',
    'compact',
    'comfortable',
  ];

  readonly variants: MlvButtonVariant[] = ['transparent', 'secondary'];
}
