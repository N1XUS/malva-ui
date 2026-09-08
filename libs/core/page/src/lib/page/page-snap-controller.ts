import {
  DestroyRef,
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import type { Signal } from '@angular/core';
import type {
  MlvPageSnapCoordinator,
  MlvPageSnapRegion,
} from './page-snap-state';

/**
 * Milliseconds after which a reveal ends even though the scroll never reached
 * the top. A smooth scroll can be interrupted by the user, cancelled by the
 * browser, or refused outright when nothing registered a scroller — and a
 * reveal that never closes leaves invisible tab stops behind, which is the
 * exact defect the hidden state exists to prevent.
 */
const REVEAL_FALLBACK_MS = 700;

/**
 * Scroll offset in pixels below which the chrome still counts as sitting at
 * the head of the content rather than over it. Small enough that a single
 * wheel notch crosses it, large enough that sub-pixel scroll noise does not.
 */
const OVERLAP_THRESHOLD = 4;

/**
 * Owns the snap progress of a page's collapsing top chrome.
 *
 * Progress has exactly **one** source: `main[mlvPage]` maps its scroll offset
 * onto a 0..1 timeline (`snapRange` pixels of scroll = the full timeline), so
 * chrome motion is proportional to scrolling instead of played on a clock. The
 * effective value is published as the `--mlv-page-snap` CSS custom property on
 * the page host; elements interpolate their own state from it (see
 * `MlvPageSnap`).
 *
 * {@link expand} is the one imperative affordance: it reveals every registered
 * region up front — so a consumer can focus a control inside chrome the scroll
 * had collapsed — and then scrolls the page to the top, which is what makes
 * the chrome expand. There is no frozen state, because a frozen state is a
 * second source of progress and every bug it produced was its own.
 *
 * Provided by `MlvPage`. Inject optionally from header/summary components and
 * snap directives — absence simply means "no scroll-linked behaviour".
 *
 * @internal Not exported from the package barrel; consumers reach the narrow
 * {@link MlvPageSnapState} through `MlvPage.snap`.
 */
@Injectable()
export class MlvPageSnapController implements MlvPageSnapCoordinator {
  /** @private Scroll-derived progress, 0 (top) .. 1 (fully snapped). */
  private readonly _progress = signal(0);

  /** @private Raw scroll offset of the owning scroller, in pixels. */
  private readonly _scrollTop = signal(0);

  /** @private Snap regions that `expand()` reveals ahead of the scroll. */
  private readonly _regions = new Set<MlvPageSnapRegion>();

  /** @private Backs the `revealing` bridge flag. */
  private readonly _revealing = signal(false);

  /** @private Scrolls the owning page's viewport back to the top. */
  private _scrollToTop: (() => void) | null = null;

  /** @private Handle of the timer that closes an unfinished reveal. */
  private _revealTimer: ReturnType<typeof setTimeout> | null = null;

  /** Effective snap progress: 0 fully expanded, 1 fully snapped. */
  readonly progress: Signal<number> = this._progress.asReadonly();

  /** True once the chrome is closer to its snapped state than the open one. */
  readonly snapped = computed(() => this.progress() >= 0.5);

  /**
   * True once the scroller has moved off the top. Independent of
   * {@link progress}: chrome that never collapses still needs to know it is
   * over content, and chrome whose collapse range is zero would otherwise
   * report itself expanded at every scroll offset.
   */
  readonly overlapped = computed(() => this._scrollTop() > OVERLAP_THRESHOLD);

  /**
   * @internal True while `expand()` bridges its own scroll: snap regions stay
   * visible — and therefore focusable — from the call itself until the page
   * has actually returned to the top. Read by `MlvPageSnap`.
   */
  readonly revealing: Signal<boolean> = this._revealing.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this._clearRevealTimer());

    // The reveal ends when the scroll it asked for arrives, not on a timer of
    // its own — a smooth scroll has no fixed duration. The timer in `expand()`
    // is only the fallback for a scroll that never lands.
    effect(() => {
      const atTop = this._progress() <= 0.001;
      if (!atTop || !this._revealing()) {
        return;
      }
      untracked(() => this._endReveal());
    });
  }

  /**
   * @internal Registers a snap region so `expand()` can reveal it. Called by
   * `MlvPageSnap`; the returned callback unregisters on destroy.
   */
  registerRegion(region: MlvPageSnapRegion): () => void {
    this._regions.add(region);
    return () => {
      this._regions.delete(region);
    };
  }

  /**
   * @internal Registers how to scroll the owning page back to the top. Called
   * by `MlvPage` once its viewport exists; the returned callback unregisters.
   */
  registerScroller(scrollToTop: () => void): () => void {
    this._scrollToTop = scrollToTop;
    return () => {
      if (this._scrollToTop === scrollToTop) {
        this._scrollToTop = null;
      }
    };
  }

  /**
   * @internal Called by `MlvPage` on every scroll event of its viewport.
   *
   * @param scrollTop Current scroll offset of the page viewport, in pixels.
   * @param snapRange Scroll distance mapped onto the full 0..1 timeline.
   */
  updateFromScroll(scrollTop: number, snapRange: number): void {
    this._scrollTop.set(scrollTop);
    this._progress.set(
      snapRange > 0 ? Math.min(Math.max(scrollTop / snapRange, 0), 1) : 0,
    );
  }

  /**
   * Gives the user their title back without scrolling for it: every registered
   * region is revealed **synchronously**, before anything moves, so a consumer
   * can put focus into collapsed chrome in the same task —
   *
   * ```ts
   * page.snap.expand();
   * headerTab.focus();
   * ```
   *
   * — and the page is then scrolled to the top, which is what actually expands
   * the chrome. Outside a scrolling page the reveal still happens and closes
   * itself on the fallback timer.
   */
  expand(): void {
    for (const region of this._regions) {
      region.reveal();
    }
    this._revealing.set(true);
    this._armRevealFallback();
    this._scrollToTop?.();
  }

  /**
   * @private Ends the reveal bridge and hands every region back its own hidden
   * state. `reveal()` writes the DOM ahead of change detection, so a bridge
   * that opens and closes without a render in between would otherwise leave
   * the host binding's cached value disagreeing with the element.
   */
  private _endReveal(): void {
    this._clearRevealTimer();
    if (!this._revealing()) {
      return;
    }
    this._revealing.set(false);
    for (const region of this._regions) {
      region.syncHiddenState();
    }
  }

  /** @private Closes a reveal whose scroll never arrived. */
  private _armRevealFallback(): void {
    this._clearRevealTimer();
    if (typeof setTimeout === 'undefined') {
      return;
    }
    this._revealTimer = setTimeout(() => this._endReveal(), REVEAL_FALLBACK_MS);
  }

  /** @private Cancels the pending reveal fallback, if any. */
  private _clearRevealTimer(): void {
    if (this._revealTimer !== null) {
      clearTimeout(this._revealTimer);
      this._revealTimer = null;
    }
  }
}
