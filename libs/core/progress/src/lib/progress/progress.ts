import {
  afterEveryRender,
  type AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { delay, of } from 'rxjs';
import {
  type BooleanInput,
  coerceBooleanProperty,
} from '@angular/cdk/coercion';
import { MLV_PROGRESS_I18N } from '@malva-ui/i18n';
import { mlvNextId, type MlvTone } from '@malva-ui/cdk/utils';

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
    '[attr.aria-labelledby]': '_labelledBy()',
    '[attr.aria-label]': '_resolvedAriaLabel()',
  },
})
export class MlvProgress implements AfterViewChecked {
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

  /**
   * Explicit accessible name, written to the host as `aria-label`. Wins over
   * everything else: while it is set, projected content is only visible text
   * and names nothing. Leave it unset and the projected label names the
   * progressbar through `aria-labelledby` whenever it has text; with neither,
   * the i18n default (`MLV_PROGRESS_I18N.progress`, "Progress") applies. When
   * you set it next to a visible label, include that label's text (WCAG 2.5.3,
   * label in name), e.g. `ariaLabel="Storage usage"` around "Storage".
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_PROGRESS_I18N);

  /**
   * @protected Id of the label wrapper — the target of `aria-labelledby` while
   * it has text. Per instance, so two progressbars never share one.
   */
  protected readonly _labelId = mlvNextId('mlv-progress-label');

  /** @private The label wrapper holding the one `<ng-content>` slot. */
  private readonly _labelEl =
    viewChild.required<ElementRef<HTMLElement>>('label');

  /**
   * @private Whether the label wrapper currently carries non-whitespace text.
   * Written only by {@link _syncLabel}, from the DOM, because projected text
   * belongs to the consumer's view and no signal in this component can depend
   * on it.
   */
  private readonly _hasLabel = signal(false);

  /**
   * @protected `aria-labelledby` for the host: the label wrapper while it has
   * text and no explicit `ariaLabel` was given, else `null`. The projected text
   * is the progressbar's visible label, so it becomes the accessible name
   * (WCAG 2.5.3). The wrapper stays `aria-hidden`: a labelledby reference
   * reads a hidden node's text all the same, and hiding it keeps that text
   * from also being exposed as a separate node under the progressbar.
   *
   * An explicit `ariaLabel` suppresses it — not accessible-name order, which
   * would rank `aria-labelledby` first if both were emitted (they never are),
   * but the library's own rule for a label generated from DOM text: `mlv-drawer`
   * and `mlv-dialog` drop their header-title `aria-labelledby` for an explicit
   * `ariaLabel` the same way. It is also the only way to give a name richer
   * than the visible text ("CPU usage" around "CPU").
   */
  protected readonly _labelledBy = computed(() =>
    this.ariaLabel() === undefined && this._hasLabel() ? this._labelId : null,
  );

  /**
   * @protected Resolved `aria-label`: `null` while {@link _labelledBy} names the
   * host, so the two naming attributes are never emitted together; otherwise
   * the explicit input, then the i18n default.
   */
  protected readonly _resolvedAriaLabel = computed(() =>
    this._labelledBy() === null
      ? (this.ariaLabel() ?? this._i18n().progress)
      : null,
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

  constructor() {
    // Projected text lives in the consumer's view, so it can change without
    // this component's view being checked — a projected OnPush child that
    // re-renders its own text refreshes that child alone, and the view hook
    // below never runs. `afterEveryRender` sees every such render (and never
    // runs on the server, which is what the hook is for).
    afterEveryRender(() => this._syncLabel());
  }

  /**
   * Re-reads the label wrapper after each check of this view. Runs on the
   * server too — unlike `afterEveryRender` — so server-rendered markup already
   * carries the right naming attribute, and on the client it settles the name
   * inside the same change detection pass that changed the text.
   */
  ngAfterViewChecked(): void {
    this._syncLabel();
  }

  /**
   * @private Mirrors "the label wrapper has text" into {@link _hasLabel}.
   * `textContent` skips comment nodes (the anchors an `@if` leaves behind) and
   * the trim ignores whitespace-only projection. It does count text inside an
   * `aria-hidden` descendant, deliberately: the wrapper is itself hidden and
   * directly referenced, so accessible-name computation reads that text too
   * and the host is named by it rather than left unnamed. Setting a signal to
   * the value it already holds notifies nothing, so repeat reads cannot loop.
   */
  private _syncLabel(): void {
    this._hasLabel.set(!!this._labelEl().nativeElement.textContent?.trim());
  }
}
