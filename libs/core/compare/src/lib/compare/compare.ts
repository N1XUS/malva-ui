import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  Renderer2,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { LucideChevronsLeftRight, LucideChevronsUpDown } from '@lucide/angular';
import { clamp, MlvRtlService } from '@malva-ui/cdk/utils';
import { MLV_COMPARE_I18N } from '@malva-ui/i18n';
import type { MlvCompareHandleContext } from '../compare-handle-def';
import { MlvCompareHandleDef } from '../compare-handle-def';

/** Axis along which the divider travels. */
export type MlvCompareOrientation = 'horizontal' | 'vertical';

/** Lower bound of `value` — the divider sits on the inline-start / top edge. */
const MIN_VALUE = 0;

/** Upper bound of `value` — the divider sits on the inline-end / bottom edge. */
const MAX_VALUE = 100;

/** Multiplier applied to `step` for Shift+Arrow and PageUp / PageDown. */
const LARGE_STEP_FACTOR = 10;

/**
 * Before/after comparison surface — two stacked content layers split by a
 * draggable divider. The share of the surface showing the *before* layer is
 * the two-way `value` (0–100, measured from the inline-start edge, or the top
 * edge when `orientation="vertical"`).
 *
 * Interaction model:
 *
 * - **Pointer** — press anywhere on the surface to jump the divider there and
 *   keep dragging; the surface owns the whole gesture, so projected content is
 *   display-only. `slideOnHover` steers the divider from the hovering pointer
 *   instead (useful for reveal-style charts driven through a controlled
 *   `value`).
 * - **Keyboard / assistive tech** — a visually hidden native
 *   `<input type="range">` carries the slider semantics (`aria-valuenow`,
 *   `aria-valuetext`, `aria-orientation`, the accessible name). Arrow keys move
 *   by `step`, Shift+Arrow / PageUp / PageDown by ten steps, Home / End to
 *   either edge. Horizontal arrows mirror in RTL through `MlvRtlService`.
 *
 * Slots: `[mlvCompareBefore]`, `[mlvCompareAfter]` and an optional
 * `*mlvCompareHandleDef` template replacing the default Lucide chevrons
 * (`chevrons-left-right`, or `chevrons-up-down` when vertical) inside the
 * handle; its context carries `orientation` and `dragging`. Optional
 * `beforeLabel` / `afterLabel` captions are pinned to the corners of their
 * own layer, so each shows only while its side does. The look of the divider, handle and
 * captions (size, radius, colours, shadow) is themed through `--mlv-compare-*`
 * custom properties, not inputs.
 *
 * @example
 * ```html
 * <mlv-compare
 *   [(value)]="position"
 *   beforeLabel="Untouched"
 *   afterLabel="Graded"
 *   ariaLabel="Colour grade"
 * >
 *   <img mlvCompareBefore src="raw.jpg" alt="Untouched photograph" />
 *   <img mlvCompareAfter src="graded.jpg" alt="Colour-graded photograph" />
 * </mlv-compare>
 * ```
 */
@Component({
  selector: 'mlv-compare',
  templateUrl: './compare.html',
  styleUrl: './compare.scss',
  imports: [NgTemplateOutlet, LucideChevronsLeftRight, LucideChevronsUpDown],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-compare',
    '[class.mlv-compare--vertical]': '_isVertical()',
    '[class.mlv-compare--hover]': 'slideOnHover()',
    '[class.mlv-compare--dragging]': '_dragging()',
    '[style.--mlv-compare-value]': '_cssValue()',
    '(pointerdown)': '_onPointerDown($event)',
    '(pointerenter)': '_onPointerEnter()',
    '(pointerleave)': '_onPointerLeave()',
  },
})
export class MlvCompare {
  /**
   * Axis the divider travels along. `'vertical'` stacks *before* above
   * *after* and reads the block axis for pointer and keyboard input.
   */
  readonly orientation = input<MlvCompareOrientation>('horizontal');

  /**
   * Steer the divider from the hovering pointer instead of press-and-drag.
   * Pressing and dragging keep working; touch input still scrubs while the
   * finger is down. Reflected as `mlv-compare--hover` on the host.
   */
  readonly slideOnHover = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Keyboard increment in percentage points for a plain arrow key. Shift+Arrow,
   * PageUp and PageDown move by ten steps. Non-positive or missing values fall
   * back to `1`. Pointer input is continuous and unaffected.
   */
  readonly step = input<number, number | null | undefined>(1, {
    transform: (value) => (typeof value === 'number' && value > 0 ? value : 1),
  });

  /**
   * Two-way divider position: the percentage of the surface, measured from
   * the inline-start edge (top edge when vertical), that shows the *before*
   * layer. Rendering clamps to 0–100; an out-of-range bound value is never
   * written back, so a controlled binding keeps its own source of truth.
   */
  readonly value = model<number>(50);

  /**
   * Accessible name for the slider when no visible label element exists.
   * Falls back to the translated `compare.ariaLabel` string. Ignored while
   * `ariaLabelledby` is set.
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * Id of a visible element labelling the slider. Takes precedence over
   * `ariaLabel` and the translated fallback.
   */
  readonly ariaLabelledby = input<string | undefined>(undefined);

