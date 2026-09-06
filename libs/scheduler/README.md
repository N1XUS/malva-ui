# @malva-ui/scheduler

Calendar scheduler for [Malva UI](https://www.npmjs.com/package/@malva-ui/core) — month, week and day views with timed, all-day and multi-day events you can drag, resize and select, on top of a fully controlled event model.

Ships as its own package: it peer-depends on `@malva-ui/core` (the `@malva-ui/core/date` adapter, button, segmented, popup, scrollbar) and carries SortableJS for pointer drag.

## Install

```bash
npm install @malva-ui/scheduler
```

## Quick start

```ts
import { MlvScheduler, type MlvSchedulerEvent } from '@malva-ui/scheduler';

@Component({ imports: [MlvScheduler] })
export class Agenda {
  readonly events = signal<MlvSchedulerEvent[]>([
    { id: '1', title: 'Standup', start: new Date(2026, 8, 2, 9, 0), end: new Date(2026, 8, 2, 9, 30), tone: 'info' },
    { id: '2', title: 'Offsite', start: new Date(2026, 8, 3), end: new Date(2026, 8, 5), allDay: true },
  ]);
}
```

```html
<mlv-scheduler [(events)]="events" view="week" (eventMove)="save($event)" (eventResize)="save($event)" (slotClick)="create($event)" />
```

The scheduler writes the moved/resized event back into `events` and emits `eventMove` / `eventResize`; veto with `[canMove]` / `[canResize]`. Every date is a `D` from the active `MlvDateAdapter` (`@malva-ui/core/date`) — plain `Date` by default.

| Model / output                                               | Payload                            |
| ------------------------------------------------------------ | ---------------------------------- |
| `[(events)]`                                                 | `readonly MlvSchedulerEvent<D>[]`  |
| `[(view)]`                                                   | `'month' \| 'week' \| 'day'`       |
| `[(date)]`                                                   | anchor date `D`                    |
| `(eventMove)` / `(eventResize)`                              | `MlvSchedulerEventChange<D>`       |
| `(eventClick)` / `(eventDoubleClick)` / `(eventContextMenu)` | `MlvSchedulerEventInteraction<D>`  |
| `(slotClick)` / `(slotDoubleClick)` / `(slotContextMenu)`    | `MlvSchedulerSlotEvent<D>`         |
| `(rangeSelect)`                                              | `MlvSchedulerRangeSelectEvent<D>`  |
| `(externalDrop)`                                             | `MlvSchedulerExternalDropEvent<D>` |
| `(visibleRangeChange)`                                       | `MlvSchedulerVisibleRange<D>`      |

Docs: https://github.com/N1XUS/malva-ui/tree/main/libs/scheduler#readme

## License

MIT
