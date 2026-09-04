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
import { attachPointerDrag } from '../drag/scheduler-pointer';
import {
  dayIndexOf,
  lastDayOf,
  resolveResize,
  spansMultipleDays,
  type MlvSchedulerNormalizedEvent,
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
  /** @private Resize handle; present only while `_resizable()`. */
  private readonly _handle = viewChild<ElementRef<HTMLElement>>('handle');
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
      const handle = this._handle()?.nativeElement;
      if (!handle || !this._isBrowser || this._ghost()) return;
      const detach = this._zone.runOutsideAngular(() =>
        this._attachResize(handle),
      );
      onCleanup(detach);
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
    if (this._ghost()) return;
    if (kind === 'click' && this._ctx.claimSuppressedClick()) return;
    this._ctx.emitEventInteraction(kind, {
      event: this.event(),
      element: this._host,
      nativeEvent,
    });
  }

  /** @protected Enter/Space → click; Alt(+Shift)+Arrow → move/resize; Escape → owning cell; Tab → sibling chips. */
  protected _onKeydown(event: KeyboardEvent): void {
    if (this._ghost()) return;
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
    const resize = event.shiftKey;
    if (resize ? !this._resizable() : !this._draggable()) return;
    event.preventDefault();
    event.stopPropagation();
    const next = resize
      ? this._keyboardResize(arrow)
      : this._keyboardMove(arrow);
    if (!next) return;
    const ctx = this._ctx;
    const normalized = this.normalized();
    ctx.pendingFocus.set({ kind: 'event', id: normalized.event.id });
    const ok = ctx.commitChange(
      resize ? 'resize' : 'move',
      normalized,
      next,
      'keyboard',
    );
    if (ok && !resize && dayIndexOf(ctx.adapter, ctx.days(), next.start) < 0) {
      ctx.goTo(next.start);
    }
  }

  /** @private Next range for a keyboard move. Lanes: ←→ ±1 day, ↑↓ ±7 days. Timed: ↑↓ ±snap, ←→ ±1 day. */
  private _keyboardMove(arrow: number): MlvSchedulerNextRange<D> {
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
      const step = this._ctx.snap() * sign;
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

  /** @private Next range for a keyboard resize of the end edge; `null` when already at the minimum. */
  private _keyboardResize(arrow: number): MlvSchedulerNextRange<D> | null {
    const { adapter } = this._ctx;
    const { start, end, allDay } = this.normalized();
    let nextEnd: D;
    let minEnd: D;
    if (this.lane()) {
      const sign = arrow === RIGHT_ARROW || arrow === DOWN_ARROW ? 1 : -1;
      nextEnd = allDay
        ? adapter.addCalendarDays(end, sign)
        : adapter.shiftDays(end, sign);
      minEnd = allDay
        ? adapter.addCalendarDays(adapter.startOfDay(start), 1)
        : adapter.addMinutes(start, this._ctx.snap());
    } else {
      if (arrow === LEFT_ARROW || arrow === RIGHT_ARROW) return null;
      nextEnd = adapter.addMinutes(
        end,
        this._ctx.snap() * (arrow === DOWN_ARROW ? 1 : -1),
      );
      minEnd = adapter.addMinutes(start, this._ctx.snap());
    }
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

  /** @private Wires the resize handle: preview through CSS custom properties, commit on release. */
  private _attachResize(handle: HTMLElement): () => void {
    const host = this._host;
    let restore: (() => void) | null = null;
    let originX = 0;
    let baseSpan = 1;
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
          restore = () => {
            host.style.setProperty('--mlv-scheduler-event-top', top);
            host.style.setProperty('--mlv-scheduler-event-height', height);
            host.style.setProperty('--mlv-scheduler-span', span);
          };
          originX = origin.x;
          baseSpan = Math.max(1, Number(span) || 1);
          pending = null;
        },
        onMove: (point) => {
          pending = this.lane()
            ? this._previewLaneResize(point.x, originX, baseSpan)
            : this._previewTimedResize(point.y);
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
        onCancel: () => restore?.(),
      },
      { threshold: 3 },
    );
  }

  /** @private Timed chip: end minute from the pointer's vertical position inside the owning column. */
  private _previewTimedResize(
    y: number,
  ): { dayIndex: number; minutes: number } | null {
    const column = this._host.closest<HTMLElement>(
      '.mlv-scheduler-time-grid__column',
    );
    if (!column) return null;
    const rect = column.getBoundingClientRect();
    const ctx = this._ctx;
    const min = ctx.minMinutes();
    const span = ctx.maxMinutes() - min;
    const end = minutesFromOffset(
      y - rect.top,
      rect.height,
      min,
      ctx.maxMinutes(),
      ctx.snap(),
    );
    const top =
      parseFloat(
        this._host.style.getPropertyValue('--mlv-scheduler-event-top'),
      ) || 0;
    const endPct = ((end - min) / span) * 100;
    const minHeight = (ctx.snap() / span) * 100;
    this._host.style.setProperty(
      '--mlv-scheduler-event-height',
      `${Math.max(minHeight, endPct - top)}%`,
    );
    return { dayIndex: this.dayIndex(), minutes: end };
  }

  /** @private Lane bar: span from the pointer's horizontal travel in whole cell widths (mirrored in RTL). */
  private _previewLaneResize(
    x: number,
    originX: number,
    baseSpan: number,
  ): { dayIndex: number; minutes: null } | null {
    const cell = this._host.closest<HTMLElement>('[data-day-index]');
    if (!cell) return null;
    const cellWidth = cell.getBoundingClientRect().width;
    if (!cellWidth) return null;
    // physical → logical once: travel toward inline-end grows the bar
    const travel =
      this._rtl.resolveDirection(this._host) === 'rtl'
        ? originX - x
        : x - originX;
    const span = Math.max(1, baseSpan + Math.round(travel / cellWidth));
    this._host.style.setProperty('--mlv-scheduler-span', String(span));
    return { dayIndex: this.dayIndex() + span - 1, minutes: null };
  }
}
