import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  signal,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { coerceNumberProperty } from '@angular/cdk/coercion';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import type { MlvFormControl } from '@malva-ui/core/form-utils';
import {
  MlvSignalFormControlBase,
  MLV_FORM_CONTROL,
} from '@malva-ui/core/form-utils';
import { LucideStar } from '@lucide/angular';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MLV_RATING_I18N, MlvI18nResolverService } from '@malva-ui/i18n';

/**
 * Star rating component with half-star precision and read-only mode.
 *
 * Extends {@link MlvSignalFormControlBase}, inheriting the shared `disabled`,
 * `readonly`, `state`, `id`, `label`, `hint` and `message` inputs plus the
 * signal-forms field contract.
 *
 * - Hover preview highlights stars up to the cursor.
 * - Half-star precision via clip-path technique when `step="0.5"`.
 * - Keyboard: ArrowRight/ArrowLeft step up/down, Home for min, End for max.
 *   Focus and fill follow the value: the star covering it takes focus and the
 *   single tab stop.
 * - Integrates with signal, reactive, and template-driven Angular forms.
 *
 * @example Basic
 * ```html
 * <mlv-rating [max]="5" [(ngModel)]="rating" />
 * ```
 *
 * @example Half-star precision
 * ```html
 * <mlv-rating [step]="0.5" [formField]="ratingForm.score" />
 * ```
 *
 * @example Read-only display
 * ```html
 * <mlv-rating [value]="4.5" [readonly]="true" />
 * ```
 */
