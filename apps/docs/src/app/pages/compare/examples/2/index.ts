import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvCompare } from '@malva-ui/core/compare';

@Component({
  selector: 'docs-compare-vertical-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCompare],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class CompareVerticalExampleComponent {
  /** Share of the surface, from the top edge, showing the underexposed frame. */
  readonly position = signal(45);

  readonly photo =
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1000&q=80';
}
