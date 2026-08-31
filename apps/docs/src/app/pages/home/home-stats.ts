import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';

interface HomeStat {
  readonly target: number;
  readonly suffix: string;
  readonly label: string;
}

const STATS: HomeStat[] = [
  { target: 80, suffix: '+', label: 'Components' },
  { target: 14, suffix: '', label: 'Locales' },
  { target: 6, suffix: '', label: 'Full showcases' },
  { target: 100, suffix: '%', label: 'Reduced-motion coverage' },
];

/**
 * Animated key-numbers strip. Counts each figure up the first time the strip
 * scrolls into view; with reduced motion (or without IntersectionObserver)
 * the final values render immediately.
 */
@Component({
  selector: 'docs-home-stats',
  template: `
    <dl class="home-stats">
      @for (stat of stats; track stat.label; let i = $index) {
        <div class="home-stats__item">
          <dt>{{ stat.label }}</dt>
          <dd>{{ values()[i] }}{{ stat.suffix }}</dd>
        </div>
      }
    </dl>
  `,
  styleUrl: './home-stats.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeStatsComponent {
  protected readonly stats = STATS;

  /** @internal Currently displayed figure per stat, animated on reveal. */
  protected readonly values = signal(STATS.map((stat) => stat.target));

  /** @private Host element observed for the count-up trigger. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private Cancels the observer and animation frames on destroy. */
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    const canAnimate =
      typeof IntersectionObserver !== 'undefined' &&
      typeof matchMedia !== 'undefined' &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!canAnimate) {
      return;
    }

    this.values.set(STATS.map(() => 0));

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        observer.disconnect();

        const start = performance.now();
        const durationMs = 1200;
        const tick = (now: number) => {
          const progress = Math.min((now - start) / durationMs, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          this.values.set(
            STATS.map((stat) => Math.round(stat.target * eased)),
          );
          if (progress < 1) {
            frame = requestAnimationFrame(tick);
          }
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(this._elementRef.nativeElement);
    this._destroyRef.onDestroy(() => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    });
  }
}
