import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { DOCUMENT, isPlatformBrowser, ViewportScroller } from '@angular/common';
import { MlvPageRegistry } from './page-registry';

/** @private Offset resolver shape shared by the two `setOffset` overloads. */
type OffsetResolver = () => [number, number];

/**
 * A `ViewportScroller` that scrolls whichever element the live page actually
 * scrolls, falling back to the document when there is none.
 *
 * Angular's own implementation scrolls the **document**, which is the correct
 * default and the reason `withInMemoryScrolling()` silently does nothing for a
 * page that owns an inner scrollport: restoration saves and restores a number
 * that never moves, and anchor scrolling goes with it. Nothing throws and no
 * warning is logged — the scroll position simply never comes back.
 *
 * Provided by {@link provideMlvPageScrollRestoration}.
 */
@Injectable()
export class MlvPageViewportScroller extends ViewportScroller {
  /** @private Registry the live page — and therefore its scrollport — comes from. */
  private readonly _registry = inject(MlvPageRegistry);

  /** @private Owning document; never the ambient global. */
  private readonly _document = inject(DOCUMENT);

  /** @private Whether a real window exists to scroll. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** @private Consumer-supplied anchor offset, when one was set. */
  private _offset: OffsetResolver | null = null;

  /**
   * Sets the offset applied when scrolling to an anchor.
   *
   * Without one, the offset is **measured**: the page publishes the clearance
   * its sticky chrome owes as `stickyInsetBlockStart`, which is exactly the
   * distance an anchor has to clear to be readable, and it changes as the
   * header collapses. A hand-set constant is the same defect as a hand-set
   * collapse distance — right until a font loads.
   */
  override setOffset(offset: [number, number] | OffsetResolver): void {
    this._offset = typeof offset === 'function' ? offset : () => offset;
  }

  /** Returns the live page scrollport's offset, else the document's. */
  override getScrollPosition(): [number, number] {
    const scrollport = this._scrollport();
    if (scrollport) {
      return [scrollport.scrollLeft, scrollport.scrollTop];
    }
    if (!this._isBrowser) {
      return [0, 0];
    }
    const view = this._document.defaultView;
    return view ? [view.scrollX, view.scrollY] : [0, 0];
  }

  /** Scrolls the live page scrollport, else the document. */
  override scrollToPosition(
    position: [number, number],
    options?: ScrollOptions,
  ): void {
    const scrollport = this._scrollport();
    if (scrollport) {
      this._scrollElementTo(scrollport, position[0], position[1], options);
      return;
    }
    this._document.defaultView?.scrollTo({
      left: position[0],
      top: position[1],
      ...options,
    });
  }

  /**
   * Scrolls an element with the given id (or anchor name) into view, inside
   * whichever scroller actually contains it.
   *
   * An anchor inside a page whose scrollport is an inner element is not
   * reachable by scrolling the document at all, so the target is resolved
   * first and the scroller chosen from where it turned out to be.
   */
  override scrollToAnchor(anchor: string, options?: ScrollOptions): void {
    const target = this._findAnchor(anchor);
    if (!target) {
      return;
    }

    const [, offsetY] = this._resolveOffset();
    const scrollport = this._scrollportContaining(target);

    if (scrollport) {
      const delta =
        target.getBoundingClientRect().top -
        scrollport.getBoundingClientRect().top;
      this._scrollElementTo(
        scrollport,
        scrollport.scrollLeft,
        scrollport.scrollTop + delta - offsetY,
        options,
      );
      return;
    }

    const view = this._document.defaultView;
    if (!view) {
      return;
    }
    view.scrollTo({
      left: view.scrollX,
      top: target.getBoundingClientRect().top + view.scrollY - offsetY,
      ...options,
    });
  }

  /** Forwards to `history.scrollRestoration`, as the default does. */
  override setHistoryScrollRestoration(
    scrollRestoration: 'auto' | 'manual',
  ): void {
    const history = this._document.defaultView?.history;
    if (history && 'scrollRestoration' in history) {
      history.scrollRestoration = scrollRestoration;
    }
  }

  /** @private The live page's scrollport, when it has registered one. */
  private _scrollport(): HTMLElement | null {
    return this._registry.active()?.geometry.scrollport() ?? null;
  }

  /** @private The registered scrollport that contains `target`, if any. */
  private _scrollportContaining(target: Element): HTMLElement | null {
    for (const page of this._registry.pages()) {
      const scrollport = page.geometry.scrollport();
      if (scrollport?.contains(target)) {
        return scrollport;
      }
    }
    return null;
  }

  /**
   * @private Resolves the anchor offset: the consumer's if they set one, else
   * the live page's measured sticky clearance.
   */
  private _resolveOffset(): [number, number] {
    if (this._offset) {
      return this._offset();
    }
    const page = this._registry.active();
    return [0, page ? page.geometry.stickyInsetBlockStart() : 0];
  }

  /** @private Resolves a fragment to an element, id first then anchor name. */
  private _findAnchor(anchor: string): HTMLElement | null {
    const byId = this._document.getElementById(anchor);
    if (byId) {
      return byId;
    }
    const byName = this._document.getElementsByName(anchor)[0];
    return byName instanceof HTMLElement ? byName : null;
  }

  /**
   * @private Scrolls one element, degrading to the two properties every DOM
   * implements. jsdom defines `scrollTop`/`scrollLeft` but no
   * `Element.prototype.scrollTo`, so calling it unguarded turns every spec
   * that navigates into a `TypeError`.
   */
  private _scrollElementTo(
    element: HTMLElement,
    left: number,
    top: number,
    options?: ScrollOptions,
  ): void {
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ left, top, ...options });
      return;
    }
    element.scrollLeft = left;
    element.scrollTop = top;
  }
}

/**
 * Makes Angular's router scrolling features work on a page that owns its own
 * scrollport.
 *
 * `withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })` and
 * `anchorScrolling` are both implemented over `ViewportScroller`, which
 * scrolls the **document**. `main[mlvPage]` in its default `scroll="page"`
 * mode scrolls an inner element instead, so the router saves and restores a
 * document offset that never moves: restoration appears to be configured and
 * does nothing, with no error to notice. This replaces the scroller with one
 * that asks the page which element it scrolls.
 *
 * ```ts
 * bootstrapApplication(App, {
 *   providers: [
 *     provideRouter(
 *       routes,
 *       withInMemoryScrolling({
 *         scrollPositionRestoration: 'enabled',
 *         anchorScrolling: 'enabled',
 *       }),
 *     ),
 *     provideMlvPageScrollRestoration(),
 *   ],
 * });
 * ```
 *
 * With no page mounted — a route that renders no `main[mlvPage]` — every call
 * falls through to the document, so mixing page and non-page routes needs no
 * second configuration.
 *
 * It also supplies the anchor offset the router otherwise makes you hand-write:
 * with no explicit `setOffset`, an anchor clears the page's **measured** sticky
 * chrome (WCAG 2.2 SC 2.4.11, Focus Not Obscured), which follows the header as
 * it collapses.
 */
export function provideMlvPageScrollRestoration(): (
  | Provider
  | EnvironmentProviders
)[] {
  return [{ provide: ViewportScroller, useClass: MlvPageViewportScroller }];
}
