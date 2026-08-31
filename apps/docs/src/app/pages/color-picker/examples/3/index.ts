import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvColorPickerPopup } from '@malva-ui/core/color-picker';

@Component({
  selector: 'docs-color-picker-popup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvColorPickerPopup],
  templateUrl: './index.html',
})
export default class ColorPickerPopupExampleComponent {
  readonly color = signal('#8b5cf6');
}
