import {
  InjectionToken,
  type Signal,
  type TemplateRef,
  type WritableSignal,
} from '@angular/core';
import type { MlvDateAdapter } from '@malva-ui/core/date';
import type { MlvSchedulerI18n } from '@malva-ui/i18n';
import type { MlvSchedulerNormalizedEvent } from '../layout/scheduler-layout';
import type {
  MlvSchedulerBusinessHours,
  MlvSchedulerChangeSource,
  MlvSchedulerEventContext,
  MlvSchedulerEventInteraction,
  MlvSchedulerExternalDropEvent,
  MlvSchedulerMoreClickEvent,
  MlvSchedulerNextRange,
  MlvSchedulerRangeSelectEvent,
  MlvSchedulerSlotEvent,
  MlvSchedulerView,
  MlvSchedulerVisibleRange,
} from './scheduler.types';

/** What a view should focus after its next render. */
export type MlvSchedulerFocusRequest<D = Date> =
  | {
      readonly kind: 'event';
      readonly id: string;
      /**
       * Visible-day index of the segment to focus once the change has
       * rendered. A multi-day event renders one chip per day, all carrying the
       * same `data-event-id`, so without this the restore always lands on the
       * event's first chip and a keyboard move made from a later segment
       * teleports focus to another day (or another month row). `undefined` —
       * or an index no chip claims any more — falls back to that first chip.
       */
      readonly dayIndex?: number;
    }
  | {
      readonly kind: 'cell';
      readonly date: D;
      readonly minutes: number | null;
    };

/** A `scrollToTime()` call waiting for the time grid. */
export interface MlvSchedulerScrollRequest {
  readonly time: string;
  /** Monotonic, so two requests for the same time both apply. */
  readonly sequence: number;
}

/** Pointer-interaction kinds shared by chips and slots. */
export type MlvSchedulerInteractionKind = 'click' | 'dblclick' | 'contextmenu';

/**
 * Everything the internal views, chips and the drag service read from the
 * root. Implemented by `MlvScheduler`; never imported by consumers.
 */
export interface MlvSchedulerContext<D = Date, TData = unknown> {
  readonly adapter: MlvDateAdapter<D>;
  readonly i18n: Signal<MlvSchedulerI18n>;
  readonly view: Signal<MlvSchedulerView>;
  readonly date: Signal<D>;
  readonly range: Signal<MlvSchedulerVisibleRange<D>>;
  /** Visible days after `hiddenDays`. */
  readonly days: Signal<readonly D[]>;
  /** Days per month row. */
  readonly rowLength: Signal<number>;
  readonly hiddenDays: Signal<readonly number[]>;
  readonly today: Signal<D>;
  /** Wall-clock minutes of day, refreshed every minute while `showCurrentTime`. */
  readonly nowMinutes: Signal<number>;
  readonly normalizedEvents: Signal<
    readonly MlvSchedulerNormalizedEvent<D, TData>[]
  >;
  readonly minMinutes: Signal<number>;
  readonly maxMinutes: Signal<number>;
  readonly slotDuration: Signal<number>;
  /** Effective snap in minutes (`snapDuration` input or `slotDuration`). */
  readonly snap: Signal<number>;
  readonly defaultEventDuration: Signal<number>;
  readonly businessHours: Signal<MlvSchedulerBusinessHours | null>;
  readonly editable: Signal<boolean>;
  readonly selectable: Signal<boolean>;
  readonly showCurrentTime: Signal<boolean>;
  /** `true` centres the current wall-clock minute on the time grid's initial scroll. */
  readonly scrollToCurrentTime: Signal<boolean>;
  readonly dragGroup: Signal<string>;
  readonly eventDef: Signal<TemplateRef<
    MlvSchedulerEventContext<D, TData>
  > | null>;
  /** `id` of the visually hidden keyboard hint chips reference via `aria-describedby`. */
  readonly dragHintId: string;
  readonly pendingFocus: WritableSignal<MlvSchedulerFocusRequest<D> | null>;
  readonly scrollRequest: Signal<MlvSchedulerScrollRequest | null>;
  /** `true` while a SortableJS drag owns the pointer. */
  readonly dragging: Signal<boolean>;

  translate(
    key: keyof MlvSchedulerI18n,
    params?: Record<string, string | number | boolean | Date>,
  ): string;
  /** Localized time of day, e.g. "9:30 AM". */
  formatTime(date: D): string;
  /** Localized date + time, for cross-day ranges. */
  formatDateTime(date: D): string;
  goTo(date: D): void;
  next(): void;
  previous(): void;
  /** Polite live-region announcement; repeats are spoken (see `MlvScheduler.announce`). */
  announce(message: string): void;

  emitEventInteraction(
    kind: MlvSchedulerInteractionKind,
    payload: MlvSchedulerEventInteraction<D, TData>,
  ): void;
  emitSlotInteraction(
    kind: MlvSchedulerInteractionKind,
    payload: MlvSchedulerSlotEvent<D>,
  ): void;
  emitRangeSelect(payload: MlvSchedulerRangeSelectEvent<D>): void;
  emitMoreClick(payload: MlvSchedulerMoreClickEvent<D, TData>): void;
  emitExternalDrop(payload: MlvSchedulerExternalDropEvent<D>): void;
  /**
   * Applies a move or resize: runs `canMove` / `canResize`, writes a new
   * `events` array, emits `eventMove` / `eventResize`, announces. Returns
   * `false` (nothing written, rejection announced) when vetoed or when the
   * event is no longer in the model.
   */
  commitChange(
    kind: 'move' | 'resize',
    normalized: MlvSchedulerNormalizedEvent<D, TData>,
    next: MlvSchedulerNextRange<D>,
    source: MlvSchedulerChangeSource,
  ): boolean;
  /** Called by the drag service after a drop so the trailing `click` on the chip is ignored. */
  suppressNextClick(): void;
  /** Consumed by chips: `true` once, and only within 300 ms of `suppressNextClick()`. */
  claimSuppressedClick(): boolean;
  /** Drag service → root: mirrors `dragging`. */
  setDragging(dragging: boolean): void;
}

export const MLV_SCHEDULER_CONTEXT = new InjectionToken<MlvSchedulerContext>(
  'MLV_SCHEDULER_CONTEXT',
);
