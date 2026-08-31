import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvNumberInput } from '@malva-ui/core/number-input';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'docs-number-input-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvNumberInput, FormsModule],
  templateUrl: './index.html',
})
export default class NumberInputBasicExampleComponent {
  readonly quantity = signal(1);
}
