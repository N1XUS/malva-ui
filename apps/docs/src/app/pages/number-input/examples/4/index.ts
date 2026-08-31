import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvNumberInput } from '@malva-ui/core/number-input';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'docs-number-input-disabled-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvNumberInput, FormsModule],
  templateUrl: './index.html',
})
export default class NumberInputDisabledExampleComponent {}
