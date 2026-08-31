import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import {
  MlvColorPicker,
  MlvColorPickerPopup,
} from '@malva-ui/core/color-picker';

@Component({
  selector: 'docs-color-picker-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvColorPicker, MlvColorPickerPopup, FormField],
  templateUrl: './index.html',
})
export default class DocsColorPickerSignalFormsExampleComponent {
  readonly model = signal({ inline: '#7c3aed', popup: '#0ea5e9' });
  readonly fields = form(this.model);
}