  /**
   * Optional caption pinned to the start corner of the *before* layer
   * (inline-start / top). Rendered as visible text inside that layer: the
   * *after* layer covers it as the divider passes, so it only ever labels the
   * side that shows. Nothing renders while empty. Themed through the
   * `--mlv-compare-label-*` custom properties.
   */
  readonly beforeLabel = input<string | undefined>(undefined);

  /**
   * Optional caption pinned to the end corner of the *after* layer —
   * inline-end when horizontal, the bottom when vertical, so it always sits
   * where that layer is visible. Same rendering rules as `beforeLabel`.
   */
  readonly afterLabel = input<string | undefined>(undefined);

  /** @protected Translated strings for the fallback accessible name. */
  protected readonly _i18n = inject(MLV_COMPARE_I18N);

  /** @private Mirrors horizontal arrow keys and pointer geometry in RTL. */
  private readonly _rtlService = inject(MlvRtlService);

  /** @private Host element — the geometry every pointer position is read against. */
  private readonly _hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * @private Attaches the gesture listeners outside the template, so they
   * exist only while a drag or a hover pass is running.
   */
  private readonly _renderer = inject(Renderer2);

  /**
   * @private Direction applying to this host, following any `[dir]` scope
   * above it. Decides which inline edge is 0%.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._hostRef,
  );

  /** @private The hidden native range input carrying keyboard focus and ARIA. */
  private readonly _inputRef =
    viewChild.required<ElementRef<HTMLInputElement>>('input');

  /** @protected True when the divider travels along the block axis. */
  protected readonly _isVertical = computed(
    () => this.orientation() === 'vertical',
  );

  /** @protected Bound value clamped for rendering; never written back. */
  protected readonly _position = computed(() =>
    clamp(this.value(), MIN_VALUE, MAX_VALUE),
  );

  /** @protected `--mlv-compare-value` — the single geometry input the stylesheet reads. */
  protected readonly _cssValue = computed(() => `${this._position()}%`);

  /** @protected Integer value the native range input carries (`aria-valuenow`). */
  protected readonly _ariaValue = computed(() => Math.round(this._position()));

  /** @protected Human-readable value announced by assistive technology. */
  protected readonly _ariaValueText = computed(() => `${this._ariaValue()}%`);

  /**
   * @protected `aria-label` for the range input: the consumer's label, else
   * the translated fallback — or nothing at all once `ariaLabelledby` names a
   * visible label, so the two never compete.
   */
  protected readonly _resolvedAriaLabel = computed(() =>
    this.ariaLabelledby() ? null : this.ariaLabel() || this._i18n().ariaLabel,
  );

  /** @protected True while a primary-button press is steering the divider. */
  protected readonly _dragging = signal(false);

  /**
   * @internal Optional `*mlvCompareHandleDef` template replacing the default
   * chevron glyph inside the handle.
   */
  protected readonly _handleDef = contentChild(MlvCompareHandleDef);

  /**
   * @internal Context handed to the handle template: the live orientation and
   * whether a pointer drag is in progress, so a custom handle can react.
   */
  protected readonly _handleContext = computed<MlvCompareHandleContext>(() => {
    const orientation = this.orientation();
    return { $implicit: orientation, orientation, dragging: this._dragging() };
  });

  /**
   * @private Surface rect cached for the lifetime of a drag or a hover pass so
   * `pointermove` never forces a layout read. Dropped on release / leave.
   */
  private _rect: DOMRect | null = null;

  /** @private Pointer that started the current drag; other pointers are ignored. */
  private _pointerId: number | null = null;

  /** @private Detaches the window / host listeners of the drag in progress. */
  private _releaseDrag: (() => void) | null = null;

  /** @private Detaches the host `pointermove` listener of the hover pass in progress. */
  private _releaseHover: (() => void) | null = null;

  constructor() {
    // A destroy mid-gesture must not leave window listeners behind.
    inject(DestroyRef).onDestroy(() => {
      this._releaseDrag?.();
      this._releaseHover?.();
    });
  }

  // ─── Pointer ────────────────────────────────────────────────────────────────

