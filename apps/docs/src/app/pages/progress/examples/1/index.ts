import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvProgress } from '@malva-ui/core/progress';
import { MlvButton, MlvButtonBefore } from '@malva-ui/core/button';
import { LucideMinus, LucidePlus } from '@lucide/angular';

@Component({
  selector: 'docs-progress-bar-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvProgress, MlvButton, MlvButtonBefore, LucideMinus, LucidePlus],
  templateUrl: './index.html',
})
export default class ProgressBarBasicExampleComponent {
  readonly value = signal(40);

  increment(): void {
    this.value.update((v) => Math.min(100, v + 10));
  }

  decrement(): void {
    this.value.update((v) => Math.max(0, v - 10));
  }
}
