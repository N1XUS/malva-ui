import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvPinInput } from '@malva-ui/core/pin-input';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'docs-pin-input-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPinInput, FormsModule],
  templateUrl: './index.html',
})
export default class PinInputBasicExampleComponent {
  readonly otp = signal('');
}
