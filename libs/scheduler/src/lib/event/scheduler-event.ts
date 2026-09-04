import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import {
  TOUCH_GESTURE_DELAY,
  attachPointerDrag,
} from '../drag/scheduler-pointer';
import {
  dayIndexOf,
  lastDayOf,
  resolveResize,
  spansMultipleDays,
  type MlvSchedulerNormalizedEvent,
  type MlvSchedulerResizeEdge,
} from '../layout/scheduler-layout';
import { minutesFromOffset } from '../layout/scheduler-time';
import {
  MLV_SCHEDULER_CONTEXT,
  type MlvSchedulerContext,
  type MlvSchedulerInteractionKind,
} from '../scheduler/scheduler-context';
import type {
  MlvSchedulerEventContext,
  MlvSchedulerNextRange,
} from '../scheduler/scheduler.types';

/**
 * One rendered segment of an event. The host owns focus, ARIA, click /
 * keyboard activation and the drag / resize affordances; the content is the
 * default time + title or the consumer's `*mlvSchedulerEventDef`.
 */
@Component({
  selector: 'mlv-scheduler-event',
  templateUrl: './scheduler-event.html',
  styleUrl: './scheduler-event.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, LucideChevronLeft, LucideChevronRight],
  host: {
    class: 'mlv-scheduler-event',
    '[attr.role]': '_ghost() ? null : "button"',
    '[attr.tabindex]': '_ghost() ? -1 : tabIndex()',
    '[attr.aria-hidden]': '_ghost() ? "true" : null',
    '[attr.inert]': '_ghost() ? "" : null',
    '[attr.aria-label]': '_ghost() ? null : _label()',
    '[attr.aria-describedby]':
      '!_ghost() && (_draggable() || _resizable()) ? _ctx.dragHintId : null',
    '[attr.data-event-id]': 'normalized().event.id',
    '[attr.data-draggable]': '_draggable() && !_ghost() ? null : "false"',
    '[class.mlv-scheduler-event--ghost]': '_ghost()',
    '[class.mlv-scheduler-event--all-day]': 'lane()',
    '[class.mlv-scheduler-event--timed]': '!lane()',
    '[class.mlv-scheduler-event--continues-before]': 'continuesBefore()',
    '[class.mlv-scheduler-event--continues-after]': 'continuesAfter()',
    '[class.mlv-scheduler-event--custom-color]': '!!event().color',
    '[class]': '_toneClass()',
    '[style.--mlv-scheduler-event-color]': 'event().color ?? null',
    '(click)': '_onPointer("click", $event)',
    '(dblclick)': '_onPointer("dblclick", $event)',
    '(contextmenu)': '_onPointer("contextmenu", $event)',
    '(keydown)': '_onKeydown($event)',
    '(pointerdown)': '_onHostPointerDown($event)',
  },
})
export class MlvSchedulerEventChip<D = Date, TData = unknown> {
  /** The normalized event this chip renders a segment of. */
  readonly normalized = input.required<MlvSchedulerNormalizedEvent<D, TData>>();
  /** Rendered in a lane (month grid or all-day row) rather than on the time axis. */
  readonly lane = input(false);
  /** The event started before this segment. */
  readonly continuesBefore = input(false);
  /** The event ends after this segment. */
  readonly continuesAfter = input(false);
  /** Index of the visible day this segment starts in. */
  readonly dayIndex = input(0);
  /** Roving tab index; the owning cell hands out `0`. */
  readonly tabIndex = input(-1);

