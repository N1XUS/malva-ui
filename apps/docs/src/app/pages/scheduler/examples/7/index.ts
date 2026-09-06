import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvSelect } from '@malva-ui/core/select';
import type {
  MlvSchedulerEvent,
  MlvSchedulerRangeSelectEvent,
  MlvSchedulerSlotEvent,
} from '@malva-ui/scheduler';
import { MlvScheduler } from '@malva-ui/scheduler';

@Component({
  selector: 'docs-scheduler-selection-example',
  imports: [MlvSelect, MlvScheduler],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SchedulerSelectionExample {
  readonly density = signal<MlvDensity>('comfortable');
  readonly densityOptions: MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];
  readonly events = signal<MlvSchedulerEvent[]>([]);
  private _n = 0;

  protected onRange(range: MlvSchedulerRangeSelectEvent): void {
    this._n += 1;
    this.events.update((list) => [
      ...list,
      {
        id: `r${this._n}`,
        title: `Block ${this._n}`,
        start: range.start,
        end: range.end,
        allDay: range.allDay,
      },
    ]);
  }

  protected onSlot(slot: MlvSchedulerSlotEvent): void {
    this._n += 1;
    const end = new Date(slot.date);
    if (slot.allDay) end.setDate(end.getDate() + 1);
    else end.setMinutes(end.getMinutes() + 60);
    this.events.update((list) => [
      ...list,
      {
        id: `s${this._n}`,
        title: `Quick ${this._n}`,
        start: slot.date,
        end,
        allDay: slot.allDay,
      },
    ]);
  }
}
