import {
  Component,
  ChangeDetectionStrategy,
  computed,
  signal,
} from '@angular/core';
import { MlvPinInput } from '@malva-ui/core/pin-input';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'docs-pin-input-masked-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPinInput, FormsModule],
  templateUrl: './index.html',
})
export default class PinInputMaskedExampleComponent {
  readonly pin = signal('');
  readonly confirmed = signal('');

  readonly confirmState = computed<'default' | 'success' | 'error'>(() => {
    if (this.pin().length < 4 || this.confirmed().length < 4) return 'default';
    return this.pin() === this.confirmed() ? 'success' : 'error';
  });

  readonly confirmMessage = computed(() => {
    const s = this.confirmState();
    if (s === 'success') return 'PINs match';
    if (s === 'error') return 'PINs do not match';
    return '';
  });
}
