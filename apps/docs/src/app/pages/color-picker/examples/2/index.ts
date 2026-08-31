import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MlvColorPicker } from '@malva-ui/core/color-picker';

@Component({
  selector: 'docs-color-picker-reactive-forms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvColorPicker, ReactiveFormsModule],
  templateUrl: './index.html',
})
export default class ColorPickerReactiveFormsExampleComponent {
  readonly colorControl = new FormControl('#e74c3c');
}
