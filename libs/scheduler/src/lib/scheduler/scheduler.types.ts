import type { MlvTone } from '@malva-ui/cdk/utils';

/** Views shipped in phase 1. */
export type MlvSchedulerView = 'month' | 'week' | 'day';

/** One calendar event. `D` is the active `MlvDateAdapter` date type (`Date` by default). */
export interface MlvSchedulerEvent<D = Date, TData = unknown> {
  /** Stable identity; used for tracking, focus restoration and model updates. */
  id: string;
  /** Visible title and the base of the accessible name. */
  title: string;
  /** Inclusive start. Midnight of the first day when `allDay`. */
  start: D;
  /**
   * Exclusive end. `end <= start` is repaired to `start + defaultEventDuration`
   * (timed) or one day (all-day).
   */
  end: D;
  /** Time parts are ignored; the event spans `startOfDay(start)` → `startOfDay(end)` (exclusive). */
  allDay?: boolean;
  /** Semantic colour. */
  tone?: MlvTone;
  /** Any CSS colour; wins over `tone`. Painted as an inline-start bar plus a pale surface. */
  color?: string;
  /** Per-event override; the scheduler-level `editable=false` still wins. Default `true`. */
  draggable?: boolean;
  /** Per-event override; the scheduler-level `editable=false` still wins. Default `true`. */
  resizable?: boolean;
  /** Consumer payload, passed through untouched. */
  data?: TData;
}

/** The dates a move, a resize or a veto hook is asked about. */
export interface MlvSchedulerNextRange<D = Date> {
  /** Inclusive start. Midnight of the first day when `allDay`. */
  start: D;
  /** Exclusive end. Midnight of the day **after** the last one when `allDay`. */
  end: D;
  /** `true` renders the event in a lane (month grid / all-day row) instead of on the time axis. */
  allDay: boolean;
}

/** What triggered a change. */
export type MlvSchedulerChangeSource = 'pointer' | 'keyboard';

/** Payload of `eventMove` and `eventResize`. */
export interface MlvSchedulerEventChange<D = Date, TData = unknown> {
  /** The updated event — a new object with the same `id`, already written to `events`. */
  event: MlvSchedulerEvent<D, TData>;
  /** The event's dates before the change. */
  previous: MlvSchedulerNextRange<D>;
  /** Whether a pointer gesture or a keyboard shortcut produced the change. */
  source: MlvSchedulerChangeSource;
}

/** Payload of `eventClick`, `eventDoubleClick` and `eventContextMenu`. */
export interface MlvSchedulerEventInteraction<D = Date, TData = unknown> {
  /** The event the chip renders, straight out of the `events` model. */
  event: MlvSchedulerEvent<D, TData>;
  /** The chip host — anchor for consumer menus and popups. */
  element: HTMLElement;
  /** The originating DOM event. Never prevented by the scheduler. */
  nativeEvent: MouseEvent | KeyboardEvent;
}

/** Payload of `slotClick`, `slotDoubleClick` and `slotContextMenu`. */
export interface MlvSchedulerSlotEvent<D = Date> {
  /** Slot start (time grid) or the day (month grid / all-day row). */
  date: D;
  /** `true` for a month cell or an all-day cell, `false` for a time slot. */
  allDay: boolean;
  /** The cell or slot element that was activated. */
  element: HTMLElement;
  /** The originating DOM event. Never prevented by the scheduler. */
  nativeEvent: MouseEvent | KeyboardEvent;
}

/** Payload of `rangeSelect`. */
export interface MlvSchedulerRangeSelectEvent<D = Date> {
  /** Inclusive start of the first selected slot or day. */
  start: D;
  /** Exclusive: the end of the last selected slot, or midnight after the last selected day. */
  end: D;
  /** `true` when the selection ran over month cells or the all-day row. */
  allDay: boolean;
  /** Whether a pointer drag or `Shift+Arrow` + `Enter` produced the selection. */
  source: MlvSchedulerChangeSource;
}

/** Payload of `externalDrop` — a SortableJS item from another list sharing `dragGroup`. */
export interface MlvSchedulerExternalDropEvent<D = Date> {
  /** The foreign item; the scheduler never moves it out of its own list. */
  element: HTMLElement;
  /** Start of the slot or day the item was dropped on. */
  start: D;
  /** `start + defaultEventDuration` for a timed target, `start + 1 day` for an all-day target. */
  end: D;
  /** `true` when the drop landed on a month cell or the all-day row. */
  allDay: boolean;
}

/** The rendered period. */
export interface MlvSchedulerVisibleRange<D = Date> {
  /** The view the range was computed for. */
  view: MlvSchedulerView;
  /** Inclusive start of the first rendered day. */
  start: D;
  /** Exclusive: start of the day after the last rendered day. */
  end: D;
}

/** Working-hours shading for the time grid. */
export interface MlvSchedulerBusinessHours {
  /** `'HH:mm'`. */
  start: string;
  /** `'HH:mm'`; `'24:00'` allowed. */
  end: string;
  /** Weekdays (0 = Sunday). Default Monday–Friday. */
  days?: readonly number[];
}

/** Veto hook for moves and resizes. Return `false` to snap back without emitting. */
export type MlvSchedulerCanChange<D = Date, TData = unknown> = (
  event: MlvSchedulerEvent<D, TData>,
  next: MlvSchedulerNextRange<D>,
) => boolean;

/** Context handed to `*mlvSchedulerHeaderDef`. */
export interface MlvSchedulerHeaderContext<D = Date> {
  /** Bind with `let-api`. */
  $implicit: MlvSchedulerHeaderApi<D>;
}

/** Imperative surface a custom toolbar drives. */
export interface MlvSchedulerHeaderApi<D = Date> {
  /** Localized label of the rendered period, as the built-in toolbar prints it. */
  title: string;
  /** The active view. */
  view: MlvSchedulerView;
  /** The rendered period. */
  range: MlvSchedulerVisibleRange<D>;
  /** Moves the range forward by one view unit. */
  next(): void;
  /** Moves the range backward by one view unit. */
  previous(): void;
  /** Anchors the range on today. */
  today(): void;
  /** Switches the view. */
  setView(view: MlvSchedulerView): void;
}

/** Context handed to `*mlvSchedulerEventDef`. */
export interface MlvSchedulerEventContext<D = Date, TData = unknown> {
  /** Bind with `let-event`. */
  $implicit: MlvSchedulerEvent<D, TData>;
  /** The view the chip is rendered in. */
  view: MlvSchedulerView;
  /** Rendered in a lane (month grid or all-day row) rather than on the time axis. */
  allDay: boolean;
  /** The event started before this rendered segment. */
  continuesBefore: boolean;
  /** The event ends after this rendered segment. */
  continuesAfter: boolean;
}

/** Payload of `moreClick`. */
export interface MlvSchedulerMoreClickEvent<D = Date, TData = unknown> {
  /** The day whose cell overflowed. */
  date: D;
  /** Every event of that day, hidden and visible alike, in render order. */
  events: readonly MlvSchedulerEvent<D, TData>[];
}
