import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvAnimatedPresence } from '@malva-ui/cdk/utils';

@Component({
  selector: 'docs-animated-presence-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAnimatedPresence],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class AnimatedPresenceBasicExampleComponent {
  readonly isVisible = signal(true);

  toggle(): void {
    this.isVisible.update((v) => !v);
  }
}
