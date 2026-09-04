import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvScrubber } from '@malva-ui/core/scrubber';

@Component({
  selector: 'docs-scrubber-horizontal-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvScrubber],
  templateUrl: './index.html',
})
export default class ScrubberHorizontalExampleComponent {
  readonly years = Array.from({ length: 40 }, (_, index) => 2000 + index);
  readonly year = signal(2026);
}
