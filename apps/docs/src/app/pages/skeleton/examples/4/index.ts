import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvSkeleton } from '@malva-ui/core/skeleton';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-skeleton-animation-toggle-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSkeleton, MlvButton],
  templateUrl: './index.html',
})
export default class SkeletonAnimationToggleExampleComponent {
  /** Whether the pulse animation is active. */
  readonly animated = signal(true);

  /** Toggles the animation on/off. */
  toggleAnimation(): void {
    this.animated.update((v) => !v);
  }
}
