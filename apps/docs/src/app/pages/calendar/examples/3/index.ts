import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MlvCalendar } from '@malva-ui/core/calendar';

@Component({
  selector: 'docs-calendar-restricted-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCalendar],
  templateUrl: './index.html',
})
export default class CalendarRestrictedExampleComponent {
  readonly minDate = new Date(2026, 2, 5);
  readonly maxDate = new Date(2026, 2, 24);
  readonly selectedDate = signal<Date | null>(new Date(2026, 2, 12));

  readonly selectedLabel = computed(() => {
    const date = this.selectedDate();
    return date ? date.toLocaleDateString() : 'None';
  });
}
