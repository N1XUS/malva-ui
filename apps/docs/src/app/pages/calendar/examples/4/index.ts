import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import type { MlvCalendarRangeValue } from '@malva-ui/core/calendar';
import { MlvCalendar } from '@malva-ui/core/calendar';

@Component({
  selector: 'docs-calendar-range-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCalendar],
  templateUrl: './index.html',
})
export default class CalendarRangeExampleComponent {
  readonly selectedRange = signal<MlvCalendarRangeValue | null>({
    start: new Date(2026, 2, 10),
    end: new Date(2026, 2, 15),
  });

  readonly rangeLabel = computed(() => {
    const range = this.selectedRange();
    if (!range?.start && !range?.end) {
      return 'No range selected';
    }

    const start = range.start ? range.start.toLocaleDateString() : 'None';
    const end = range.end ? range.end.toLocaleDateString() : 'None';
    return `${start} - ${end}`;
  });
}
