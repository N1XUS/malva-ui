import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvNumberInput } from '@malva-ui/core/number-input';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'docs-number-input-decimal-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvNumberInput, ReactiveFormsModule],
  templateUrl: './index.html',
})
export default class NumberInputDecimalExampleComponent {
  readonly priceCtrl = new FormControl<number>(9.99);
}
