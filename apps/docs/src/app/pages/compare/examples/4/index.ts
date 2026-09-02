import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideMoveHorizontal } from '@lucide/angular';
import { MlvCompare, MlvCompareHandleDef } from '@malva-ui/core/compare';

@Component({
  selector: 'docs-compare-handle-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCompare, MlvCompareHandleDef, LucideMoveHorizontal],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class CompareHandleExampleComponent {
  readonly position = signal(50);

  readonly photo =
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=80';
}
