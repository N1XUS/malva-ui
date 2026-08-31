import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvSlider } from '@malva-ui/core/slider';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'docs-slider-vertical-range-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSlider, FormsModule],
  templateUrl: './index.html',
})
export default class SliderVerticalRangeExampleComponent {
  readonly tempRange = signal<[number, number]>([18, 24]);
  readonly humidRange = signal<[number, number]>([40, 70]);
}
