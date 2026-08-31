import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvLoader } from '@malva-ui/core/loader';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-loader-circle-gradient-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvLoader, MlvButton],
  templateUrl: './index.html',
})
export default class LoaderCircleGradientExampleComponent {
  readonly progress = signal(70);

  updateValue(): void {
    this.progress.update((v) => (v === 70 ? 30 : 70));
  }
}