  /** @protected Root context. */
  protected readonly _ctx = inject(
    MLV_SCHEDULER_CONTEXT,
  ) as MlvSchedulerContext<D, TData>;
  /** @private Host element: interaction payloads, and geometry / owning cell-column lookups for resize. */
  private readonly _host: HTMLElement = inject(ElementRef<HTMLElement>)
    .nativeElement;
  /** @private Start-edge resize handle; absent while `!_resizable()` or the segment continues before. */
  private readonly _startHandle =
    viewChild<ElementRef<HTMLElement>>('startHandle');
  /** @private End-edge resize handle; absent while `!_resizable()` or the segment continues after. */
  private readonly _endHandle = viewChild<ElementRef<HTMLElement>>('endHandle');
  /** @private Pointer listeners run outside change detection. */
  private readonly _zone = inject(NgZone);
  /** @private Direction of the chip; lane resize maps pointer travel to days through it. */
  private readonly _rtl = inject(MlvRtlService);
  /** @private Pointer events exist only in the browser. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The underlying event. */
  readonly event = computed(() => this.normalized().event);
  /** @internal Drag-preview copy: inert, unlabeled, not draggable. */
  protected readonly _ghost = computed(() => this.normalized().ghost === true);
  /** @protected Drag allowed for this chip. */
  protected readonly _draggable = computed(
    () => this._ctx.editable() && (this.event().draggable ?? true),
  );
  /** @protected Resize allowed for this chip. */
  protected readonly _resizable = computed(
    () => this._ctx.editable() && (this.event().resizable ?? true),
  );
  /** @protected Tone modifier, empty for the default accent chip. */
  protected readonly _toneClass = computed(() => {
    const tone = this.event().tone;
    return tone ? `mlv-scheduler-event--tone-${tone}` : '';
  });
  /** @protected "9:00 AM – 9:30 AM" on the time axis, "9:00 AM" in a lane. */
  protected readonly _timeText = computed(() => {
    const { start, end } = this.normalized();
    const from = this._ctx.formatTime(start);
    return this.lane() ? from : `${from} – ${this._ctx.formatTime(end)}`;
  });
  /** @protected Accessible name. */
  protected readonly _label = computed(() => {
    const n = this.normalized();
    const adapter = this._ctx.adapter;
    if (n.allDay) {
      return this._ctx.translate('eventLabelAllDay', {
        title: n.event.title,
        start: adapter.getDateLabel(n.start),
        end: adapter.getDateLabel(lastDayOf(adapter, n)),
      });
    }
    const multi = spansMultipleDays(adapter, n);
    return this._ctx.translate('eventLabel', {
      title: n.event.title,
      start: multi
        ? this._ctx.formatDateTime(n.start)
        : this._ctx.formatTime(n.start),
      end: multi
        ? this._ctx.formatDateTime(n.end)
        : this._ctx.formatTime(n.end),
    });
  });
  /** @protected Context for a custom def. */
  protected readonly _defContext = computed<MlvSchedulerEventContext<D, TData>>(
    () => ({
      $implicit: this.event(),
      view: this._ctx.view(),
      allDay: this.lane(),
      continuesBefore: this.continuesBefore(),
      continuesAfter: this.continuesAfter(),
    }),
  );

  constructor() {
    afterRenderEffect((onCleanup) => {
      if (!this._isBrowser || this._ghost()) return;
      const handles: readonly [
        HTMLElement | undefined,
        MlvSchedulerResizeEdge,
      ][] = [
        [this._startHandle()?.nativeElement, 'start'],
        [this._endHandle()?.nativeElement, 'end'],
      ];
      const detach = this._zone.runOutsideAngular(() =>
        handles
          .filter(([handle]) => !!handle)
          .map(([handle, edge]) =>
            this._attachResize(handle as HTMLElement, edge),
          ),
      );
      onCleanup(() => detach.forEach((stop) => stop()));
    });
  }

  /** Focuses the host. */
  focus(): void {
    this._host.focus();
  }

  /** @protected Click / dblclick / contextmenu → root outputs; the click after a drop is dropped once. */
  protected _onPointer(
    kind: MlvSchedulerInteractionKind,
    nativeEvent: MouseEvent,
  ): void {
    if (this._ghost() || this._fromInteractiveDescendant(nativeEvent)) return;
    if (kind === 'click' && this._ctx.claimSuppressedClick()) return;
    this._ctx.emitEventInteraction(kind, {
      event: this.event(),
      element: this._host,
      nativeEvent,
    });
  }

