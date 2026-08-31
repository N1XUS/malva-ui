import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvSkeleton } from '@malva-ui/core/skeleton';

@Component({
  selector: 'docs-skeleton-card-layout-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSkeleton],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SkeletonCardLayoutExampleComponent {}
