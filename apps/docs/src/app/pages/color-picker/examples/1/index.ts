import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvColorPicker } from '@malva-ui/core/color-picker';

@Component({
  selector: 'docs-color-picker-basic',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvColorPicker],
  templateUrl: './index.html',
})
export default class ColorPickerBasicExampleComponent {
  readonly color = signal('#3b82f6');
}
