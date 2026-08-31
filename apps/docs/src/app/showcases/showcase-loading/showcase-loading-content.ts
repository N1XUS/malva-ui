import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvSkeleton } from '@malva-ui/core/skeleton';

/** Shared structural loading landmark for initial and nested showcase lazy routes. */
@Component({
  selector: 'docs-showcase-loading-content',
  imports: [MlvSkeleton],
  templateUrl: './showcase-loading-content.html',
  styleUrl: './showcase-loading-content.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowcaseLoadingContentComponent {}
