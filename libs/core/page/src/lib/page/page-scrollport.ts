import { ElementRef } from '@angular/core';
import type { DestroyRef, NgZone } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import type {
  ScrollDispatcher,
  ScrollDispatcherTarget,
} from '@angular/cdk/scrolling';
import type { MlvPageGeometry } from './page-geometry';
import type { MlvPageSnapController } from './page-snap-controller';

/**
 * Whether the user asked for reduced motion. Read per call rather than cached:
 * the preference can change while the page is open, and this is only consulted
 * on an explicit `expand()`.
 */
function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Which element scrolls, and where its scroll event is delivered. */
export interface MlvPageScrollportBinding {
  /**
   * The element whose `scrollTop` and client block size are the scrollport's.
   * For a document-scrolled page this is the document element.
   */
  readonly scroller: HTMLElement;

  /**
   * Where that element's `scroll` event is actually delivered — the same
   * element, except for the document element, whose event fires on the
   * document.
   */
  readonly eventTarget: HTMLElement | Document;

  /**
   * Whether to register the scroller with the CDK `ScrollDispatcher`. True for
   * an element scrollport, so overlays anchored inside it reposition when it
   * scrolls; false for the document element, which the dispatcher already
   * watches globally — registering it would make every overlay in the document
   * count one scroll twice.
   */
  readonly registerWithScrollDispatcher: boolean;
}

/** Everything a scrollport needs from the page it is donating its scroll to. */
export interface MlvPageScrollportDeps {
  /** The page's geometry coordinator — measures the scrollport, takes offsets. */
  readonly geometry: MlvPageGeometry;
  /** The page's snap controller, when the page provides one. */
  readonly snap: MlvPageSnapController | null;
  /** CDK registry every overlay's scroll strategy listens to. */
  readonly scrollDispatcher: ScrollDispatcher;
  /** Zone reference; the scroll listener is bound outside the zone. */
  readonly ngZone: NgZone;
  /** Teardown boundary for the listener, the registration and the dispatcher. */
  readonly destroyRef: DestroyRef;
}

/**
 * Wires one element up as the page's scrollport.
 *
 * Being the page's scrollport means four separate things, and a scroller that
 * does three of them is one that silently half-works — which is why they live
 * in one function rather than at each call site:
 *
 * 1. **Measured.** `registerScrollport` observes its client block size, which is
 *    what `--mlv-page-available-block-size` is derived from.
 * 2. **Read.** A passive scroll listener feeds `MlvPageGeometry.scrollTop` and
 *    scrubs the snap timeline.
 * 3. **Scrollable back to the top**, so `MlvPageSnapState.expand()` has an
 *    element to return to — the page itself never knows which one that is.
 * 4. **Registered with the CDK `ScrollDispatcher`**, so an overlay anchored
 *    inside it repositions or closes when it scrolls.
 */
export function connectPageScrollport(
  binding: MlvPageScrollportBinding,
  deps: MlvPageScrollportDeps,
): void {
  const { scroller, eventTarget, registerWithScrollDispatcher } = binding;
  const { geometry, snap, scrollDispatcher, ngZone, destroyRef } = deps;

  // The scrollport is the element that actually scrolls, never a viewport
  // unit: every ancestor's chrome has already been subtracted from it.
  destroyRef.onDestroy(geometry.registerScrollport(scroller));

  // `expand()` reveals collapsed chrome and then asks the page to return to
  // the top; only the scrollport knows which element that is.
  if (snap) {
    destroyRef.onDestroy(
      snap.registerScroller(() => {
        // `scrollTo` with a behaviour is the enhancement; assigning
        // `scrollTop` is the part every DOM implements. jsdom defines no
        // `Element.prototype.scrollTo` at all, so calling it unguarded turns
        // every consumer's `expand()` into a `TypeError` under test while
        // being fine in a browser.
        if (typeof scroller.scrollTo === 'function') {
          scroller.scrollTo({
            top: 0,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          });
          return;
        }
        scroller.scrollTop = 0;
      }),
    );
  }

  // Bound as an `rxjs` `fromEvent` stream, matching `mlv-scrollbar` and
  // `mlv-chat`. Signal writes propagate through the reactivity graph on their
  // own, so a scroll that moves no signal costs nothing.
  //
  // `{ passive: true }` is forwarded to `addEventListener` — a non-passive
  // scroll listener is its own performance bug, so it is not optional.
  //
  // `takeUntilDestroyed` takes the `DestroyRef` explicitly: this runs from an
  // `afterNextRender` callback, which is not an injection context.
  //
  // `runOutsideAngular` is kept for consumers still on zone-based change
  // detection, where the zone would schedule its own tick on top.
  const scrolled$ = fromEvent(eventTarget, 'scroll', { passive: true }).pipe(
    takeUntilDestroyed(destroyRef),
  );
  ngZone.runOutsideAngular(() => {
    scrolled$.subscribe(() => {
      const top = scroller.scrollTop;
      geometry.updateScroll(top);
      snap?.updateFromScroll(top);
    });
  });

  if (!registerWithScrollDispatcher) {
    return;
  }

  // Every CDK overlay anchored inside this scrollport — a menu, a tooltip, a
  // select panel — has to be told this element scrolls. Without the
  // registration `reposition` and `close` scroll strategies never fire for page
  // scrolling and a panel stays behind while its trigger moves away.
  //
  // Registered as a bare `ScrollDispatcherTarget` rather than by instantiating
  // `CdkScrollable`: the dispatcher's contract is those two methods, the
  // directive's only other job is a scroll listener this code already owns, and
  // the viewport belongs to `mlv-scrollbar`'s template, where no attribute of
  // ours can reach.
  const scrollTarget: ScrollDispatcherTarget = {
    elementScrolled: () => scrolled$,
    getElementRef: () => new ElementRef(scroller),
  };
  scrollDispatcher.register(scrollTarget);
  destroyRef.onDestroy(() => scrollDispatcher.deregister(scrollTarget));
}
