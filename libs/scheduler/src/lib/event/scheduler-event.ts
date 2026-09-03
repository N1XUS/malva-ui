import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
} from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import {
  lastDayOf,
  spansMultipleDays,
  type MlvSchedulerNormalizedEvent,
} from '../layout/scheduler-layout';
import {
  MLV_SCHEDULER_CONTEXT,
  type MlvSchedulerContext,
  type MlvSchedulerInteractionKind,
} from '../scheduler/scheduler-context';
import type { MlvSchedulerEventContext } from '../scheduler/scheduler.types';

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
  /** @private Host element, handed to interaction payloads. */
  private readonly _host = inject(ElementRef<HTMLElement>).nativeElement;

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

  /** @protected Enter / Space activate. Alt+Arrow move / resize are added by the keyboard task. */
  protected _onKeydown(event: KeyboardEvent): void {
    if (this._ghost()) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this._ctx.emitEventInteraction('click', {
        event: this.event(),
        element: this._host,
        nativeEvent: event,
      });
    }
  }
}
