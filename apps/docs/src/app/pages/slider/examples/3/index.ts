import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvSlider } from '@malva-ui/core/slider';
import { FormsModule } from '@angular/forms';

const QUALITY_LABELS = ['Low', 'Medium', 'High', 'Ultra'];

@Component({
  selector: 'docs-slider-ticks-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSlider, FormsModule],
  templateUrl: './index.html',
})
export default class SliderTicksExampleComponent {
  readonly quality = signal(2);
  readonly speed = signal(50);
  readonly qualityLabels = QUALITY_LABELS;

  get qualityLabel(): string {
    return QUALITY_LABELS[this.quality()] ?? '';
  }
}
