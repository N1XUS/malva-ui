import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvCompare } from '@malva-ui/core/compare';

@Component({
  selector: 'docs-compare-hover-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCompare],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class CompareHoverExampleComponent {
  /**
   * Starts fully blurred (0% of the sharp start layer). Sweeping the pointer
   * across pulls focus from the start edge up to the pointer.
   */
  readonly position = signal(0);

  readonly photo =
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=80';
}
