import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import type { Signal } from '@angular/core';
import {
  DestroyRef,
  inject,
  Injectable,
  NgZone,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import Sortable from 'sortablejs';
import type {
  MlvSchedulerDropTarget,
  MlvSchedulerNextRange,
  MlvSchedulerNormalizedEvent,
} from '../layout/scheduler-layout';
import { resolveMove } from '../layout/scheduler-layout';
import { minutesFromOffset } from '../layout/scheduler-time';
import type { MlvSchedulerContext } from '../scheduler/scheduler-context';
import type { MlvSchedulerExternalDropEvent } from '../scheduler/scheduler.types';

/** What a drop list represents. */
export type MlvSchedulerDropListKind =
  | 'month-cell'
  | 'all-day-cell'
  | 'time-column';

/** Registration handed to `MlvSchedulerDragService.register()`. */
export interface MlvSchedulerDropListRegistration {
  readonly kind: MlvSchedulerDropListKind;
  readonly dayIndex: Signal<number>;
}

/** The pending result of a pointer drag, rendered as a ghost chip by the views. */
export interface MlvSchedulerDragPreview<D = Date> {
  readonly eventId: string;
  readonly next: MlvSchedulerNextRange<D>;
}

/** Screen position of a pointer. */
export interface MlvSchedulerPointerPosition {
  readonly x: number;
  readonly y: number;
}

/** Suffix that turns an event id into its drag-preview id (a NUL never appears in a consumer id). */
const GHOST_SUFFIX = '__mlv-ghost';

/**
 * Id of the ghost chip rendered for `id` while it is dragged. Plain ASCII, so
 * `[data-event-id="…"]` selects it directly — a NUL or other control character
 * would be rewritten to U+FFFD by CSS tokenization and never match.
 */
export function ghostIdFor(id: string): string {
  return `${id}${GHOST_SUFFIX}`;
}

/** BEM classes SortableJS toggles on the dragged chip and its fallback clone. */
export const MLV_SCHEDULER_SORTABLE_CLASSES = {
  chosen: 'mlv-scheduler-event--chosen',
  ghost: 'mlv-scheduler-event--dragging',
  drag: 'mlv-scheduler-event--drag',
  fallback: 'mlv-scheduler-event--fallback',
} as const;

interface ListEntry {
  readonly registration: MlvSchedulerDropListRegistration;
  readonly sortable: Sortable | null;
}

interface ActiveDrag<D, TData> {
  readonly item: HTMLElement;
  readonly from: HTMLElement;
  readonly nextSibling: Node | null;
  readonly normalized: MlvSchedulerNormalizedEvent<D, TData>;
  /** Days between the bar's first day and the day the pointer grabbed it on. */
  readonly grabDayOffset: number;
  readonly originalStyle: string | null;
  readonly teardown: () => void;
  cancelled: boolean;
}

/**
 * Pointer drag engine of one `mlv-scheduler` instance. Owns a SortableJS instance per registered drop list,
 * computes the drop target while dragging, exposes it as a `preview` signal and commits through the context.
 *
 * SortableJS never moves our own chips in the DOM: `onMove` always returns `false`. Angular re-renders from the
 * model after the commit.
 */
@Injectable()
export class MlvSchedulerDragService<D = Date, TData = unknown> {
  /** @private The scheduler this engine works for. Set through `attach()`. */
  private _ctx!: MlvSchedulerContext<D, TData>;

  /** @private Registered lists and their SortableJS instances. */
  private readonly _lists = new Map<HTMLElement, ListEntry>();

  /** @private Pending drop, or `null` when nothing is dragged or the pointer is outside every list. */
  private readonly _preview = signal<MlvSchedulerDragPreview<D> | null>(null);

  /** The pending drop of the current drag; views render it as a ghost chip. */
  readonly preview = this._preview.asReadonly();

  /** @private State of the drag started from one of our chips. */
  private _active: ActiveDrag<D, TData> | null = null;

  /** @private Last pointer position seen on a list or on the document during a drag. */
  private _lastPointer: MlvSchedulerPointerPosition | null = null;

  /** @private Teardown of the document listeners tracking a foreign drag. */
  private _foreignTeardown: (() => void) | null = null;

  /** @private Runs SortableJS and the document listeners outside change detection. */
  private readonly _zone = inject(NgZone);

  /** @private Mirrors the grab offset in RTL. */
  private readonly _rtl = inject(MlvRtlService);

  /** @private SortableJS touches the DOM; it is only created in the browser. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** @private Document the drag listeners are attached to. */
  private readonly _document = inject(DOCUMENT);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const element of [...this._lists.keys()]) this.unregister(element);
      this._active?.teardown();
      this._active = null;
      this._foreignTeardown?.();
    });
  }

  /** Binds the engine to its scheduler. Called once by `MlvScheduler`. */
  attach(ctx: MlvSchedulerContext<D, TData>): void {
    this._ctx = ctx;
  }

  /** Registers a drop list and creates its SortableJS instance (browser only). */
  register(
    element: HTMLElement,
    registration: MlvSchedulerDropListRegistration,
  ): void {
    this.unregister(element);
    element.setAttribute('data-mlv-scheduler-list', '');
    const sortable = this._isBrowser
      ? this._zone.runOutsideAngular(() =>
          Sortable.create(element, this._options()),
        )
      : null;
    this._lists.set(element, { registration, sortable });
    if (this._isBrowser) {
      element.addEventListener('pointerdown', this._onListPointerDown, {
        capture: true,
        passive: true,
      });
    }
  }

  /** Destroys the list's SortableJS instance and forgets it. */
  unregister(element: HTMLElement): void {
    const entry = this._lists.get(element);
    if (!entry) return;
    entry.sortable?.destroy();
    element.removeEventListener('pointerdown', this._onListPointerDown, {
      capture: true,
    });
    element.removeAttribute('data-mlv-scheduler-list');
    this._lists.delete(element);
  }

  /** The SortableJS instance of a registered list, or `null`. Exposed for specs and debugging. */
  sortableFor(element: HTMLElement): Sortable | null {
    return this._lists.get(element)?.sortable ?? null;
  }

  /**
   * The events a view should render: the model plus one ghost copy of the dragged event at its previewed
   * position. The source chip stays in the list so SortableJS keeps a valid `dragged` element.
   */
  withPreview(
    events: readonly MlvSchedulerNormalizedEvent<D, TData>[],
  ): readonly MlvSchedulerNormalizedEvent<D, TData>[] {
    const preview = this._preview();
    if (!preview) return events;
    const source = events.find((n) => n.event.id === preview.eventId);
    if (!source) return events;
    return [
      ...events,
      {
        event: { ...source.event, id: ghostIdFor(source.event.id) },
        start: preview.next.start,
        end: preview.next.end,
        allDay: preview.next.allDay,
        ghost: true,
      },
    ];
  }

  /** Cancels the current drag: the drop will not commit. Bound to Escape. */
  cancel(): void {
    if (!this._active) return;
    this._active.cancelled = true;
    this._setPreview(null);
  }

  /**
   * @internal SortableJS `onStart` for our own chips. `pointer` is where the drag began (used for the grab
   * offset of multi-day bars).
   */
  handleStart(
    evt: Sortable.SortableEvent,
    pointer: MlvSchedulerPointerPosition | null,
  ): void {
    const id = evt.item.getAttribute('data-event-id');
    const normalized =
      id === null
        ? undefined
        : this._ctx.normalizedEvents().find((n) => n.event.id === id);
    if (!normalized) return;
    const ghost = Sortable.ghost;
    if (ghost && ghost !== evt.item) sanitizeClone(ghost);

    const entry = this._lists.get(evt.from);
    let grabDayOffset = 0;
    if (entry && entry.registration.kind !== 'time-column' && pointer) {
      const rect = evt.item.getBoundingClientRect();
      const span = Math.max(
        1,
        Number(evt.item.style.getPropertyValue('--mlv-scheduler-span')) || 1,
      );
      const cellWidth = rect.width / span;
      // physical → logical once: 0 sits at the inline-start edge of the bar
      const offset =
        this._rtl.resolveDirection(evt.item) === 'rtl'
          ? rect.right - pointer.x
          : pointer.x - rect.left;
      grabDayOffset =
        cellWidth > 0
          ? Math.min(span - 1, Math.max(0, Math.floor(offset / cellWidth)))
          : 0;
    }

    this._lastPointer = pointer;
    this._active = {
      item: evt.item,
      from: evt.from,
      nextSibling: evt.item.nextSibling,
      normalized,
      grabDayOffset,
      originalStyle: evt.item.getAttribute('style'),
      teardown: this._listenDuringDrag(),
      cancelled: false,
    };
    this._zone.run(() => this._ctx.setDragging(true));
  }

  /**
   * @internal SortableJS `onMove`. Computes the drop target under the pointer and updates the preview.
   * Always returns `false` so SortableJS leaves the DOM alone.
   */
  handleMove(evt: Sortable.MoveEvent, originalEvent: Event): false {
    const active = this._active;
    if (!active || active.cancelled) return false;
    const pointer = pointerOf(originalEvent) ?? this._lastPointer;
    if (!pointer) return false;
    this._lastPointer = pointer;
    const target = this.resolveTarget(
      evt.to,
      pointer,
      active.grabDayOffset,
      true,
    );
    if (!target) {
      this._setPreview(null);
      return false;
    }
    const next = resolveMove(
      this._ctx.adapter,
      active.normalized,
      target,
      this._ctx.days(),
      this._ctx.defaultEventDuration(),
    );
    this._setPreview({ eventId: active.normalized.event.id, next });
    return false;
  }

  /** @internal SortableJS `onEnd`. Cleans the chip up and commits the preview unless cancelled. */
  handleEnd(evt: Sortable.SortableEvent): void {
    const active = this._active;
    if (!active) return;
    this._active = null;
    active.teardown();
    restoreItem(evt.item, active);

    const preview = this._preview();
    this._setPreview(null);
    this._zone.run(() => {
      this._ctx.setDragging(false);
      this._ctx.suppressNextClick();
      if (
        active.cancelled ||
        !preview ||
        !this._changed(active.normalized, preview.next)
      )
        return;
      this._ctx.commitChange(
        'move',
        active.normalized,
        preview.next,
        'pointer',
      );
    });
  }

  /**
   * @internal SortableJS `onAdd`: a chip from another Sortable of the same group was dropped on one of our lists.
   * The element goes straight back where it came from; the consumer gets `externalDrop` with the resolved range.
   */
  handleAdd(
    evt: Sortable.SortableEvent,
    pointer: MlvSchedulerPointerPosition | null,
  ): void {
    if (this._lists.has(evt.from)) return; // our own chips never get here (onMove returns false)
    const index = evt.oldIndex ?? evt.from.children.length;
    evt.from.insertBefore(evt.item, evt.from.children[index] ?? null);
    this._stopForeignTracking();

    const at = pointer ?? this._lastPointer;
    if (!at) return;
    const target = this.resolveTarget(evt.to, at, 0, false);
    if (!target) return;
    const adapter = this._ctx.adapter;
    const days = this._ctx.days();
    const day = days[Math.min(days.length - 1, Math.max(0, target.dayIndex))];
    const allDay = target.minutes === null;
    const minutes = target.minutes ?? 0;
    const start = allDay
      ? adapter.startOfDay(day)
      : adapter.withTime(day, Math.floor(minutes / 60), minutes % 60);
    const end = allDay
      ? adapter.addCalendarDays(start, 1)
      : adapter.addMinutes(start, this._ctx.defaultEventDuration());
    const payload: MlvSchedulerExternalDropEvent<D> = {
      element: evt.item,
      start,
      end,
      allDay,
    };
    this._zone.run(() => this._ctx.emitExternalDrop(payload));
  }

  /**
   * @internal Drop target for a pointer over `list`. Time columns read the vertical position (the fallback
   * clone's top edge when one of our chips is dragged, else the pointer); lane lists read the day only.
   */
  resolveTarget(
    list: HTMLElement,
    pointer: MlvSchedulerPointerPosition,
    grabDayOffset: number,
    useGhost: boolean,
  ): MlvSchedulerDropTarget | null {
    const entry = this._lists.get(list);
    if (!entry) return null;
    const dayIndex = entry.registration.dayIndex();
    if (entry.registration.kind === 'time-column') {
      const rect = list.getBoundingClientRect();
      const ghost = useGhost ? Sortable.ghost : null;
      const top = ghost ? ghost.getBoundingClientRect().top : pointer.y;
      const minutes = minutesFromOffset(
        top - rect.top,
        rect.height,
        this._ctx.minMinutes(),
        this._ctx.maxMinutes(),
        this._ctx.snap(),
      );
      return { dayIndex, minutes, allDay: false };
    }
    return {
      dayIndex: dayIndex - grabDayOffset,
      minutes: null,
      allDay: entry.registration.kind === 'all-day-cell' ? true : null,
    };
  }

  /** @private SortableJS options shared by every list. */
  private _options(): Sortable.Options {
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return {
      group: {
        name: this._ctx.dragGroup(),
        pull: true,
        put: (_to, _from, item) => {
          if (
            !this._active &&
            !this._lists.has(item.parentElement as HTMLElement)
          )
            this._trackForeign();
          return this._ctx.editable();
        },
      },
      sort: true,
      draggable: '.mlv-scheduler-event',
      filter: '[data-draggable="false"]',
      preventOnFilter: false,
      forceFallback: true,
      fallbackOnBody: true,
      fallbackTolerance: 5,
      chosenClass: MLV_SCHEDULER_SORTABLE_CLASSES.chosen,
      ghostClass: MLV_SCHEDULER_SORTABLE_CLASSES.ghost,
      dragClass: MLV_SCHEDULER_SORTABLE_CLASSES.drag,
      fallbackClass: MLV_SCHEDULER_SORTABLE_CLASSES.fallback,
      animation: reducedMotion ? 0 : 150,
      easing: 'var(--mlv-ease-in-out-strong)',
      scroll: true,
      bubbleScroll: true,
      onClone: (evt) => sanitizeClone(evt.clone),
      onStart: (evt) => this.handleStart(evt, this._lastPointer),
      onMove: (evt, originalEvent) => this.handleMove(evt, originalEvent),
      onEnd: (evt) => this.handleEnd(evt),
      onAdd: (evt) => this.handleAdd(evt, this._lastPointer),
    };
  }

  /** @private Remembers where a drag began so `handleStart` can compute the grab offset. */
  private readonly _onListPointerDown = (event: Event): void => {
    this._lastPointer = pointerOf(event);
  };

  /**
   * @private Document listeners for the lifetime of one of our drags: pointer tracking, "outside every list"
   * detection (clears the preview) and Escape (cancels). Returns the teardown.
   */
  private _listenDuringDrag(): () => void {
    const doc = this._document;
    const onPointerMove = (event: Event): void => {
      const at = pointerOf(event);
      if (at) this._lastPointer = at;
      const target = event.target as Element | null;
      if (target && !target.closest('[data-mlv-scheduler-list]'))
        this._setPreview(null);
    };
    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') this.cancel();
    };
    return this._zone.runOutsideAngular(() => {
      doc.addEventListener('pointermove', onPointerMove, { passive: true });
      doc.addEventListener('keydown', onKeydown);
      return () => {
        doc.removeEventListener('pointermove', onPointerMove);
        doc.removeEventListener('keydown', onKeydown);
      };
    });
  }

  /** @private Tracks the pointer while a foreign item is dragged over us, so `handleAdd` knows where it fell. */
  private _trackForeign(): void {
    if (this._foreignTeardown) return;
    const doc = this._document;
    const onMove = (event: Event): void => {
      const at = pointerOf(event);
      if (at) this._lastPointer = at;
    };
    const stop = (): void => this._stopForeignTracking();
    this._foreignTeardown = this._zone.runOutsideAngular(() => {
      doc.addEventListener('pointermove', onMove, { passive: true });
      doc.addEventListener('dragover', onMove, { passive: true });
      doc.addEventListener('pointerup', stop);
      doc.addEventListener('drop', stop);
      return () => {
        doc.removeEventListener('pointermove', onMove);
        doc.removeEventListener('dragover', onMove);
        doc.removeEventListener('pointerup', stop);
        doc.removeEventListener('drop', stop);
      };
    });
  }

  /** @private Stops foreign pointer tracking. */
  private _stopForeignTracking(): void {
    this._foreignTeardown?.();
    this._foreignTeardown = null;
  }

  /** @private Writes the preview inside the zone, only when it actually changed. */
  private _setPreview(next: MlvSchedulerDragPreview<D> | null): void {
    const current = this._preview();
    if (current === next) return;
    if (
      current &&
      next &&
      current.eventId === next.eventId &&
      !this._differs(current.next, next.next)
    )
      return;
    this._zone.run(() => this._preview.set(next));
  }

  /** @private Whether a drop changes the event at all. */
  private _changed(
    normalized: MlvSchedulerNormalizedEvent<D, TData>,
    next: MlvSchedulerNextRange<D>,
  ): boolean {
    return this._differs(
      {
        start: normalized.start,
        end: normalized.end,
        allDay: normalized.allDay,
      },
      next,
    );
  }

  /** @private Range inequality through the adapter. */
  private _differs(
    a: MlvSchedulerNextRange<D>,
    b: MlvSchedulerNextRange<D>,
  ): boolean {
    const adapter = this._ctx.adapter;
    return (
      a.allDay !== b.allDay ||
      !adapter.sameDateTime(a.start, b.start) ||
      !adapter.sameDateTime(a.end, b.end)
    );
  }
}

