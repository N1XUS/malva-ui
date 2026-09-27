import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent, takeUntil } from 'rxjs';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import type { MlvFormControl } from '@malva-ui/core/form-utils';
import {
  MLV_FORM_CONTROL,
  MlvDescription,
  MlvMessage,
  MlvSignalFormControlBase,
} from '@malva-ui/core/form-utils';
import {
  MlvCompactComfortableDensity,
  MLV_DENSITY_ELEMENT,
} from '@malva-ui/cdk/density';
import {
  MlvRtlService,
  clamp,
  mlvPointerGestureEnd,
} from '@malva-ui/cdk/utils';
import { MLV_SLIDER_I18N } from '@malva-ui/i18n';
import {
  MlvSliderTooltipDef,
  type MlvSliderTooltipDefContext,
} from './slider-tooltip-def';

/**
 * The value type for the slider in single-thumb mode (number) or
 * dual-thumb range mode ([number, number]).
 */
export type MlvSliderValue = number | [number, number];

@Component({
  selector: 'mlv-slider',
  imports: [NgTemplateOutlet, MlvDescription, MlvMessage],
  templateUrl: './slider.html',
  styleUrl: './slider.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: MlvCompactComfortableDensity,
      inputs: ['mlvDensity'],
    },
  ],
  providers: [
    {
      provide: MLV_DENSITY_ELEMENT,
      useValue: 'slider',
    },
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvSlider),
    },
  ],
  host: {
    class: 'mlv-slider',
    '[class]': '"mlv-slider--state-" + resolvedState()',
    '[class.mlv-slider--disabled]': 'computedDisabled()',
    '[class.mlv-slider--range]': 'range()',
    '[class.mlv-slider--has-ticks]': 'showTicks()',
    '[class.mlv-slider--has-text]': '_hasText()',
    '[class.mlv-slider--vertical]': '_isVertical()',
    '[class.mlv-slider--dragging]': '_activeDragThumb() !== null',
    '[style.--mlv-slider-fill-start]': '_fillStart()',
    '[style.--mlv-slider-fill-end]': '_fillEnd()',
    '(pointerdown)': '_onTrackPointerDown($event)',
  },
})
export class MlvSlider
  extends MlvSignalFormControlBase<MlvSliderValue>
  implements MlvFormControl
{
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_SLIDER_I18N);

  /**
   * Orientation of the slider.
   * In `'vertical'` mode the track runs bottom-to-top, thumbs are positioned
   * with `bottom`, and the host must have an explicit height set.
   */
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');

  /** Minimum value of the slider. */
  readonly min = input<number, MlvSliderValue | null | undefined>(0, {
    transform: (value) => (typeof value === 'number' ? value : 0),
  });

  /** Maximum value of the slider. */
  readonly max = input<number, MlvSliderValue | null | undefined>(100, {
    transform: (value) => (typeof value === 'number' ? value : 100),
  });

  /** Step increment between values. */
  readonly step = input<number, number | null | undefined>(1, {
    transform: (value) => value ?? 1,
  });

  /** Whether to display tick marks at each step interval. */
  readonly showTicks = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** When true, the slider operates in dual-thumb range mode. */
  readonly range = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Shows the current value in a tooltip while a thumb is hovered, dragged,
   * or keyboard-focused.
   */
  readonly tooltip = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** The selected scalar or range value used by all Angular forms APIs. */
  readonly value = model<MlvSliderValue>(0);

  /** @protected Optional consumer template used to render tooltip text. */
  protected readonly _tooltipDef = contentChild(MlvSliderTooltipDef);

  /** @private True when orientation is vertical. */
  protected readonly _isVertical = computed(
    () => this.orientation() === 'vertical',
  );

  /**
   * @protected True while the description or the validation message renders
   * under the track (#320) — the same two conditions as the template's `@if`s.
   * Bound as `mlv-slider--has-text`, which gives the track's grid row its
   * thumb-sized minimum: only text below needs the thumb held clear of it, and
   * applying the minimum with no text would grow a slider whose
   * `--mlv-slider-thumb-size` is larger than the space its padding leaves.
   */
  protected readonly _hasText = computed(
    () => !!this.description() || !!this.message(),
  );

  /** @private Low (or sole) thumb value derived directly from the forms model. */
  protected readonly _lowValue = computed<number>(() => {
    const value = this.value();
    return this._clamp(Array.isArray(value) ? value[0] : value);
  });

  /** @private High thumb value derived directly from the forms model. */
  protected readonly _highValue = computed<number>(() => {
    const value = this.value();
    return this._clamp(Array.isArray(value) ? value[1] : this.max());
  });

  /** @protected Template context for the low or single-value thumb tooltip. */
  protected readonly _lowTooltipContext = computed<MlvSliderTooltipDefContext>(
    () => {
      const value = this._lowValue();
      return {
        $implicit: value,
        value,
        thumb: this.range() ? 'min' : 'value',
      };
    },
  );

  /** @protected Template context for the high thumb tooltip in range mode. */
  protected readonly _highTooltipContext = computed<MlvSliderTooltipDefContext>(
    () => {
      const value = this._highValue();
      return {
        $implicit: value,
        value,
        thumb: 'max',
      };
    },
  );

  /**
   * @private The thumb currently being dragged: 'low', 'high', or null.
   */
  protected readonly _activeDragThumb = signal<'low' | 'high' | null>(null);

  /**
   * @private Raw drag position (0–100%) for the low thumb while dragging.
   * Null when not dragging — thumb reverts to the snapped value's position.
   */
  private readonly _lowDragPercent = signal<number | null>(null);
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Host element. Every direction-aware half of this component — the
   * pointer-to-value mapping and the arrow-key stepping — resolves against it,
   * so they can never disagree about which direction applies. Declared here,
   * ahead of `_direction`, because a field initializer cannot read a member the
   * constructor body assigns later.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /**
   * @private Effective direction of this slider, tracking the global direction
   * and any `[dir]` scope above the host. Mirrors pointer-to-value mapping.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._elementRef,
  );

  /**
   * @private Raw drag position (0–100%) for the high thumb while dragging.
   * Null when not dragging — thumb reverts to the snapped value's position.
   */
  private readonly _highDragPercent = signal<number | null>(null);

  /**
   * @private Visual percentage position of the low thumb.
   * Uses the raw drag position while dragging for a smooth feel;
   * snaps back to the step-aligned position on pointer release.
   */
  protected readonly _lowPercent = computed<number>(() => {
    const drag = this._lowDragPercent();
    return drag !== null ? drag : this._valueToPercent(this._lowValue());
  });

  /**
   * @private Visual percentage position of the high thumb.
   * Uses the raw drag position while dragging for a smooth feel;
   * snaps back to the step-aligned position on pointer release.
   */
  protected readonly _highPercent = computed<number>(() => {
    const drag = this._highDragPercent();
    return drag !== null ? drag : this._valueToPercent(this._highValue());
  });

  /**
   * @private Computed percentage for the fill region start (0–100%).
   * In single mode this is always 0; in range mode it tracks the low thumb visual position.
   */
  protected readonly _fillStart = computed<string>(() => {
    if (!this.range()) return '0%';
    return `${this._lowPercent()}%`;
  });

  /**
   * @private Computed percentage for the fill region end (0–100%).
   * Tracks the visual (drag or snapped) position of the active thumb.
   */
  protected readonly _fillEnd = computed<string>(() => {
    return `${this.range() ? this._highPercent() : this._lowPercent()}%`;
  });

  /**
   * @private Array of tick positions (percentages) shown when showTicks is true.
   */
  protected readonly _ticks = computed<number[]>(() => {
    const min = this.min();
    const max = this.max();
    const step = this.step();
    if (step <= 0) return [];
    const ticks: number[] = [];
    for (let v = min; v <= max; v += step) {
      ticks.push(this._valueToPercent(v));
    }
    return ticks;
  });

  constructor() {
    super();
    // Touched and unfocused only when focus leaves the slider — never on Tab
    // from the low thumb to the high one (#347, D22).
    this._reportTouchOnFocusLeave();
    this._document = inject(DOCUMENT);
    this._destroyRef = inject(DestroyRef);
  }

  /**
   * @private The document whose window the drag listeners bind to. Injected
   * rather than the ambient global, so a server render never reaches a
   * process-wide object (a drag only starts from a browser `pointerdown`).
   */
  private _document: Document;

  /** @private DestroyRef so a destroy mid-drag releases the listeners. */
  private _destroyRef: DestroyRef;

  /**
   * @private The `.mlv-slider__track` element — a static child of this
   * component's own template, so it is resolved via a signal `viewChild` query
   * (repo rule: no `querySelector` for own-template elements) rather than a DOM
   * lookup on the host.
   */
  private readonly _trackRef = viewChild<ElementRef<HTMLElement>>('track');

  /**
   * @private Track bounding rect captured at pointerdown and reused for the whole
   * drag, so `_pointerToPercent` does not force a `getBoundingClientRect` layout
   * read on every pointermove. Dropped when the pointer ends or is cancelled.
   */
  private _dragTrackRect: DOMRect | null = null;

  // -------------------------------------------------------------------------
  // Forms value
  // -------------------------------------------------------------------------

  /** Whether the control holds a clearable value — A slider always carries a numeric value. */
  readonly hasValue = computed(() => true);

  // -------------------------------------------------------------------------
  // Keyboard handling (delegated from thumb elements)
  // -------------------------------------------------------------------------

  /**
   * @protected Handles keydown events on the low thumb. Writes nothing while
   * the slider may not be written (readonly or disabled). A readonly thumb
   * stays focusable so its value can still be read, and a slider key it
   * refuses is still cancelled: a thumb has no caret, so the only default an
   * arrow, Page, Home or End key has left is scrolling the page.
   */
  protected _onLowThumbKeydown(event: KeyboardEvent): void {
    if (this.computedDisabled()) return;
    const newValue = this._computeKeyValue(event, this._lowValue());
    if (newValue === null) return;
    event.preventDefault();
    if (!this._canWrite()) return;
    const clamped = this.range()
      ? Math.min(newValue, this._highValue())
      : newValue;
    this._setLowValue(clamped);
  }

  /**
   * @protected Handles keydown events on the high thumb (range mode only).
   * Refuses and cancels a key exactly like the low thumb.
   */
  protected _onHighThumbKeydown(event: KeyboardEvent): void {
    if (this.computedDisabled() || !this.range()) return;
    const newValue = this._computeKeyValue(event, this._highValue());
    if (newValue === null) return;
    event.preventDefault();
    if (!this._canWrite()) return;
    const clamped = Math.max(newValue, this._lowValue());
    this._setHighValue(clamped);
  }

  // -------------------------------------------------------------------------
  // Pointer / drag handling
  // -------------------------------------------------------------------------

  /**
   * @protected Handles pointerdown events on the track area to begin thumb
   * dragging. While the slider may not be written it neither jumps a thumb nor
   * starts a drag — no window listeners, no captured pointer, no drag class.
   *
   * The listener sits on the host, which also renders the description and
   * validation message under the track (#320); a press on either is a text
   * selection, not a request to move a thumb, so it is ignored.
   *
   * Only the primary button starts a gesture: a right-click (the context menu)
   * or a middle-click moves no thumb and starts no drag, like every other drag
   * in the library.
   */
  protected _onTrackPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    if (!this._canWrite()) return;
    if (
      event.target instanceof Element &&
      event.target.closest('.mlv-slider__description, .mlv-slider__message')
    ) {
      return;
    }

    // Cache the track rect once per drag so the per-move percent math (track
    // click and every pointermove) avoids a repeated getBoundingClientRect
    // layout read. Cleared on pointerup. The element itself comes from the
    // `viewChild` query, not a DOM lookup.
    this._dragTrackRect =
      this._trackRef()?.nativeElement.getBoundingClientRect() ?? null;

    const target = event.target;
    const thumbElement =
      target instanceof Element
        ? target.closest<HTMLElement>('.mlv-slider__thumb')
        : null;
    if (thumbElement && this._elementRef.nativeElement.contains(thumbElement)) {
      const thumb = (thumbElement.dataset['thumb'] ?? 'low') as 'low' | 'high';
      this._activeDragThumb.set(thumb);
      let captured: Element | null = thumbElement;
      try {
        thumbElement.setPointerCapture(event.pointerId);
      } catch {
        // An inactive pointer (a synthetic event) cannot be captured; the
        // gesture still ends on the window's pointerup / pointercancel.
        captured = null;
      }
      this._attachPointerListeners(event.pointerId, captured);
      return;
    }

    // Click on track — jump the nearest thumb to that position
    const value = this._pointerEventToValue(event);
    if (!this.range()) {
      this._setLowValue(value);
      this._activeDragThumb.set('low');
    } else {
      const lowDist = Math.abs(this._lowValue() - value);
      const highDist = Math.abs(this._highValue() - value);
      if (lowDist <= highDist) {
        this._setLowValue(Math.min(value, this._highValue()));
        this._activeDragThumb.set('low');
      } else {
        this._setHighValue(Math.max(value, this._lowValue()));
        this._activeDragThumb.set('high');
      }
    }
    this._attachPointerListeners(event.pointerId, null);
  }

  /**
   * @private Attaches pointermove/end listeners on the window for drag tracking.
   * During drag the thumb follows the pointer freely (no step snapping) while the
   * emitted value snaps to the nearest step on every move. On pointer release the
   * raw drag position is cleared so the thumb animates to the snapped position.
   *
   * The gesture ends on `pointerup`, `pointercancel` or — for a thumb press —
   * the thumb losing capture (`mlvPointerGestureEnd`). Both streams are scoped
   * to the gesture **and** to the component (`takeUntilDestroyed`), whose
   * `onDestroy` registration is released with the subscription, so a finished
   * drag leaves nothing registered behind.
   *
   * @param pointerId — The `pointerId` of the press that started the drag.
   * @param captureElement — The thumb that captured the pointer, or `null` for
   *   a track press, which captures nothing.
   */
  private _attachPointerListeners(
    pointerId: number,
    captureElement: Element | null,
  ): void {
    const onMove = (e: PointerEvent) => {
      // Permission lost mid-drag (`readonly` or `disabled` flipping on): the
      // thumb stops following the pointer, not only the value. It rests where
      // the last permitted move left it and settles on the value at release.
      if (!this._canWrite()) return;
      const rawPercent = this._pointerToPercent(e);
      const rawValue =
        this.min() + (rawPercent / 100) * (this.max() - this.min());
      const snappedValue = this._snap(this._clamp(rawValue));
      const thumb = this._activeDragThumb();

      if (thumb === 'low') {
        const maxPercent = this.range() ? this._highPercent() : 100;
        const clampedPercent = Math.min(rawPercent, maxPercent);
        this._lowDragPercent.set(clampedPercent);
        this._setLowValue(
          this.range()
            ? Math.min(snappedValue, this._highValue())
            : snappedValue,
        );
      } else if (thumb === 'high') {
        const minPercent = this._lowPercent();
        const clampedPercent = Math.max(rawPercent, minPercent);
        this._highDragPercent.set(clampedPercent);
        this._setHighValue(Math.max(snappedValue, this._lowValue()));
      }
    };

    const onEnd = () => {
      this._lowDragPercent.set(null);
      this._highDragPercent.set(null);
      this._activeDragThumb.set(null);
      // Drop the cached track geometry so the next drag re-measures.
      this._dragTrackRect = null;
      // A press on a thumb focuses it, so focus is still inside: touched waits
      // for focus to leave, as it does for a keyboard user (#347, D22). A
      // press on the track focuses nothing in the slider, so the focus-leave
      // report never hears of that gesture and its end is the only "done"
      // signal a mouse user gives.
      if (!this._focusIsInsideControl()) this._markTouched();
    };

    // The window, as before: a pointer that leaves the page mid-drag still
    // reports its moves and its end there.
    const target: EventTarget = this._document.defaultView ?? this._document;
    const end$ = mlvPointerGestureEnd(target, pointerId, captureElement);
    fromEvent<PointerEvent>(target, 'pointermove')
      .pipe(
        filter((e) => e.pointerId === pointerId),
        takeUntil(end$),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe(onMove);
    end$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe(onEnd);
  }

  // -------------------------------------------------------------------------
  // Private utilities
  // -------------------------------------------------------------------------

  /**
   * @private Converts a keyboard event into a new value, or null if unhandled.
   */
  private _computeKeyValue(
    event: KeyboardEvent,
    currentValue: number,
  ): number | null {
    const min = this.min();
    const max = this.max();
    const step = this.step();
    const pageStep = Math.max(step, (max - min) * 0.1);

    switch (
      this._rtlService.normalizeArrowKey(event, this._direction()) ??
      event.key
    ) {
      case RIGHT_ARROW:
      case UP_ARROW:
        return this._clamp(currentValue + step);
      case LEFT_ARROW:
      case DOWN_ARROW:
        return this._clamp(currentValue - step);
      case 'Home':
        return min;
      case 'End':
        return max;
      case 'PageUp':
        return this._clamp(currentValue + pageStep);
      case 'PageDown':
        return this._clamp(currentValue - pageStep);
      default:
        return null;
    }
  }

  /**
   * @private Converts a pointer event position to a clamped percentage (0–100).
   * Horizontal: inline-start → 0%, inline-end → 100% (the track's right edge
   * is 0% in RTL), matching the logical `inset-inline-start` the thumb,
   * tooltip, ticks and fill are placed with.
   * Vertical: bottom → 0%, top → 100% (inverted Y axis).
   * Does not snap — use this for free drag tracking.
   */
  private _pointerToPercent(event: PointerEvent): number {
    // Reuse the rect cached at pointerdown; fall back to a fresh measurement of
    // the `viewChild` track element if reached outside a drag sequence.
    const rect =
      this._dragTrackRect ??
      this._trackRef()?.nativeElement.getBoundingClientRect() ??
      null;
    if (!rect) return this._valueToPercent(this._lowValue());
    if (this._isVertical()) {
      return Math.min(
        100,
        Math.max(0, (1 - (event.clientY - rect.top) / rect.height) * 100),
      );
    }
    // 0% sits at the inline-start edge, which is the track's right edge in RTL.
    const offset =
      this._direction() === 'rtl'
        ? rect.right - event.clientX
        : event.clientX - rect.left;
    return Math.min(100, Math.max(0, (offset / rect.width) * 100));
  }

  /**
   * @private Converts a pointer event's X position to a clamped, snapped slider value.
   * Used for track clicks (immediate snap) — not for drag moves.
   */
  private _pointerEventToValue(event: PointerEvent): number {
    const percent = this._pointerToPercent(event);
    const rawValue = this.min() + (percent / 100) * (this.max() - this.min());
    return this._snap(this._clamp(rawValue));
  }

  /**
   * @private Converts a value to a percentage between 0 and 100.
   */
  private _valueToPercent(value: number): number {
    const range = this.max() - this.min();
    if (range === 0) return 0;
    return ((value - this.min()) / range) * 100;
  }

  /**
   * @private Clamps a value to [min, max].
   */
  private _clamp(value: number): number {
    return clamp(value, this.min(), this.max());
  }

  /**
   * @private Snaps a value to the nearest step.
   */
  private _snap(value: number): number {
    const step = this.step();
    if (step <= 0) return value;
    const snapped = Math.round((value - this.min()) / step) * step + this.min();
    return this._clamp(snapped);
  }

  /**
   * @private Writes the low/sole thumb while preserving the range shape.
   * Every slider write goes through `_write`, so none lands while the slider is
   * readonly or disabled. A drag that outlives permission also stops moving
   * the thumb itself — see the guard at the top of the drag's `onMove`.
   */
  private _setLowValue(value: number): void {
    if (this.range()) {
      this._writeRange(value, this._highValue());
    } else {
      // A number: the model's own `Object.is` check drops an unchanged one.
      this._write(value);
    }
  }

  /** @private Writes the high thumb while preserving the current low value. */
  private _setHighValue(value: number): void {
    this._writeRange(this._lowValue(), value);
  }

  /**
   * @private Writes a range tuple — unless the model already holds exactly
   * those two ends. A tuple is a fresh array on every write, which the model's
   * `Object.is` check never finds equal, so without this every pointer move
   * inside one step sent an identical `[low, high]` to `valueChange` and the
   * bound form control. Compared against the raw model, not the clamped
   * `_lowValue` / `_highValue`, so an out-of-range bound value is still
   * normalized by the first write that lands on its clamped end.
   */
  private _writeRange(low: number, high: number): void {
    const current = this.value();
    if (
      Array.isArray(current) &&
      Object.is(current[0], low) &&
      Object.is(current[1], high)
    ) {
      return;
    }
    this._write([low, high]);
  }
}
