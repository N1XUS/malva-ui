import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvCalendar } from '@malva-ui/core/calendar';

@Component({
  selector: 'docs-calendar-basic-example',
  imports: [MlvCalendar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class CalendarBasicExampleComponent {}
