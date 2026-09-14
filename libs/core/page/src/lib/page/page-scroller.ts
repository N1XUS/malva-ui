import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  isDevMode,
  NgZone,
} from '@angular/core';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvPage } from './page';
import { MlvPageGeometry } from './page-geometry';
import { MlvPageSnapController } from './page-snap-controller';
import { connectPageScrollport } from './page-scrollport';

/**
 * Donates a consumer-owned pane's scroll to the page it is inside.
 *
 * `main[mlvPage] scroll="content"` gives the page a bounded layout and no
 * scrollport of its own, because a page whose body is a fixed-height table or
 * a split pane has no single thing that scrolls. That leaves the geometry
 * contract and the collapse timeline with nothing to read — and there is no
 * honest way to guess which descendant meant to be the scroller, since a
 * composed page routinely contains several (`mlv-chat`, a nested
 * `mlv-scrollbar`, an auto-resizing `mlv-textarea`). So the pane says so:
 *
 * ```html
 * <main mlvPage scroll="content">
 *   <mlv-page-header>…</mlv-page-header>
 *   <mlv-scrollbar mlvPageScroller>
 *     <!-- this pane's scroll drives the header collapse -->
 *   </mlv-scrollbar>
 * </main>
 * ```
 *
 * On an `mlv-scrollbar` the directive registers that component's own viewport
 * rather than its host, because the host is not the element that scrolls. On
 * anything else the host is registered as-is; give it a definite block size and
 * an `overflow` of its own, exactly as you would for any scroller.
 *
 * Registering makes the pane the page's scrollport for every purpose at once —
 * it is measured for `--mlv-page-available-block-size`, its offset feeds
 * `MlvPageGeometry.scrollTop`, it scrubs the snap timeline, `expand()` scrolls
 * *it* back to the top, and CDK overlays anchored inside it reposition on its
 * scroll. Only one pane per page should carry it.
 */
@Directive({
  selector: '[mlvPageScroller]',
  exportAs: 'mlvPageScroller',
})
export class MlvPageScroller {
  /** @private The page this pane is donating its scroll to, if there is one. */
  private readonly _page = inject(MlvPage, { optional: true });

  /** @private Geometry coordinator the scrollport reports its size to. */
  private readonly _geometry = inject(MlvPageGeometry, { optional: true });

  /** @private Snap controller scrubbed by this pane's scroll offset. */
  private readonly _snap = inject(MlvPageSnapController, { optional: true });

  /** @private CDK registry every overlay's scroll strategy listens to. */
  private readonly _scrollDispatcher = inject(ScrollDispatcher);

  /** @private Zone reference; the scroll listener is bound outside the zone. */
  private readonly _ngZone = inject(NgZone);

  /** @private Teardown boundary for every registration made below. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Host element, and the scroller itself unless it is a scrollbar. */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * @private The `mlv-scrollbar` on this same element, when there is one. Its
   * viewport — not its host — is what actually scrolls.
   */
  private readonly _scrollbar = inject(MlvScrollbar, {
    optional: true,
    self: true,
  });

  constructor() {
    const geometry = this._geometry;
    if (!geometry) {
      if (isDevMode()) {
        console.warn(
          '[mlvPageScroller] is outside `main[mlvPage]`, so there is no page ' +
            'geometry to donate a scroll offset to. Remove it, or move it ' +
            'inside the page.',
        );
      }
      return;
    }

    // `scroll="page"` already owns a scrollport, and two of them would fight
    // over one `registerScrollport` slot and one `expand()` target. Refusing
    // is the honest answer: half-registering would leave the page measuring
    // one element and scrolling another.
    if (this._page && this._page.scroll() !== 'content') {
      if (isDevMode()) {
        console.warn(
          '[mlvPageScroller] needs `main[mlvPage] scroll="content"`; the page ' +
            `it is inside is \`scroll="${this._page.scroll()}"\`, which owns a ` +
            'scrollport already. The donated scroller is ignored.',
        );
      }
      return;
    }

    // Deferred to the first render for the same reason the page defers its
    // own: `mlv-scrollbar` has no viewport element until its view exists.
    afterNextRender(() => {
      const scroller =
        this._scrollbar?.viewportElement ?? this._host.nativeElement;
      connectPageScrollport(
        { scroller, eventTarget: scroller, registerWithScrollDispatcher: true },
        {
          geometry,
          snap: this._snap,
          scrollDispatcher: this._scrollDispatcher,
          ngZone: this._ngZone,
          destroyRef: this._destroyRef,
        },
      );
    });
  }
}
