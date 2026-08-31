import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MlvNumberInput } from '@malva-ui/core/number-input';

@Component({
  selector: 'docs-number-input-stacked-controls-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvNumberInput, FormsModule],
  templateUrl: './index.html',
})
export default class NumberInputStackedControlsExampleComponent {
  readonly leftAligned = signal(12);
  readonly rightAligned = signal(24);
}
