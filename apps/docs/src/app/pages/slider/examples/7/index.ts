import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MlvSlider, MlvSliderTooltipDef } from '@malva-ui/core/slider';

@Component({
  selector: 'docs-slider-tooltip-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, FormsModule, MlvSlider, MlvSliderTooltipDef],
  templateUrl: './index.html',
})
export default class SliderTooltipExampleComponent {
  readonly volume = signal(68);
  readonly budget = signal<[number, number]>([3000, 6500]);
}
