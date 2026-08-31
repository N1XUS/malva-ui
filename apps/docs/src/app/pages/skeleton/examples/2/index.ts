import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvSkeleton } from '@malva-ui/core/skeleton';

@Component({
  selector: 'docs-skeleton-dimensions-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSkeleton],
  templateUrl: './index.html',
})
export default class SkeletonDimensionsExampleComponent {}
