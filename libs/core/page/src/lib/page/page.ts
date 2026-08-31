import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  NgZone,
  signal,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { mlvNextId } from '@malva-ui/cdk/utils';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvPageSnapController } from './page-snap-controller';
import { MLV_PAGE_SCROLL } from './page-scroll.token';
import type { MlvPageScrollState } from './page-scroll.token';

/** Controls which element owns vertical page scrolling. */
export type MlvPageScroll = 'auto' | 'none';

/** Controls the inset around projected page content. */
export type MlvPagePadding = 'none' | 's' | 'm' | 'l';

/** Controls whether the page uses the anchored application-canvas treatment. */
export type MlvPageSurface = 'anchored' | 'flat';

/**
 * Scroll offset in pixels below which the page reports itself as unscrolled.
 * The small hysteresis avoids flicker from sub-pixel scroll positions.
 */
const SCROLLED_THRESHOLD = 4;

/**
 * Main page surface and scroll owner. Apply it to the page's native `<main>`
 * landmark and compose headers, content grids, and feature components inside.
 *
 * Provides `MLV_PAGE_SCROLL` so descendants such as `mlv-page-header` and
 * `mlv-page-summary` can react to the page's scroll position, and
 * `MlvPageSnapController`, whose scroll-scrubbed progress it publishes as the
 * `--mlv-page-snap` custom property (0 expanded .. 1 snapped) for descendants
 * to interpolate their snap state from.
 */
@Component({
  // Attribute-selector component intentionally enhances the native main landmark.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'main[mlvPage]',
  template: `
    <mlv-scrollbar class="mlv-page__scrollbar" [disabled]="scroll() === 'none'">
      <div class="mlv-page__inner"><ng-content /></div>
    </mlv-scrollbar>
  `,
  imports: [MlvScrollbar],
  styleUrl: './page.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: MLV_PAGE_SCROLL, useExisting: MlvPage },
    MlvPageSnapController,
  ],
  host: {
    class: 'mlv-page',
    '[id]': 'id()',
    tabindex: '-1',
    '[class.mlv-page--scroll-auto]': 'scroll() === "auto"',
    '[class.mlv-page--scroll-none]': 'scroll() === "none"',
    '[class.mlv-page--padding-none]': 'padding() === "none"',
    '[class.mlv-page--padding-s]': 'padding() === "s"',
    '[class.mlv-page--padding-m]': 'padding() === "m"',
    '[class.mlv-page--padding-l]': 'padding() === "l"',
    '[class.mlv-page--surface-anchored]': 'surface() === "anchored"',
    '[class.mlv-page--surface-flat]': 'surface() === "flat"',
    '[class.mlv-page--sticky-header]': 'stickyHeader()',
    '[class.mlv-page--scrolled]': 'scrolled()',
    '[style.--mlv-page-max-width]': 'maxWidth()',
  },
})
export class MlvPage implements MlvPageScrollState {
  /** Unique landmark id; set explicitly when targeting the page from a skip link. */
  readonly id = input(mlvNextId('mlv-page'));

  /** Selects whether the page or a consumer-owned region handles scrolling. */
  readonly scroll = input<MlvPageScroll>('auto');

  /** Optional maximum width for the centred inner page canvas. */
  readonly maxWidth = input<string | null>(null);

  /** Selects the responsive inset applied around projected page content. */
  readonly padding = input<MlvPagePadding>('m');

  /** Selects the anchored rounded canvas or a completely flat surface. */
  readonly surface = input<MlvPageSurface>('anchored');

  /** Makes projected page headers sticky within this page's scroll container. */
  readonly stickyHeader = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * Scroll distance in pixels mapped onto the full snap timeline: scrolling
   * this far takes the top chrome from fully expanded to fully snapped.
   */
  readonly snapRange = input(96);

  /** Current vertical scroll offset of the page scroll owner, in pixels. */
  get scrollTop(): MlvPageScrollState['scrollTop'] {
    return this._scrollTop.asReadonly();
  }

  /** True once the page has scrolled past a small hysteresis threshold. */
  get scrolled(): MlvPageScrollState['scrolled'] {
    return this._scrolled.asReadonly();
  }

