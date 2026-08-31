import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvLoader } from '@malva-ui/core/loader';
import { MlvButton, MlvButtonBefore } from '@malva-ui/core/button';
import { LucideRefreshCw } from '@lucide/angular';

@Component({
  selector: 'docs-loader-bar-gradient-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvLoader, MlvButton, MlvButtonBefore, LucideRefreshCw],
  templateUrl: './index.html',
})
export default class LoaderBarGradientExampleComponent {
  readonly progress = signal(65);

  randomize(): void {
    this.progress.set(Math.round(Math.random() * 80) + 10);
  }
}
