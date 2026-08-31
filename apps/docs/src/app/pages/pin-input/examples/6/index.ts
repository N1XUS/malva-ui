import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvPinInput, MlvPinInputSeparator } from '@malva-ui/core/pin-input';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'docs-pin-input-separators-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPinInput, MlvPinInputSeparator, FormsModule],
  templateUrl: './index.html',
})
export default class PinInputSeparatorsExampleComponent {
  readonly codeEach = signal('');
  readonly codeGrouped = signal('');
  readonly codeCustom = signal('');
}
