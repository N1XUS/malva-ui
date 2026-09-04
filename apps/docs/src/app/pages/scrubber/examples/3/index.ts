import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvScrubber } from '@malva-ui/core/scrubber';

interface Month {
  readonly index: number;
  readonly name: string;
}

const MONTHS: readonly Month[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((name, index) => ({ index, name }));

@Component({
  selector: 'docs-scrubber-direction-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton, MlvScrubber],
  templateUrl: './index.html',
})
export default class ScrubberDirectionExampleComponent {
  readonly months = MONTHS;
  readonly month = signal<Month>(MONTHS[2]);
  readonly direction = signal<'ltr' | 'rtl'>('ltr');

  /** Any item type works; `displayWith` supplies the visible text. */
  readonly monthName = (value: Month): string => value.name;

  toggleDirection(): void {
    this.direction.update((current) => (current === 'ltr' ? 'rtl' : 'ltr'));
  }
}
