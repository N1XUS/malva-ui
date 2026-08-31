import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  NgZone,
  PLATFORM_ID,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent, merge, startWith } from 'rxjs';
import { MlvResizeObserverService } from '../observers/resize-observer.service';

export type MlvOrientation = 'horizontal' | 'vertical';

const BUFFER = 1; // buffer for rounding issues

@Component({
  // Attribute-selector component — camelCase [mlvX] is the documented pattern
  // (see .claude/rules/angular-component.md); the rule only models kebab-case.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[mlvFade]',
  imports: [],
  template: '<ng-content />',
  styleUrl: './fade.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-fade',
    '[class.mlv-fade--end]': '_isEnd()',
    '[class.mlv-fade--start]': '_isStart()',
    '[attr.data-orientation]': 'mlvFade()',
    '[style.line-height]': 'mlvFadeHeight()',
    '[style.--mlv-line-height]': 'mlvFadeHeight()',
    '[style.--mlv-fade-size]': 'mlvFadeSize()',
    '[style.--mlv-fade-offset]': 'mlvFadeOffset()',
  },
})
export class MlvFade {
  public readonly mlvFadeHeight = input<string | null>(null);
  public readonly mlvFadeSize = input('1.5em');
  public readonly mlvFadeOffset = input('0em');
  public readonly mlvFade = input<MlvOrientation | ''>('horizontal');

  /** @protected Whether the content is scrolled to (or overflowing toward) the end edge. */
  protected readonly _isEnd = signal(false);
  /** @protected Whether the content is scrolled away from the start edge. */
  protected readonly _isStart = signal(false);

  /** @private Host element reference used to read scroll metrics and toggle the transition. */
  private readonly _elementRef = inject(ElementRef);

  /** @private Shared resize observer, subscribed only in a browser. */
  private readonly _resizeObserver = inject(MlvResizeObserverService);

  /** @private Avoids DOM event/observer subscriptions during SSR. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** @private Angular zone — the scroll/resize stream runs outside it so raw events don't each trigger change detection. */
  private readonly _ngZone = inject(NgZone);

  /** @private Destroy ref used to cancel a pending rAF on teardown. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Pending rAF id coalescing a burst of scroll/resize events into one measurement per frame. */
  private _rafId: number | null = null;

  constructor() {
    if (!this._isBrowser) return;
    afterNextRender(() =>
      this._elementRef.nativeElement.style.setProperty('transition', ''),
    );

    // Scroll/resize fire far more often than the fade state actually flips.
    // Run the stream outside Angular so raw events don't each schedule a
    // change-detection pass; coalesce a burst into a single rAF measurement,
    // and only re-enter the zone to write the signals when a boundary flag
    // actually changes.
    this._ngZone.runOutsideAngular(() => {
      merge(
        this._resizeObserver.observe(this._elementRef.nativeElement),
        fromEvent(this._elementRef.nativeElement, 'scroll'),
      )
        .pipe(
          startWith(null),
          filter(() => !!this._elementRef.nativeElement.scrollWidth),
          takeUntilDestroyed(this._destroyRef),
        )
        .subscribe(() => this._scheduleEvaluate());
    });

    this._destroyRef.onDestroy(() => {
      if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    });
  }

  /** @private Coalesces a burst of scroll/resize events into a single rAF-batched fade re-evaluation. */
  private _scheduleEvaluate(): void {
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._evaluateFadeState();
    });
  }

  /**
   * @private Reads scroll metrics (outside the zone) and flips the fade signals
   * only when a boundary flag changed, re-entering the zone for that write so
   * the host-class bindings update.
   */
  private _evaluateFadeState(): void {
    const el = this._elementRef.nativeElement;
    const nextEnd = this._computeIsEnd();
    const nextStart = !!Math.floor(el.scrollLeft) || !!Math.floor(el.scrollTop);
    if (nextEnd === this._isEnd() && nextStart === this._isStart()) return;
    this._ngZone.run(() => {
      this._isEnd.set(nextEnd);
      this._isStart.set(nextStart);
    });
  }

  /** @private Computes whether the content is scrolled to (or overflowing toward) the end edge. */
  private _computeIsEnd(): boolean {
    const {
      scrollTop,
      scrollHeight,
      clientHeight,
      scrollLeft,
      scrollWidth,
      clientWidth,
    } = this._elementRef.nativeElement;
    return this.mlvFade() === 'vertical'
      ? Math.round(scrollTop) < scrollHeight - clientHeight - BUFFER
      : Math.ceil(Math.abs(scrollLeft)) < scrollWidth - clientWidth - BUFFER ||
          // horizontal multiline fade can kick in early due to hanging elements of fonts so using bigger buffer
          scrollHeight > clientHeight + 4 * BUFFER;
  }
}
