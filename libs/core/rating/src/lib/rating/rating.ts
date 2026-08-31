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
  ViewEncapsulation,
} from '@angular/core';
import { coerceNumberProperty } from '@angular/cdk/coercion';
import { DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
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
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Effective direction of this rating, tracking the global direction
   * and any `[dir]` scope above the host. Mirrors half-star hit testing.
   */
  private readonly _direction = this._rtlService.elementDirection(
    inject(ElementRef<HTMLElement>),
  );

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

  /** Tracks the hover preview value (0 = not hovering). */
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
   * `inset(0 {remainder}% 0 0)` clips the right side.
   */
  protected _clipPath(starIndex: number): string {
    const remainder = 100 - this._getFillPercent(starIndex);
    return `inset(0 ${remainder}% 0 0)`;
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

  /** @internal */
  protected _onStarMouseMove(starIndex: number, event: MouseEvent): void {
    if (this.readonly() || this.computedDisabled()) return;
    const el = event.currentTarget as HTMLElement;
    this._hoverValue.set(
      this.step() === 0.5 && this._isLeadingHalf(event, el)
        ? starIndex - 0.5
        : starIndex,
    );
  }

  /** @internal */
  protected _onStarClick(starIndex: number, event: MouseEvent): void {
    if (this.readonly() || this.computedDisabled()) return;
    const el = event.currentTarget as HTMLElement;
    const newValue =
      this.step() === 0.5 && this._isLeadingHalf(event, el)
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

    switch (this._rtlService.normalizeArrowKey(event) ?? event.key) {
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
    }
  }

  /** @internal */
  protected _onStarFocus(starIndex: number): void {
    this._hoverValue.set(starIndex);
  }

  /** @internal */
  protected _onStarBlur(): void {
    this._hoverValue.set(0);
    this._markTouched();
  }
}