  /**
   * @protected `Enter` / `Space` activate; `Alt+Arrow` moves; `Alt+Shift+Arrow` resizes the end edge and
   * `Ctrl+Alt+Arrow` the start edge; `Escape` returns to the owning cell; `Tab` cycles sibling chips.
   * A key that maps to no gesture here is left to bubble — the grid still owns it.
   */
  protected _onKeydown(event: KeyboardEvent): void {
    if (this._ghost() || this._fromInteractiveDescendant(event)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this._ctx.emitEventInteraction('click', {
        event: this.event(),
        element: this._host,
        nativeEvent: event,
      });
      return;
    }
    if (event.key === 'Escape') {
      const cell = this._owningCell();
      if (cell) {
        event.preventDefault();
        event.stopPropagation();
        cell.focus();
      }
      return;
    }
    if (event.key === 'Tab') {
      this._tabWithinCell(event);
      return;
    }
    if (!event.altKey) return;
    const arrow = this._rtl.normalizeArrowKey(event);
    if (arrow === null) return;
    // Shift takes precedence, so Ctrl+Alt+Shift+Arrow stays an end-edge resize.
    const edge: MlvSchedulerResizeEdge | null = event.shiftKey
      ? 'end'
      : event.ctrlKey
        ? 'start'
        : null;
    if (edge ? !this._resizable() : !this._draggable()) return;
    // A timed chip resizes on the block axis only: the horizontal keys mean
    // nothing here, so they must reach the grid instead of being swallowed.
    if (edge && !this.lane() && (arrow === LEFT_ARROW || arrow === RIGHT_ARROW))
      return;
    event.preventDefault();
    event.stopPropagation();
    const next = edge
      ? this._keyboardResize(arrow, edge)
      : this._keyboardMove(arrow);
    if (!next) return;
    const ctx = this._ctx;
    const normalized = this.normalized();
    ctx.pendingFocus.set({ kind: 'event', id: normalized.event.id });
    const ok = ctx.commitChange(
      edge ? 'resize' : 'move',
      normalized,
      next,
      'keyboard',
    );
    if (ok && !edge && dayIndexOf(ctx.adapter, ctx.days(), next.start) < 0) {
      ctx.goTo(next.start);
    }
  }

  /**
   * @private Whether the event came from a focusable descendant of the chip — a control projected by a
   * consumer's `*mlvSchedulerEventDef`. The chip must not translate that into its own click / move, and
   * must not `preventDefault()` the control's own keyboard handling.
   */
  private _fromInteractiveDescendant(event: Event): boolean {
    const target = event.target as Element | null;
    if (!target || target === this._host) return false;
    const interactive = target.closest(
      'a[href],button,input,select,textarea,[contenteditable="true"],[tabindex]',
    );
    return (
      !!interactive &&
      interactive !== this._host &&
      this._host.contains(interactive)
    );
  }

  /**
   * @private Next range for a keyboard move, or `null` when the step is a no-op.
   * Lanes: ←→ ±1 day, ↑↓ ±7 days. Timed: ↑↓ ±snap (clamped to the axis), ←→ ±1 day.
   */
  private _keyboardMove(arrow: number): MlvSchedulerNextRange<D> | null {
    const { adapter } = this._ctx;
    const { start, end, allDay } = this.normalized();
    if (arrow === UP_ARROW || arrow === DOWN_ARROW) {
      const sign = arrow === DOWN_ARROW ? 1 : -1;
      if (this.lane()) {
        return {
          start: adapter.shiftDays(start, 7 * sign),
          end: adapter.shiftDays(end, 7 * sign),
          allDay,
        };
      }
      const step = this._clampTimedStep(start, end, this._ctx.snap() * sign);
      if (step === 0) return null;
      return {
        start: adapter.addMinutes(start, step),
        end: adapter.addMinutes(end, step),
        allDay,
      };
    }
    const sign = arrow === RIGHT_ARROW ? 1 : -1;
    return {
      start: adapter.shiftDays(start, sign),
      end: adapter.shiftDays(end, sign),
      allDay,
    };
  }

  /**
   * @private Trims a vertical keyboard step so a timed chip cannot leave the time axis.
   *
   * Nothing downstream clamps it — `commitChange` only runs the consumer's veto —
   * so `Alt+ArrowUp` on a chip in the first slot used to write a range above
   * `minTime`: the chip stopped rendering, and the `pendingFocus` request made
   * alongside the commit had nothing to resolve to.
   *
   * Only a range that already fits inside one day's window is clamped. One that
   * crosses midnight, or is longer than the window, has no in-window placement
   * at all, so it keeps stepping freely rather than being snapped to `minTime`.
   */
  private _clampTimedStep(start: D, end: D, step: number): number {
    const { adapter } = this._ctx;
    const from = adapter.minutesOfDay(start);
    const duration = adapter.differenceInMinutes(end, start);
    const min = this._ctx.minMinutes();
    const max = this._ctx.maxMinutes();
    if (from < min || from + duration > max) return step;
    return Math.min(Math.max(from + step, min), max - duration) - from;
  }

  /**
   * @private Next range for a keyboard resize of `edge`; `null` when the step would shrink the event
   * below one snap step (one day for an all-day bar). The opposite edge never moves.
   */
  private _keyboardResize(
    arrow: number,
    edge: MlvSchedulerResizeEdge,
  ): MlvSchedulerNextRange<D> | null {
    const { adapter } = this._ctx;
    const { start, end, allDay } = this.normalized();
    const sign = arrow === RIGHT_ARROW || arrow === DOWN_ARROW ? 1 : -1;
    if (edge === 'start') {
      const nextStart = this.lane()
        ? allDay
          ? adapter.addCalendarDays(start, sign)
          : adapter.shiftDays(start, sign)
        : adapter.addMinutes(start, this._ctx.snap() * sign);
      const maxStart = allDay
        ? adapter.addCalendarDays(adapter.startOfDay(end), -1)
        : adapter.addMinutes(end, -this._ctx.snap());
      if (adapter.compareDateTime(nextStart, maxStart) > 0) return null;
      return { start: nextStart, end, allDay };
    }
    const nextEnd = this.lane()
      ? allDay
        ? adapter.addCalendarDays(end, sign)
        : adapter.shiftDays(end, sign)
      : adapter.addMinutes(end, this._ctx.snap() * sign);
    const minEnd = allDay
      ? adapter.addCalendarDays(adapter.startOfDay(start), 1)
      : adapter.addMinutes(start, this._ctx.snap());
    if (adapter.compareDateTime(nextEnd, minEnd) < 0) return null;
    return { start, end: nextEnd, allDay };
  }

  /**
   * @private The grid cell this chip belongs to, or `null` outside a grid
   * (the month overflow popover is portaled to `<body>`).
   *
   * A lane chip — a month cell, or the time grid's all-day row — is a DOM
   * descendant of its cell, which carries both `data-day-index` and
   * `data-minutes`, so `closest()` finds it directly. A **timed** chip is not:
   * it lives in the column's `__events` layer, a sibling of the slot cells,
   * and the column carries `data-day-index` alone. Its owning cell is the slot
   * whose range contains the chip's start inside that column — the inverse of
   * the grid's `_chipAt()`, so `Enter` on a slot and `Escape` on the chip it
   * focused are a round trip.
   */
  private _owningCell(): HTMLElement | null {
    const direct = this._host.closest<HTMLElement>(
      '[data-day-index][data-minutes]',
    );
    if (direct) return direct;
    const container = this._chipContainer();
    return (
      container?.querySelector<HTMLElement>(
        `[data-minutes="${this._owningSlotMinutes()}"]`,
      ) ?? null
    );
  }

  /**
   * @private Start of the slot that owns a timed chip: the chip's start
   * minute-of-day snapped down to the slot grid, clamped to the visible range.
   * A segment continuing from an earlier day starts at the top of the column.
   */
  private _owningSlotMinutes(): number {
    const ctx = this._ctx;
    const adapter = ctx.adapter;
    const min = ctx.minMinutes();
    const slot = ctx.slotDuration();
    const day = ctx.days()[this.dayIndex()];
    const start = this.normalized().start;
    const raw =
      day !== undefined && adapter.sameDate(start, day)
        ? adapter.minutesOfDay(start)
        : min;
    const clamped = Math.min(ctx.maxMinutes() - slot, Math.max(min, raw));
    return min + Math.floor((clamped - min) / slot) * slot;
  }

