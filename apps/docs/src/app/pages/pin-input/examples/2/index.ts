import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvPinInput } from '@malva-ui/core/pin-input';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'docs-pin-input-length-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPinInput, FormsModule],
  templateUrl: './index.html',
})
export default class PinInputLengthExampleComponent {
  readonly pin4 = signal('');
  readonly pin6 = signal('');
  readonly pin8 = signal('');
}
