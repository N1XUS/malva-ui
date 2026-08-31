import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvLoader } from '@malva-ui/core/loader';
import { MlvButton, MlvButtonBefore } from '@malva-ui/core/button';
import { LucideMinus, LucidePlus } from '@lucide/angular';

@Component({
  selector: 'docs-loader-circle-determinate-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvLoader, MlvButton, MlvButtonBefore, LucideMinus, LucidePlus],
  templateUrl: './index.html',
})
export default class LoaderCircleDeterminateExampleComponent {
  readonly progress = signal(65);

  increment(): void {
    this.progress.update((v) => Math.min(100, v + 15));
  }

  decrement(): void {
    this.progress.update((v) => Math.max(0, v - 15));
  }
}
