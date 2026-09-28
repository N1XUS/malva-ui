import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvTimePicker } from '@malva-ui/core/time-picker';

@Component({
  selector: 'docs-time-picker-empty-value-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTimePicker],
  templateUrl: './index.html',
})
export default class DocsTimePickerEmptyValueExampleComponent {
  readonly reminder = signal('');
  readonly arrival = signal('');
}