  /**
   * @private The element holding this chip's sibling chips: the month / all-day
   * cell for a lane chip, the day column for a timed chip. Both carry
   * `data-day-index`, and neither contains another day's chips.
   */
  private _chipContainer(): HTMLElement | null {
    return this._host.closest<HTMLElement>('[data-day-index]');
  }

  /** @private Tab/Shift+Tab move among the chips (and the `+N more` button) of the owning cell; otherwise native. */
  private _tabWithinCell(event: KeyboardEvent): void {
    const cell = this._chipContainer();
    if (!cell) return;
    const stops = Array.from(
      cell.querySelectorAll<HTMLElement>(
        '.mlv-scheduler-event:not(.mlv-scheduler-event--ghost), .mlv-scheduler-month__more',
      ),
    );
    const index = stops.indexOf(this._host);
    const next = stops[index + (event.shiftKey ? -1 : 1)];
    if (!next) return; // leave the grid natively
    event.preventDefault();
    next.focus();
  }

  /**
   * @internal Keeps a press on the resize handle from starting a SortableJS
   * drag: SortableJS's `filter` matches `[data-draggable="false"]` on the
   * chip itself, not on descendants, and listens for `pointerdown` on the
   * list element in the bubbling phase — stopping propagation here is enough.
   */
  protected _onHostPointerDown(event: Event): void {
    if (
      (event.target as Element | null)?.closest(
        '.mlv-scheduler-event__resize-handle',
      )
    ) {
      event.stopPropagation();
    }
  }

  /**
   * @private Wires one resize handle: preview through CSS custom properties, commit on release.
   * All geometry (the owning column's rect, the cell pitch, the chip's own placement vars) is read
   * ONCE per gesture in `onStart` — a `getBoundingClientRect()` per `pointermove` is a forced reflow
   * on the hottest path in the component.
   */
  private _attachResize(
    handle: HTMLElement,
    edge: MlvSchedulerResizeEdge,
  ): () => void {
    const host = this._host;
    let restore: (() => void) | null = null;
    let originX = 0;
    let baseSpan = 1;
    let baseTop = 0;
    let baseHeight = 0;
    let columnRect: DOMRect | null = null;
    let cellWidth = 0;
    let pending: { dayIndex: number; minutes: number | null } | null = null;

    return attachPointerDrag(
      handle,
      {
        onStart: (origin) => {
          const top = host.style.getPropertyValue('--mlv-scheduler-event-top');
          const height = host.style.getPropertyValue(
            '--mlv-scheduler-event-height',
          );
          const span = host.style.getPropertyValue('--mlv-scheduler-span');
          const shift = host.style.getPropertyValue(
            '--mlv-scheduler-lane-shift',
          );
          restore = () => {
            host.style.setProperty('--mlv-scheduler-event-top', top);
            host.style.setProperty('--mlv-scheduler-event-height', height);
            host.style.setProperty('--mlv-scheduler-span', span);
            host.style.setProperty('--mlv-scheduler-lane-shift', shift);
          };
          originX = origin.x;
          baseSpan = Math.max(1, Number(span) || 1);
          baseTop = parseFloat(top) || 0;
          baseHeight = parseFloat(height) || 0;
          columnRect = this.lane()
            ? null
            : (host
                .closest<HTMLElement>('.mlv-scheduler-time-grid__column')
                ?.getBoundingClientRect() ?? null);
          cellWidth = this.lane()
            ? (host
                .closest<HTMLElement>('[data-day-index]')
                ?.getBoundingClientRect().width ?? 0)
            : 0;
          pending = null;
        },
        onMove: (point) => {
          pending = this.lane()
            ? this._previewLaneResize(
                point.x,
                originX,
                baseSpan,
                cellWidth,
                edge,
              )
            : this._previewTimedResize(
                point.y,
                columnRect,
                baseTop,
                baseHeight,
                edge,
              );
        },
        onEnd: (_point, moved) => {
          if (!moved || !pending) {
            restore?.();
            return;
          }
          const target = pending;
          const ctx = this._ctx;
          this._zone.run(() => {
            const next = resolveResize(
              ctx.adapter,
              this.normalized(),
              target,
              ctx.days(),
              ctx.snap(),
              edge,
            );
            const ok = ctx.commitChange(
              'resize',
              this.normalized(),
              next,
              'pointer',
            );
            if (!ok) restore?.();
            ctx.suppressNextClick();
          });
        },
        onCancel: () => {
          restore?.();
          // The pointer is still down on Escape; its release still fires a click.
          this._ctx.suppressNextClick();
        },
      },
      // Touch arms on a short press, matching the SortableJS `delay` that
      // governs a drag-move, so a swipe that starts on a handle still scrolls.
      { threshold: 3, touchDelay: TOUCH_GESTURE_DELAY },
    );
  }

