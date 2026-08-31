import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvPinInput } from '@malva-ui/core/pin-input';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'docs-pin-input-states-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPinInput, FormsModule],
  templateUrl: './index.html',
})
export default class PinInputStatesExampleComponent {}
