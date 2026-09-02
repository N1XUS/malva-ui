import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { MlvCompare } from '@malva-ui/core/compare';
import { MlvThemeService } from '@malva-ui/core/layout';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Monthly recurring revenue, k€ — the plan committed in January. */
const PLAN = [42, 45, 47, 50, 52, 55, 58, 60, 63, 66, 68, 72];

/** What the year actually did. */
const ACTUAL = [40, 44, 49, 47, 55, 61, 58, 66, 71, 69, 78, 84];

const RANGE = { min: 30, max: 90 };
const PADDING = { top: 28, right: 24, bottom: 36, left: 48 };

interface Palette {
  accent: string;
  neutral: string;
  grid: string;
  text: string;
  surface: string;
  family: string;
}

type SeriesKind = 'plan' | 'actual';

@Component({
  selector: 'docs-compare-chart-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCompare],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class CompareChartExampleComponent {
  /** Starts at 0 — all plan. Sweeping the pointer reveals the actuals. */
  readonly position = signal(0);

  readonly rounded = computed(() => Math.round(this.position()));

  /** Month whose actuals the divider has reached, for the live readout. */
  readonly revealedThrough = computed(() => {
    const index = Math.min(
      MONTHS.length - 1,
      Math.floor((this.position() / 100) * MONTHS.length),
    );
    return this.position() <= 0 ? null : MONTHS[index];
  });

  private readonly _theme = inject(MlvThemeService);
  private readonly _resizeObserver = inject(MlvResizeObserverService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _surface = viewChild.required<
    MlvCompare,
    ElementRef<HTMLElement>
  >('surface', { read: ElementRef });
  private readonly _actualCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('actual');
  private readonly _planCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('plan');

  /** Surface box in CSS pixels; the canvases are drawn at exactly this size. */
  private readonly _size = signal<{ width: number; height: number } | null>(
    null,
  );

  constructor() {
    afterNextRender(() => {
      this._resizeObserver
        .observe(this._surface())
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe(([entry]) => {
          const { width, height } = entry.contentRect;
          this._size.set({ width, height });
        });
    });

    // Redraws whenever the surface resizes or the theme flips — the palette is
    // read from the live design tokens, so dark mode just works.
    afterRenderEffect(() => {
      this._theme.currentTheme();
      const size = this._size();
      if (!size || size.width <= 0 || size.height <= 0) return;
      const palette = this._readPalette();
      this._draw(
        this._actualCanvas().nativeElement,
        size,
        ACTUAL,
        'actual',
        palette,
      );
      this._draw(this._planCanvas().nativeElement, size, PLAN, 'plan', palette);
    });
  }

  private _readPalette(): Palette {
    const styles = getComputedStyle(this._surface().nativeElement);
    const token = (name: string) => styles.getPropertyValue(name).trim();
    return {
      accent: token('--mlv-background-accent-1'),
      neutral: token('--mlv-text-secondary'),
      grid: token('--mlv-border-subtle'),
      text: token('--mlv-text-secondary'),
      surface: token('--mlv-background-raised'),
      family: token('--mlv-typography-family-text') || 'sans-serif',
    };
  }

  private _draw(
    canvas: HTMLCanvasElement,
    { width, height }: { width: number; height: number },
    series: readonly number[],
    kind: SeriesKind,
    palette: Palette,
  ): void {
    const context = canvas.getContext('2d');
    if (!context) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const plotWidth = width - PADDING.left - PADDING.right;
    const plotHeight = height - PADDING.top - PADDING.bottom;
    const x = (index: number) =>
      PADDING.left + (index / (series.length - 1)) * plotWidth;
    const y = (value: number) =>
      PADDING.top +
      (1 - (value - RANGE.min) / (RANGE.max - RANGE.min)) * plotHeight;
    const color = kind === 'actual' ? palette.accent : palette.neutral;

    context.fillStyle = palette.surface;
    context.fillRect(0, 0, width, height);

    // Grid + axis labels
    context.font = `500 11px ${palette.family}`;
    context.textBaseline = 'middle';
    for (let value = RANGE.min; value <= RANGE.max; value += 15) {
      const gy = y(value);
      context.strokeStyle = palette.grid;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(PADDING.left, gy);
      context.lineTo(width - PADDING.right, gy);
      context.stroke();
      context.fillStyle = palette.text;
      context.textAlign = 'right';
      context.fillText(`${value}k`, PADDING.left - 10, gy);
    }
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    MONTHS.forEach((month, index) => {
      context.fillStyle = palette.text;
      context.fillText(month, x(index), height - PADDING.bottom + 22);
    });

    // Area under the line — a flat, semi-transparent wash keeps the colour
    // token intact instead of hand-mixing an alpha variant.
    context.beginPath();
    context.moveTo(x(0), y(series[0]));
    series.forEach((value, index) => context.lineTo(x(index), y(value)));
    context.lineTo(x(series.length - 1), y(RANGE.min));
    context.lineTo(x(0), y(RANGE.min));
    context.closePath();
    context.globalAlpha = kind === 'actual' ? 0.18 : 0.08;
    context.fillStyle = color;
    context.fill();
    context.globalAlpha = 1;

    // Line
    context.beginPath();
    series.forEach((value, index) =>
      index === 0
        ? context.moveTo(x(index), y(value))
        : context.lineTo(x(index), y(value)),
    );
    context.strokeStyle = color;
    context.lineWidth = kind === 'actual' ? 2.5 : 2;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.setLineDash(kind === 'actual' ? [] : [6, 6]);
    context.stroke();
    context.setLineDash([]);

    // End marker + value
    const last = series.length - 1;
    context.beginPath();
    context.arc(x(last), y(series[last]), 4.5, 0, Math.PI * 2);
    context.fillStyle = palette.surface;
    context.fill();
    context.lineWidth = 2.5;
    context.stroke();
    context.font = `600 12px ${palette.family}`;
    context.textAlign = 'right';
    context.textBaseline = 'alphabetic';
    context.fillStyle = color;
    context.fillText(
      `${kind === 'actual' ? 'Actual' : 'Plan'} ${series[last]}k`,
      x(last) - 2,
      y(series[last]) - 12,
    );
  }
}
