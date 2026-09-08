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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import type {
  MlvPageSnapBehavior,
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

/** Clamps a number into the closed unit interval. */
function unit(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Owns the snap progress of a page's collapsing top chrome.
 *
 * Progress has exactly **one** source: the scroll offset of the page's own
 * scroller, mapped onto a 0..1 timeline whose length is
 * {@link collapseDistance} — the sum of what the collapsing chrome measured
 * of itself. Chrome motion is therefore proportional to scrolling instead of
 * played on a clock, and the timeline is exactly as long as the chrome it
 * removes rather than a constant somebody guessed.
 *
 * How scrolling maps onto that timeline is {@link MlvPageSnapBehavior}, set by
 * `main[mlvPage]` from its `snapBehavior` input.
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
  /** @private Raw scroll offset of the owning scroller, in pixels. */
  private readonly _scrollTop = signal(0);

  /** @private Scroll offset the previous update saw, for the delta modes. */
  private _previousScrollTop = 0;

  /** @private Progress accumulated by `enterAlways`, which follows deltas. */
  private readonly _enterAlwaysProgress = signal(0);

  /** @private Behaviour selected by the owning page. */
  private readonly _behavior =
    signal<MlvPageSnapBehavior>('exitUntilCollapsed');

  /** @private Snap regions that `expand()` reveals ahead of the scroll. */
  private readonly _regions = new Set<MlvPageSnapRegion>();

  /** @private Measured block sizes the chrome gives up over the timeline. */
  private readonly _collapsibles = signal<readonly Signal<number>[]>([]);

  /** @private Backs the `revealing` bridge flag. */
  private readonly _revealing = signal(false);

  /** @private True while the reader asked for reduced motion. */
  private readonly _reducedMotion = signal(false);

  /** @private Scrolls the owning page's viewport back to the top. */
  private _scrollToTop: (() => void) | null = null;

  /** @private Handle of the timer that closes an unfinished reveal. */
  private _revealTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Block size the chrome gives up between fully expanded and its collapsed
   * floor, in pixels — and therefore the scroll distance the whole timeline
   * spans. Derived, never declared: every collapsing region contributes its
   * own measurement, so a locale change, a font load or a responsive rewrap
   * lengthens the timeline instead of leaving it calibrated against a number
   * that is no longer true.
   */
  readonly collapseDistance = computed(() => {
    let total = 0;
    for (const size of this._collapsibles()) {
      total += size();
    }
    return total;
  });

  /**
   * Effective snap progress: 0 fully expanded, 1 fully snapped.
   *
   * Under `prefers-reduced-motion: reduce` this steps between the two ends at
   * the halfway mark rather than scrubbing. The shared reduced-motion mixin
   * only shortens *durations*, and a scroll-driven collapse has none — the
   * thing the criterion is actually about is a title resizing under the reader
   * on every wheel notch, which only stepping removes.
   */
  readonly progress: Signal<number> = computed(() => {
    const raw = this._behaviorProgress();
    return this._reducedMotion() ? (raw >= 0.5 ? 1 : 0) : raw;
  });

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

  /**
   * @private Scroll offset expressed as a fraction of the collapse distance,
   * before any behaviour is applied. Zero when there is nothing to collapse.
   */
  private readonly _linearProgress = computed(() => {
    const distance = this.collapseDistance();
    return distance > 0 ? unit(this._scrollTop() / distance) : 0;
  });

  /** @private Progress after the selected behaviour has had its say. */
  private readonly _behaviorProgress = computed(() => {
    switch (this._behavior()) {
      case 'pinned':
        return 0;
      case 'enterAlways':
        return this._enterAlwaysProgress();
      default:
        // `exitUntilCollapsed` is the linear mapping *because* the timeline is
        // only `collapseDistance` pixels long: the chrome is fully collapsed
        // for the whole document below that, and re-expanding it means
        // scrolling back into the first screenful — reaching the top for the
        // last of it. The invariant is the range's, not a latch's.
        return this._linearProgress();
    }
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this._clearRevealTimer());

    if (typeof matchMedia !== 'undefined') {
      const query = matchMedia('(prefers-reduced-motion: reduce)');
      this._reducedMotion.set(query.matches);
      // The preference can change while the page is open — a reader turning it
      // on mid-session must not be left mid-scrub.
      fromEvent(query, 'change')
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe(() => this._reducedMotion.set(query.matches));
    }

    // The reveal ends when the scroll it asked for arrives, not on a timer of
    // its own — a smooth scroll has no fixed duration. The timer in `expand()`
    // is only the fallback for a scroll that never lands.
    effect(() => {
      const atTop = this.progress() <= 0.001;
      if (!atTop || !this._revealing()) {
        return;
      }
      untracked(() => this._endReveal());
    });
  }

  /**
   * @internal Registers a snap region so `expand()` can reveal it. Called by
   * `MlvPageSnapRegionBase`; the returned callback unregisters on destroy.
   */
  registerRegion(region: MlvPageSnapRegion): () => void {
    this._regions.add(region);
    return () => {
      this._regions.delete(region);
    };
  }

  /**
   * @internal Registers a measured collapsing extent. Called by every region
   * that gives up block size on the timeline — the snap regions themselves and
   * the header for the block its title shrinks by.
   */
  registerCollapse(blockSize: Signal<number>): () => void {
    this._collapsibles.update((sizes) => [...sizes, blockSize]);
    return () => {
      this._collapsibles.update((sizes) =>
        sizes.filter((s) => s !== blockSize),
      );
    };
  }

  /** @internal Selects how scrolling maps onto the timeline. Called by `MlvPage`. */
  setBehavior(behavior: MlvPageSnapBehavior): void {
    this._behavior.set(behavior);
  }

  /**
   * @internal Called by `MlvPage` on every scroll event of its viewport.
   *
   * @param scrollTop Current scroll offset of the page viewport, in pixels.
   */
  updateFromScroll(scrollTop: number): void {
    const previous = this._previousScrollTop;
    this._previousScrollTop = scrollTop;
    this._scrollTop.set(scrollTop);

    // `enterAlways` is the one behaviour that is a function of scroll *history*
    // rather than of scroll position: the chrome comes back on any pull down,
    // wherever the reader happens to be. It therefore integrates the delta
    // instead of reading `_linearProgress`, and is pinned to 0 at the top so a
    // jump-to-top cannot leave it stranded mid-collapse.
    if (this._behavior() === 'enterAlways') {
      const distance = untracked(() => this.collapseDistance());
      if (scrollTop <= 0 || distance <= 0) {
        this._enterAlwaysProgress.set(0);
      } else {
        this._enterAlwaysProgress.update((current) =>
          unit(current + (scrollTop - previous) / distance),
        );
      }
    }
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
    this._enterAlwaysProgress.set(0);
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
