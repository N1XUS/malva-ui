import {
  ChangeDetectionStrategy,
  Component,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { MlvFormState } from '../models/form-state';

@Component({
  selector: 'mlv-message',
  host: {
    'animate.enter': 'enter-animation',
    'animate.leave': 'leave-animation',
    class: 'mlv-message',
    '[class]': '"mlv-message--" + state()',
    '[attr.role]': "state() === 'error' ? 'alert' : null",
    '[attr.aria-live]': "state() !== 'default' ? 'polite' : null",
  },
  template: ` <ng-content /> `,
  styleUrl: './message.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MlvMessage {
  readonly state = input<MlvFormState>('default');
}