@Component({
  selector: 'mlv-rating',
  templateUrl: './rating.html',
  styleUrl: './rating.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideStar],
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvRating),
    },
  ],
  host: {
    class: 'mlv-rating',
    '[class]': '"mlv-rating--state-" + resolvedState()',
    '[class.mlv-rating--readonly]': 'readonly()',
    '[class.mlv-rating--disabled]': 'computedDisabled()',
    '[attr.id]': 'id()',
    '[attr.role]': '"group"',
    '[attr.aria-label]': '_i18n().rating',
    '[attr.aria-disabled]': 'computedDisabled() || null',
    '(mouseleave)': '_onHostMouseLeave()',
    '(keydown)': '_onHostKeydown($event)',
    '[attr.tabindex]': 'readonly() || computedDisabled() ? null : -1',
  },
})
export class MlvRating
  extends MlvSignalFormControlBase<number>
  implements MlvFormControl
{
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_RATING_I18N);

  /** @private Resolver for ICU parameterized i18n strings. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /**
   * @private Direction service backing `_direction` and the RTL-aware arrow-key
   * normalisation in `_onHostKeydown`.
   *
   * Both are scoped to {@link _elementRef}: `_direction` resolves per element,
   * and `normalizeArrowKey` is handed that same cached signal, so the paint,
   * the hit test and the keyboard model can never disagree inside a `[dir]`
   * subtree — or inside an overlay pane, which CDK stamps with its own `dir`
   * (#147).
   */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Host element — the delegation root for the hover listener, and the
   * scope every direction-aware half of this component resolves against.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /**
   * @private Effective direction of this rating, tracking the global direction
   * and any `[dir]` scope above the host. Mirrors both halves of half-star
   * precision — the hit test in {@link _isLeadingHalf} and the fill side in
   * {@link _clipPath} — which have to agree on which half of a star leads.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._elementRef,
  );

  constructor() {
    super();

    // `mousemove` is bound here rather than as a `(mousemove)` binding on each
    // star. A template listener is wrapped in
    // `wrapListenerIn_markDirtyAndPreventDefault`, which marks the ancestor
    // view chain dirty and notifies the change-detection scheduler on **every**
    // event — hundreds per hover sweep — before it knows whether the handler
    // changed anything. Sweeping one star writes `_hoverValue` with the value
    // it already holds for all but the first event, and a signal set to an
    // unchanged value notifies nothing, so `fromEvent` makes the rest free.
    //
    // One delegated listener on the host replaces `max()` per-star listeners.
    // `mousemove` bubbles, and `event.target` is the star `<button>` in both
    // forms — the two icon layers are `pointer-events: none`, so the hit test
    // falls through to the button. That is what keeps `event.offsetX`, read by
    // `_isLeadingHalf`, measured against the same box as `star.offsetWidth`,
    // and unchanged by the move to delegation.
    fromEvent<MouseEvent>(this._elementRef.nativeElement, 'mousemove')
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this._onStarMouseMove(event));
  }

  /**
   * @private Whether the pointer is over the leading (lower-value) half of a
   * star. `offsetX` is always measured from the physical left edge, so RTL —
   * where the leading half is the right one — has to mirror it.
   */
  private _isLeadingHalf(event: MouseEvent, star: HTMLElement): boolean {
    const half = star.offsetWidth / 2;
    return this._direction() === 'rtl'
      ? event.offsetX > half
      : event.offsetX < half;
  }

  /**
   * Total number of stars.
   * @default 5
   */
  readonly max = input<number, number | string | null | undefined>(5, {
    transform: (value) =>
      Math.max(1, Math.floor(coerceNumberProperty(value, 5))),
  });

  /**
   * Step increment — `1` for whole stars, `0.5` for half-star precision.
   * @default 1
   */
  readonly step = input<1 | 0.5, number | null | undefined>(1, {
    transform: (value) => (value === 0.5 ? 0.5 : 1),
  });

  // ── Internal state ─────────────────────────────────────────────────────────

  /**
   * The committed rating — the signal-forms `FormValueControl` model. Kept in
   * sync by `[formField]`, `[formControl]`, and `ngModel` bindings.
   */
  readonly value = model(0);

  /**
   * Tracks the pointer's hover preview value (0 = not hovering).
   *
   * Pointer-only. Focus used to write it too, pinning the preview to the
   * focused star, and because it outranks `value()` in {@link _displayValue}
   * the fill then ignored every arrow key (#314). With a roving tab stop the
   * focused star is derived from the value anyway, so a focus preview could
   * only ever repeat the value or contradict it — a half value showed as the
   * whole star above it, and an unrated control showed one star. A keyboard
   * change clears it, so the newer input is the one on screen.
   */
  protected readonly _hoverValue = signal<number>(0);

  /** The value visually displayed — hover preview takes precedence. */
  protected readonly _displayValue = computed(
    () => this._hoverValue() || this.value(),
  );

  /** Indices `[0 … max-1]` for `@for` iteration. */
  protected readonly _indices = computed(() =>
    Array.from({ length: this.max() }, (_, i) => i),
  );

  /**
   * The 0-based index of the star that is in the tab order (roving tabindex).
   * The star covering the current value is tabbable; when no value is set the
   * first star is. All other stars are removed from the tab order so the rating
   * is a single tab stop, with Arrow keys moving between values.
   */
  protected readonly _activeIndex = computed(() => {
    const value = this.value();
    if (value <= 0) return 0;
    return Math.min(this.max() - 1, Math.ceil(value) - 1);
  });

  /**
   * @private The star `<button>`s in order, for moving focus onto the one
   * holding the roving tab stop after a keyboard change.
   */
  private readonly _stars = viewChildren<ElementRef<HTMLButtonElement>>('star');

  /**
   * @private `true` only for the duration of the `focus()` call in
   * {@link _focusActiveStar}. The star losing focus to it is not the user
   * leaving the control, so its `blur` must not mark the field touched — the
   * arrow keys never moved focus before #314, and touched still waits for
   * focus to leave the rating. `focus()` dispatches `blur` synchronously, so
   * the flag cannot outlive the move it describes.
   */
  private _movingFocusBetweenStars = false;

  /** Whether the control holds a clearable value — A non-zero rating is set. */
  readonly hasValue = computed(() => this.value() > 0);

  // ── Fill calculation ────────────────────────────────────────────────────────

  /**
   * Returns the percentage of star `starIndex` (1-indexed) that should be filled.
   * 100 = full, 50 = half, 0 = empty.
   */
  protected _getFillPercent(starIndex: number): number {
    const display = this._displayValue();
    if (display >= starIndex) return 100;
    if (display >= starIndex - 0.5) return 50;
    return 0;
  }

  /**
   * Returns the CSS `clip-path` value for the filled star overlay.
   *
   * Direction-dependent: `inset()` takes physical `top right bottom left`
   * offsets and has no logical form, so the side to eat from has to be chosen
   * here. The star row is a plain `flex-direction: row`, so it follows the
   * inline base direction and a star's leading (lower-value) half is its
   * physical left half in LTR and its right half in RTL. The remainder is
   * therefore inset from the right in LTR and from the left in RTL — the same
   * `_direction()` `_isLeadingHalf` mirrors the hit test with, so the half
   * the pointer selects is the half that gets painted.
   */
  protected _clipPath(starIndex: number): string {
    const remainder = 100 - this._getFillPercent(starIndex);
    return this._direction() === 'rtl'
      ? `inset(0 0 0 ${remainder}%)`
      : `inset(0 ${remainder}% 0 0)`;
  }

  /**
   * @internal Resolves the per-star aria-label, e.g. "Rate 3 out of 5".
   * @param starIndex 1-based star number.
   */
  protected _rateLabel(starIndex: number): string {
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'rateValue',
      { value: starIndex, max: this.max() },
    );
  }

  /**
   * @internal Roving tabindex for star `index` (0-based): `0` for the active
   * star, `-1` for the rest. Always `-1` when read-only or disabled.
   */
  protected _starTabIndex(index: number): number {
    if (this.readonly() || this.computedDisabled()) return -1;
    return index === this._activeIndex() ? 0 : -1;
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  /**
   * @private Updates the hover preview from a delegated `mousemove`.
   *
   * Pointer moves that land between stars resolve to no star and are ignored,
   * matching the per-star binding this replaced.
   */
  private _onStarMouseMove(event: MouseEvent): void {
    if (this.readonly() || this.computedDisabled()) return;

    const target = event.target;
    const star =
      target instanceof Element
        ? target.closest<HTMLElement>('.mlv-rating__star')
        : null;
    if (!star) return;

    const starIndex = this._starPosition(star);
    if (starIndex === 0) return;

    this._hoverValue.set(
      this.step() === 0.5 && this._isLeadingHalf(event, star)
        ? starIndex - 0.5
        : starIndex,
    );
  }

  /**
   * @private One-based position of a star among its siblings, or `0` when the
   * element is not one of this rating's stars. The stars are the host's only
   * element children and are rendered in ascending order by `@for`.
   */
  private _starPosition(star: HTMLElement): number {
    const siblings = star.parentElement?.children;
    if (!siblings) return 0;
    return Array.prototype.indexOf.call(siblings, star) + 1;
  }

  /**
   * @internal Commits the clicked star, or its leading half under half-star
   * precision.
   *
   * The half test needs a pointer position, and only a pointer click has one:
   * `detail` is the click count, so `0` means Enter / Space on the focused
   * star or a script `click()`. Chrome sends those with `offsetX` 0, which
   * `_isLeadingHalf` reads as the leading half in LTR and the trailing half in
   * RTL — so Enter on "Rate 3 out of 5" committed 2.5 in LTR only. With no
   * pointer, the whole star its label names is committed.
   */
  protected _onStarClick(starIndex: number, event: MouseEvent): void {
    if (this.readonly() || this.computedDisabled()) return;
    const el = event.currentTarget as HTMLElement;
    const newValue =
      this.step() === 0.5 && event.detail > 0 && this._isLeadingHalf(event, el)
        ? starIndex - 0.5
        : starIndex;
    this.value.set(newValue);
  }

  /** @internal */
  protected _onHostMouseLeave(): void {
    this._hoverValue.set(0);
  }

  /** @internal */
  protected _onHostKeydown(event: KeyboardEvent): void {
    if (this.readonly() || this.computedDisabled()) return;
    const current = this.value();
    const stepSize = this.step();
    let next: number | null = null;

    switch (
      this._rtlService.normalizeArrowKey(event, this._direction()) ??
      event.key
    ) {
      case RIGHT_ARROW:
      case UP_ARROW:
        next = Math.min(this.max(), current + stepSize);
        break;
      case LEFT_ARROW:
      case DOWN_ARROW:
        next = Math.max(0, current - stepSize);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = this.max();
        break;
      default:
        return;
    }

    if (next !== null) {
      event.preventDefault();
      this.value.set(next);
      this._hoverValue.set(0);
      this._focusActiveStar();
    }
  }

  /**
   * @private Moves focus onto the star holding the roving tab stop, so focus
   * follows the stop the arrow keys just moved instead of staying on a star
   * that is now `tabindex="-1"` (#314).
   *
   * Only when focus is already inside this rating — on a star, or on the
   * `tabindex="-1"` host a click between two stars focuses. A keydown reaching
   * the host while focus is elsewhere (a script-dispatched event) changes the
   * value and leaves focus where it is. The focused element is read from the
   * host's own root, so a rating inside a shadow root sees the star and not
   * the shadow host.
   */
  private _focusActiveStar(): void {
    const host = this._elementRef.nativeElement;
    const focused = (host.getRootNode() as Partial<DocumentOrShadowRoot>)
      .activeElement;
    if (!focused || !host.contains(focused)) return;

    const star = this._stars()[this._activeIndex()]?.nativeElement;
    if (!star || star === focused) return;

    this._movingFocusBetweenStars = true;
    try {
      star.focus();
    } finally {
      this._movingFocusBetweenStars = false;
    }
  }

  /** @internal */
  protected _onStarBlur(): void {
    this._hoverValue.set(0);
    if (!this._movingFocusBetweenStars) this._markTouched();
  }
}