  /**
   * @private Timed chip: the dragged edge's minute from the pointer's vertical position inside the
   * owning column, previewed by rewriting the chip's placement vars. The opposite edge is pinned to the
   * placement captured at gesture start, so repeated moves are idempotent.
   */
  private _previewTimedResize(
    y: number,
    columnRect: DOMRect | null,
    baseTop: number,
    baseHeight: number,
    edge: MlvSchedulerResizeEdge,
  ): { dayIndex: number; minutes: number } | null {
    if (!columnRect) return null;
    const ctx = this._ctx;
    const min = ctx.minMinutes();
    const span = ctx.maxMinutes() - min;
    const minutes = minutesFromOffset(
      y - columnRect.top,
      columnRect.height,
      min,
      ctx.maxMinutes(),
      ctx.snap(),
      edge,
    );
    const percent = ((minutes - min) / span) * 100;
    const minHeight = (ctx.snap() / span) * 100;
    if (edge === 'end') {
      this._host.style.setProperty(
        '--mlv-scheduler-event-height',
        `${Math.max(minHeight, percent - baseTop)}%`,
      );
    } else {
      const bottom = baseTop + baseHeight;
      const top = Math.max(0, Math.min(percent, bottom - minHeight));
      this._host.style.setProperty('--mlv-scheduler-event-top', `${top}%`);
      this._host.style.setProperty(
        '--mlv-scheduler-event-height',
        `${bottom - top}%`,
      );
    }
    return { dayIndex: this.dayIndex(), minutes };
  }

  /**
   * @private Lane bar: the dragged edge in whole cell widths of pointer travel (mirrored in RTL). The
   * end edge grows `--mlv-scheduler-span`; the start edge shrinks it and slides the bar by the same
   * number of cells through `--mlv-scheduler-lane-shift`, because a bar is laid out from its start cell.
   */
  private _previewLaneResize(
    x: number,
    originX: number,
    baseSpan: number,
    cellWidth: number,
    edge: MlvSchedulerResizeEdge,
  ): { dayIndex: number; minutes: null } | null {
    if (!cellWidth) return null;
    // physical → logical once: travel toward inline-end is positive
    const travel =
      this._rtl.resolveDirection(this._host) === 'rtl'
        ? originX - x
        : x - originX;
    const steps = Math.round(travel / cellWidth);
    if (edge === 'end') {
      const span = Math.max(1, baseSpan + steps);
      this._host.style.setProperty('--mlv-scheduler-span', String(span));
      return { dayIndex: this.dayIndex() + span - 1, minutes: null };
    }
    const shift = Math.max(-this.dayIndex(), Math.min(baseSpan - 1, steps));
    this._host.style.setProperty(
      '--mlv-scheduler-span',
      String(baseSpan - shift),
    );
    this._host.style.setProperty(
      '--mlv-scheduler-lane-shift',
      `${shift * cellWidth}px`,
    );
    return { dayIndex: this.dayIndex() + shift, minutes: null };
  }
}
