import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  NgZone,
  PLATFORM_ID,
  signal,
  untracked,
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
    '[style.transition]': '_settling() ? "none" : null',
  },
})
export class MlvFade {
  /**
   * Line height of a horizontal fade, written to both `line-height` and
   * `--mlv-line-height`. In horizontal mode the edge fades cover only the last
   * line box, so a wrapping label fades where it is clipped. `null` (the
   * default) leaves the inherited line height and fades the full box height.
   */
  public readonly mlvFadeHeight = input<string | null>(null);

  /**
   * Length of each fade gradient along the overflow axis (`--mlv-fade-size`).
   * Any CSS length; the default is `1.5em`.
   */
  public readonly mlvFadeSize = input('1.5em');

  /**
   * Fully transparent band between the edge and the start of the gradient
   * (`--mlv-fade-offset`). Any CSS length; the default is `0em`.
   */
  public readonly mlvFadeOffset = input('0em');

  /**
   * Overflow axis the fades follow. `'horizontal'` (the default) fades the
   * inline-start and inline-end edges, so they mirror under a `[dir="rtl"]`
   * ancestor at any depth; `'vertical'` fades the top and bottom. The bare
   * attribute (`<div mlvFade>`) binds `''`, which behaves as `'horizontal'`.
   */
  public readonly mlvFade = input<MlvOrientation | ''>('horizontal');

  /** @protected Whether the content is scrolled to (or overflowing toward) the end edge. */
  protected readonly _isEnd = signal(false);
  /** @protected Whether the content is scrolled away from the start edge. */
  protected readonly _isStart = signal(false);

  /**
   * @protected `true` until the first measurement of a laid-out box has been
   * painted; binds an inline `transition: none` meanwhile. The mask starts in
   * its rest position and that measurement usually moves it to an overflow
   * edge — which is not a scroll, so it must jump rather than slide in over
   * `--mlv-duration-slow` on every mount.
   */
  protected readonly _settling = signal(true);

  /** @private Host element reference used to read scroll metrics and flush its style. */
  private readonly _elementRef = inject(ElementRef);

  /** @private Injector for the one `afterNextRender` that ends {@link _settling}. */
  private readonly _injector = inject(Injector);

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

    // `_computeIsEnd` reads the orientation, but only when a scroll or resize
    // schedules a measurement — so a changed input re-measures on its own.
    // The first run coalesces with the stream's `startWith` below.
    effect(() => {
      this.mlvFade();
      untracked(() => this._scheduleEvaluate());
    });

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
    // A box with no size (not yet laid out, `display: none`) has nothing to
    // measure, and settling on it would let its first real measurement slide.
    if (!el.scrollWidth) return;
    const nextEnd = this._computeIsEnd();
    // `scrollLeft` runs 0 → negative in RTL; a subpixel offset at the start
    // must floor to 0 there too, not to -1.
    const nextStart =
      !!Math.floor(Math.abs(el.scrollLeft)) || !!Math.floor(el.scrollTop);
    if (nextEnd === this._isEnd() && nextStart === this._isStart()) {
      this._settle(false);
      return;
    }
    this._ngZone.run(() => {
      this._isEnd.set(nextEnd);
      this._isStart.set(nextStart);
    });
    this._settle(true);
  }

  /**
   * @private Ends {@link _settling} after the first measurement. When that
   * measurement changed a boundary class, the transition may come back only
   * once the browser has resolved the new mask position with it still off, so
   * the next render forces a style flush first — otherwise both changes land
   * in one style recalc and the mask animates anyway.
   */
  private _settle(classesChanged: boolean): void {
    if (!this._settling()) return;
    const done = () => this._ngZone.run(() => this._settling.set(false));
    if (!classesChanged) {
      done();
      return;
    }
    afterNextRender(
      {
        earlyRead: () =>
          getComputedStyle(this._elementRef.nativeElement).getPropertyValue(
            'mask-position',
          ),
        write: done,
      },
      { injector: this._injector },
    );
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
