import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvNumberInput } from '@malva-ui/core/number-input';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'docs-number-input-large-step-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvNumberInput, FormsModule],
  templateUrl: './index.html',
})
export default class NumberInputLargeStepExampleComponent {
  readonly timeout = signal(5000);
}