  /**
   * Snap controller of this page's collapsing top chrome. Descendants inject
   * `MlvPageSnapController` directly; a component that only *hosts* the page
   * reaches it from outside through `viewChild(MlvPage).snap` — for instance
   * to `expand()` the chrome before moving focus into it.
   */
  get snap(): MlvPageSnapController {
    return this._snap;
  }

  /** @private Writable source behind the public `scrollTop` signal. */
  private readonly _scrollTop = signal(0);

  /** @private Writable source behind the public `scrolled` signal. */
  private readonly _scrolled = signal(false);

  /** @private The page-owned scrollbar whose viewport is observed. */
  private readonly _scrollbar = viewChild.required(MlvScrollbar);

  /** @private Zone reference; the scroll listener runs outside the zone. */
  private readonly _ngZone = inject(NgZone);

  /** @private Cleans up the native scroll listener. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Snap state provided to descendants and scrubbed from scroll. */
  private readonly _snap = inject(MlvPageSnapController);

  /** @private Host element carrying the published snap custom property. */
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      const viewport = this._scrollbar().viewportElement;
      const onScroll = (): void => {
        const top = viewport.scrollTop;
        this._scrollTop.set(top);
        this._scrolled.set(top > SCROLLED_THRESHOLD);
        this._snap.updateFromScroll(top, this.snapRange());
      };
      // Signal writes propagate through the reactivity graph without zone
      // involvement, so the frequent listener can stay outside the zone.
      this._ngZone.runOutsideAngular(() => {
        viewport.addEventListener('scroll', onScroll, { passive: true });
      });
      this._destroyRef.onDestroy(() => {
        viewport.removeEventListener('scroll', onScroll);
      });
    });

    // Publish the effective snap progress as a CSS custom property so
    // descendant styles can scrub their state with pure calc() interpolation,
    // then rebalance the chrome spacer against the freshly applied progress.
    afterRenderEffect(() => {
      const progress = this._snap.progress();
      // Track the spacer scale too: the reclaim tween must republish.
      this._snap.spacerScale();
      this._elementRef.nativeElement.style.setProperty(
        '--mlv-page-snap',
        String(Math.round(progress * 1000) / 1000),
      );
      this._measureSnapOffset();
    });

    afterNextRender(() => {
      const host = this._elementRef.nativeElement;
      this._snapChrome = Array.from(
        host.querySelectorAll<HTMLElement>(
          '.mlv-page__inner > .mlv-page-header, .mlv-page__inner > .mlv-page-summary',
        ),
      );
      this._measureSnapOffset();
      // Re-measure when chrome content itself resizes (wrapping, data).
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => this._measureSnapOffset());
        this._snapChrome.forEach((element) => observer.observe(element));
        this._destroyRef.onDestroy(() => observer.disconnect());
      }
    });
  }

  /** @private Direct chrome children whose snapping height is compensated. */
  private _snapChrome: HTMLElement[] = [];

  /** @private Expanded (progress 0) chrome height, the compensation baseline. */
  private _snapExpandedHeight = 0;

  /**
   * @private Snapping shrinks in-flow chrome (the header with its projected
   * summary row), which would shift the content and the scroll height while
   * the user is still scrolling — a feedback loop that reads as mid-scroll
   * jumping. The removed height is re-added as a spacer after the chrome
   * (`--mlv-page-snap-offset`), keeping the document geometry stable so
   * content tracks the scroll 1:1. The controller's `spacerScale` scales the
   * spacer away while the chrome is manually pinned collapsed — a frozen
   * chrome never changes height mid-scroll, so the spacer is pure dead space.
   */
  private _measureSnapOffset(): void {
    if (this._snapChrome.length === 0) {
      return;
    }
    const total = this._snapChrome.reduce(
      (sum, element) => sum + element.offsetHeight,
      0,
    );
    if (this._snap.progress() <= 0.001) {
      this._snapExpandedHeight = total;
    }
    const offset =
      Math.max(0, this._snapExpandedHeight - total) * this._snap.spacerScale();
    this._elementRef.nativeElement.style.setProperty(
      '--mlv-page-snap-offset',
      `${Math.round(offset * 100) / 100}px`,
    );
  }
}
