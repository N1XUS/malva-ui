import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvSlider } from '@malva-ui/core/slider';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'docs-slider-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSlider, FormsModule],
  templateUrl: './index.html',
})
export default class SliderBasicExampleComponent {
  readonly value = signal(40);
}
