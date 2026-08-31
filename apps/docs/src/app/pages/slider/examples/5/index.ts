import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvSlider } from '@malva-ui/core/slider';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'docs-slider-vertical-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSlider, FormsModule],
  templateUrl: './index.html',
})
export default class SliderVerticalExampleComponent {
  readonly bass = signal(70);
  readonly mid = signal(55);
  readonly treble = signal(40);
  readonly volume = signal(80);

  readonly channels = [
    { label: 'Bass', value: this.bass },
    { label: 'Mid', value: this.mid },
    { label: 'Treble', value: this.treble },
    { label: 'Volume', value: this.volume },
  ];
}
