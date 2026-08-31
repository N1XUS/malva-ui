import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { delay, of } from 'rxjs';
import {
  type BooleanInput,
  coerceBooleanProperty,
} from '@angular/cdk/coercion';
import { MLV_PROGRESS_I18N } from '@malva-ui/i18n';
import type { MlvTone } from '@malva-ui/cdk/utils';

/**
 * Semantic tone for the progress component. Extends the shared {@link MlvTone}
 * vocabulary (`'info' | 'success' | 'warning' | 'danger'`) with a neutral
 * `'default'`.
 */
export type MlvProgressTone = MlvTone | 'default';

/** Visual shape of the progress component. */
export type MlvProgressShape = 'bar' | 'circle';

/** Size variant of the progress component. */
export type MlvProgressSize = 's' | 'm' | 'l';

/** SVG dimensions used for the circle variant. */
interface CircleDimensions {
  /** SVG viewBox string. */
  viewBox: string;
  /** Circle center X/Y coordinate. */
  center: number;
  /** Circle radius. */
  radius: number;
  /** Full stroke circumference. */
  circumference: number;
  /** Stroke width in viewBox units. */
  strokeWidth: number;
}

@Component({
  selector: 'mlv-progress',
  imports: [],
  templateUrl: './progress.html',
  styleUrl: './progress.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-progress',
    '[class]': '_hostClasses()',
    role: 'progressbar',
    '[attr.aria-valuenow]': '_clampedValue()',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuemax]': '100',
    '[attr.aria-label]': '_resolvedAriaLabel()',
  },
})
export class MlvProgress {
  /** Visual shape variant — `'bar'` for a horizontal track, `'circle'` for an SVG ring. */
  readonly shape = input<MlvProgressShape>('bar');

  /**
   * Current progress value between 0 and 100.
   * Clamped to the `[0, 100]` range internally.
   */
  readonly value = input.required<number>();

  /** Size variant controlling track height (bar) or diameter (circle). */
  readonly size = input<MlvProgressSize>('m');

  /** Semantic tone applied to the fill element. */
  readonly tone = input<MlvProgressTone>('default');

  /**
   * When `true`, displays the current value as a percentage text.
   * Bar: appears above the track (right-aligned).
   * Circle: appears centred inside the ring.
   */
  readonly showPercentage = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Custom aria-label override. Falls back to the i18n-provided label. */
  readonly ariaLabel = input<string | undefined>(undefined);

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_PROGRESS_I18N);

  /** @protected Resolved aria-label: explicit input takes precedence over i18n default. */
  protected readonly _resolvedAriaLabel = computed(
    () => this.ariaLabel() ?? this._i18n().progress,
  );

  /** @protected Progress clamped to [0, 100]. */
  protected readonly _clampedValue = computed(() =>
    Math.max(0, Math.min(this.value(), 100)),
  );

  /** @protected Formatted percentage text. */
  protected readonly _percentageText = computed(
    () => `${Math.round(this._clampedValue())}%`,
  );

  /**
   * @protected Delays enabling the CSS fill transition by one tick so the browser
   * has a defined starting state before the transition begins.
   */
  protected readonly _progressVisible = toSignal(of(true).pipe(delay(0)));

  /** @protected Computed circle SVG dimensions based on the size input. */
  protected readonly _circleDimensions = computed<CircleDimensions>(() => {
    const size = this.size();
    // SVG internal coordinate space: 100×100 for all sizes
    const svgSize = 100;
    const strokeWidthMap: Record<MlvProgressSize, number> = {
      s: 10,
      m: 8,
      l: 7,
    };
    const sw = strokeWidthMap[size];
    const center = svgSize / 2;
    const radius = center - sw / 2;
    const circumference = 2 * Math.PI * radius;
    return {
      viewBox: `0 0 ${svgSize} ${svgSize}`,
      center,
      radius,
      circumference,
      strokeWidth: sw,
    };
  });

  /** @protected The stroke-dashoffset for the circle fill, derived from clamped value. */
  protected readonly _strokeDashoffset = computed(() => {
    const { circumference } = this._circleDimensions();
    return circumference * (1 - this._clampedValue() / 100);
  });

  /** @protected Host CSS class string. */
  protected readonly _hostClasses = computed(() => {
    const classes = [
      `mlv-progress--${this.shape()}`,
      `mlv-progress--${this.size()}`,
      `mlv-progress--${this.tone()}`,
    ];
    return classes.join(' ');
  });
}
