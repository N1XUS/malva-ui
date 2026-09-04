import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvScrubber } from '@malva-ui/core/scrubber';

@Component({
  selector: 'docs-scrubber-vertical-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvScrubber],
  templateUrl: './index.html',
})
export default class ScrubberVerticalExampleComponent {
  readonly hours = Array.from({ length: 24 }, (_, index) => index);
  readonly hour = signal(9);

  /** Zero-padded two-digit numeral — a consumer's format, not the strip's. */
  readonly twoDigits = (value: number): string =>
    String(value).padStart(2, '0');
}
