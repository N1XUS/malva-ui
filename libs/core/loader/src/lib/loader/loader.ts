import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MLV_LOADER_I18N } from '@malva-ui/i18n';
import type { MlvTone } from '@malva-ui/cdk/utils';

/**
 * Semantic tone of the loader. Extends the shared {@link MlvTone} vocabulary
 * (`'info' | 'success' | 'warning' | 'danger'`) with a neutral `'default'`.
 */
export type MlvLoaderTone = MlvTone | 'default';
import { delay, of } from 'rxjs';

/** Visual variant of the loader. */
export type MlvLoaderVariant = 'bar' | 'circle';

@Component({
  selector: 'mlv-loader',
  imports: [],
  templateUrl: './loader.html',
  styleUrl: './loader.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-loader',
    '[class]': '_hostClasses()',
    role: 'progressbar',
    '[style.--mlv-l-progress]':
      '_determinate() && _progressVisible() ? _percentage() / 100 : null',
    '[style.--mlv-l-diameter]': '_normalizedSize() + "px"',
    '[style.--mlv-l-stroke-width]': 'strokeWidth() + "px"',
    '[style.--mlv-l-color]': 'color() || null',
    '[style.--mlv-l-track-color]': 'trackColor() || null',
    '[attr.aria-valuenow]': '_determinate() ? value() : null',
    '[attr.aria-valuemin]': '_determinate() ? 0 : null',
    '[attr.aria-valuemax]': '_determinate() ? max() : null',
    '[attr.aria-label]': '_resolvedAriaLabel()',
  },
})
export class MlvLoader {
  /** Visual variant — `'bar'` for a horizontal progress bar, `'circle'` for a circular spinner. */
  readonly variant = input<MlvLoaderVariant>('bar');

  /** Semantic tone. Controls the `--mlv-l-color` CSS token. */
  readonly tone = input<MlvLoaderTone>('default');

  /** Current progress value. Used in determinate mode together with `max`. */
  readonly value = input(0);

  /** Maximum progress value. Defaults to `100`. */
  readonly max = input(100);

  /**
   * When `true`, the loader animates continuously without tracking a specific value.
   * Disables all ARIA value attributes (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`).
   */
  readonly indeterminate = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Pixel size of the loader.
   * For `'bar'` variant this sets the track height (defaults to `4`).
   * For `'circle'` variant this sets the diameter (defaults to `48`).
   */
  readonly size = input<number | undefined>(undefined);

  /** Stroke width in pixels for the `'circle'` variant. Defaults to `4`. */
  readonly strokeWidth = input(4);

  /** Custom aria-label override. Falls back to the i18n-provided label. */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * When `true`, displays the current progress percentage as a text hint.
   * For the `'bar'` variant the hint appears above the track.
   * For the `'circle'` variant the hint appears centred inside the ring.
   * Only shown when the loader is in determinate mode (not `indeterminate`).
   */
  readonly showHint = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Custom color override applied directly to `--mlv-l-color`.
   * Accepts any valid CSS color value or a `linear-gradient()` / `url('#paintServerId')` string.
   * When set, takes precedence over the `tone` color.
   */
  readonly color = input<string | undefined>(undefined);

  /**
   * Custom fill color override applied directly to `--mlv-l-track-color`.
   * Accepts any valid CSS color value or a `linear-gradient()` / `url('#paintServerId')` string.
   * When set, takes precedence over the `tone` color.
   */
  readonly trackColor = input<string | undefined>(undefined);

  /**
   * When `true`, adds a shimmer sweep animation over the filled bar / arc.
   * Only applies to the `'bar'` variant in determinate mode.
   * Has no effect in indeterminate mode (the bar is already animated).
   */
  readonly glow = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_LOADER_I18N);

  /** @protected Resolved aria-label: explicit input takes precedence over i18n default. */
  protected readonly _resolvedAriaLabel = computed(
    () => this.ariaLabel() ?? this._i18n().loading,
  );

  /** @protected Resolves the effective pixel size based on `size` input and `variant`. */
  protected readonly _normalizedSize = computed(() => {
    const inputSize = this.size();
    if (inputSize !== undefined) return inputSize;
    return this.variant() === 'bar' ? 4 : 48;
  });

  /**
   * @protected Delays enabling the CSS fill transition by one event loop tick so the
   * browser has a defined starting `stroke-dashoffset` before the transition begins.
   * Starts as `undefined` (falsy) and becomes truthy after the microtask queue drains.
   */
  protected readonly _progressVisible = toSignal(of(true).pipe(delay(0)));

  /** @protected `true` when the loader is in determinate (value-tracking) mode. */
  protected readonly _determinate = computed(() => !this.indeterminate());

  /** @protected Progress as a percentage clamped between 0 and 100. */
  protected readonly _percentage = computed(() => {
    const val = Math.max(0, Math.min(this.value(), this.max()));
    return (val / this.max()) * 100;
  });

  /** @protected Formatted hint text shown when `showHint` is true and mode is determinate. */
  protected readonly _hintText = computed(
    () => `${Math.round(this._percentage())}%`,
  );

  /** @protected Whether the hint should be visible. */
  protected readonly _showHint = computed(
    () => this.showHint() && this._determinate(),
  );

  /** @protected CSS class string applied to the host element. */
  protected readonly _hostClasses = computed(() => {
    const classes = [
      `mlv-loader--${this.variant()}`,
      `mlv-loader--${this.tone()}`,
    ];
    if (this.indeterminate()) {
      classes.push('mlv-loader--indeterminate');
    }
    if (this.glow()) {
      classes.push('mlv-loader--glow');
    }
    return classes.join(' ');
  });
}
