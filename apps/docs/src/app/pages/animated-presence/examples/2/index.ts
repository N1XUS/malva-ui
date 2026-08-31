import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvAnimatedPresence } from '@malva-ui/cdk/utils';

/**
 * Example using custom animation classes — popup-style enter/leave
 * from `@malva-ui/styles` animations.
 */
@Component({
  selector: 'docs-animated-presence-custom-anim-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAnimatedPresence],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class AnimatedPresenceCustomAnimExampleComponent {
  readonly isOpen = signal(false);

  toggle(): void {
    this.isOpen.update((v) => !v);
  }
}
