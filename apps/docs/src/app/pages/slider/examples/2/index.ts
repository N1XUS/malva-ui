import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvSlider } from '@malva-ui/core/slider';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'docs-slider-range-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSlider, FormsModule],
  templateUrl: './index.html',
})
export default class SliderRangeExampleComponent {
  readonly priceRange = signal<[number, number]>([200, 800]);
  readonly yearRange = signal<[number, number]>([2010, 2022]);
}