  /**
   * @protected Starts a drag: measures the surface once, captures the pointer
   * so the gesture survives leaving the host, attaches the move / end
   * listeners for the life of the gesture, moves keyboard focus onto the
   * range input so arrow keys take over seamlessly, and jumps the divider to
   * the press position. A second contact during a drag is ignored so the
   * divider never jumps between fingers.
   */
  protected _onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this._dragging()) return;

    this._rect = this._measure();
    this._pointerId = event.pointerId;
    this._dragging.set(true);
    try {
      this._hostRef.nativeElement.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic or already-released pointer id cannot be captured. The
      // window listeners below still follow and end the gesture.
    }
    this._listenForDrag();
    this._inputRef().nativeElement.focus({ preventScroll: true });
    this._setFromPointer(event);
    // Suppresses native image drag, text selection and the compatibility
    // mouse events that would otherwise steal focus back.
    event.preventDefault();
  }

  /**
   * @private Follows and ends the drag from the window rather than the host.
   * Nothing is attached while idle — a host `pointermove` binding would
   * schedule change detection on every idle mouse move — and a release
   * outside the host, or one after a failed capture, still ends the gesture.
   * Moves from any other pointer are ignored.
   */
  private _listenForDrag(): void {
    const onMove = (event: PointerEvent) => {
      if (event.pointerId === this._pointerId) this._setFromPointer(event);
    };
    const onEnd = (event: PointerEvent) => this._endDrag(event);
    const disposers = [
      this._renderer.listen('window', 'pointermove', onMove),
      this._renderer.listen('window', 'pointerup', onEnd),
      this._renderer.listen('window', 'pointercancel', onEnd),
      this._renderer.listen(
        this._hostRef.nativeElement,
        'lostpointercapture',
        onEnd,
      ),
    ];
    this._releaseDrag = () => {
      for (const dispose of disposers) dispose();
      this._releaseDrag = null;
    };
  }

  /** @private Ends the drag on release, cancellation or lost capture. */
  private _endDrag(event: PointerEvent): void {
    if (!this._dragging() || event.pointerId !== this._pointerId) return;
    this._dragging.set(false);
    this._pointerId = null;
    this._rect = null;
    this._releaseDrag?.();
  }

  /**
   * @protected Starts a hover pass when `slideOnHover` is set: primes the
   * geometry cache and follows the pointer until it leaves. The move listener
   * exists only between enter and leave, so an idle surface costs nothing.
   */
  protected _onPointerEnter(): void {
    if (!this.slideOnHover() || this._releaseHover) return;
    this._rect = this._measure();
    this._releaseHover = this._renderer.listen(
      this._hostRef.nativeElement,
      'pointermove',
      (event: PointerEvent) => {
        // A drag in progress owns the pointer; hovering must not fight it.
        if (!this._dragging() && this.slideOnHover())
          this._setFromPointer(event);
      },
    );
  }

  /**
   * @protected Ends the hover pass and drops its geometry cache unless a drag
   * still owns it.
   */
  protected _onPointerLeave(): void {
    this._releaseHover?.();
    this._releaseHover = null;
    if (!this._dragging()) this._rect = null;
  }

  // ─── Keyboard / native input ────────────────────────────────────────────────

  /**
   * @protected Keyboard model of the WAI-ARIA slider pattern on top of the
   * native range input. Handled keys are consumed so the browser's own
   * stepping never runs a second time; anything else passes through.
   */
  protected _onKeydown(event: KeyboardEvent): void {
    const step = this.step();
    const large = step * LARGE_STEP_FACTOR;
    const delta = event.shiftKey ? large : step;
    // Vertical: the divider moves *down* as the value grows, so ArrowDown
    // increases. Horizontal keeps the native range convention (Up increases).
    const blockSign = this._isVertical() ? -1 : 1;
    const current = this._position();
    let next: number;

    switch (this._rtlService.normalizeArrowKey(event) ?? event.key) {
      case RIGHT_ARROW:
        next = current + delta;
        break;
      case LEFT_ARROW:
        next = current - delta;
        break;
      case UP_ARROW:
        next = current + blockSign * delta;
        break;
      case DOWN_ARROW:
        next = current - blockSign * delta;
        break;
      case 'PageUp':
        next = current + large;
        break;
      case 'PageDown':
        next = current - large;
        break;
      case 'Home':
        next = MIN_VALUE;
        break;
      case 'End':
        next = MAX_VALUE;
        break;
      default:
        return;
    }

    event.preventDefault();
    this._commit(next);
  }

  /**
   * @protected Syncs a value assistive technology wrote straight into the
   * native range (e.g. a screen reader's adjust gesture) into the model.
   */
  protected _onNativeInput(event: Event): void {
    const next = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(next)) this._commit(next);
  }

  // ─── Private utilities ──────────────────────────────────────────────────────

  /** @private Reads the host's current box. One layout read per gesture. */
  private _measure(): DOMRect {
    return this._hostRef.nativeElement.getBoundingClientRect();
  }

  /**
   * @private Converts a pointer position into a value along the active axis.
   * `clientX` / `clientY` are physical, so the inline offset is taken from the
   * inline-start edge — the right edge in RTL. The block axis never mirrors.
   */
  private _setFromPointer(event: PointerEvent): void {
    const rect = (this._rect ??= this._measure());
    let ratio: number;
    if (this._isVertical()) {
      if (rect.height <= 0) return;
      ratio = (event.clientY - rect.top) / rect.height;
    } else {
      if (rect.width <= 0) return;
      const offset =
        this._direction() === 'rtl'
          ? rect.right - event.clientX
          : event.clientX - rect.left;
      ratio = offset / rect.width;
    }
    this._commit(clamp(ratio, 0, 1) * MAX_VALUE);
  }

  /**
   * @private Clamps, rounds to two decimals (clean `valueChange` payloads,
   * no float drift from repeated steps) and writes the model only on change.
   */
  private _commit(next: number): void {
    const rounded = Math.round(clamp(next, MIN_VALUE, MAX_VALUE) * 100) / 100;
    if (rounded !== this.value()) this.value.set(rounded);
  }
}
