import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCompare } from '@malva-ui/core/compare';
import { MlvSlider } from '@malva-ui/core/slider';

@Component({
  selector: 'docs-compare-controlled-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCompare, MlvSlider, MlvButton],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class CompareControlledExampleComponent {
  /** One signal drives the surface, the slider, and the readout. */
  readonly position = signal(30);

  readonly rounded = computed(() => Math.round(this.position()));

  readonly presets = [0, 50, 100] as const;

  readonly photo =
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=80';
}
