import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MlvCompare } from '@malva-ui/core/compare';

@Component({
  selector: 'docs-compare-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCompare],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class CompareBasicExampleComponent {
  /** Share of the surface, from the start edge, showing the ungraded scan. */
  readonly position = signal(55);

  readonly rounded = computed(() => Math.round(this.position()));

  readonly photo =
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=80';
}