/** Reads `clientX`/`clientY` from a mouse, pointer, drag or touch event. */
function pointerOf(
  event: Event | null | undefined,
): MlvSchedulerPointerPosition | null {
  if (!event) return null;
  const touch =
    (event as TouchEvent).touches?.[0] ??
    (event as TouchEvent).changedTouches?.[0];
  if (touch) return { x: touch.clientX, y: touch.clientY };
  const { clientX, clientY } = event as MouseEvent;
  return typeof clientX === 'number' && typeof clientY === 'number'
    ? { x: clientX, y: clientY }
    : null;
}

/** Strips ids, focusability and animation from a SortableJS clone so it never enters the a11y tree twice. */
function sanitizeClone(clone: HTMLElement): void {
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('inert', '');
  clone.removeAttribute('id');
  clone.removeAttribute('tabindex');
  clone.style.animation = 'none';
  for (const el of clone.querySelectorAll<HTMLElement>('[id], [tabindex]')) {
    el.removeAttribute('id');
    el.removeAttribute('tabindex');
  }
}

/** Removes every SortableJS trace from the dragged chip and puts it back if SortableJS moved it. */
function restoreItem<D, TData>(
  item: HTMLElement,
  active: ActiveDrag<D, TData>,
): void {
  for (const cls of Object.values(MLV_SCHEDULER_SORTABLE_CLASSES))
    item.classList.remove(cls);
  item.removeAttribute('draggable');
  if (active.originalStyle === null) item.removeAttribute('style');
  else item.setAttribute('style', active.originalStyle);
  if (item.parentNode !== active.from) {
    active.from.insertBefore(
      item,
      active.nextSibling && active.nextSibling.parentNode === active.from
        ? active.nextSibling
        : null,
    );
  }
}
