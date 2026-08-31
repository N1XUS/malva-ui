import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvColorPicker } from '@malva-ui/core/color-picker';

@Component({
  selector: 'docs-color-picker-input-modes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvColorPicker],
  templateUrl: './index.html',
})
export default class ColorPickerInputModesExampleComponent {
  readonly allFormatsColor = signal('#22c55e');
  readonly rgbColor = signal('#22c55e');
  readonly orderedColor = signal('#22c55e');
}
