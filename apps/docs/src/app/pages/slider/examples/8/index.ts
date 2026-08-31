import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MlvSlider } from '@malva-ui/core/slider';

@Component({
  selector: 'docs-slider-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSlider, FormField],
  templateUrl: './index.html',
})
export default class DocsSliderSignalFormsExampleComponent {
  readonly model = signal({ volume: 40 });
  readonly fields = form(this.model);
}
