import type { Signal } from '@angular/core';

/**
 * The capability a page exposes for revealing its collapsed chrome.
 *
 * This is the whole public shape: the controller behind it is an
 * implementation detail and is not exported from the package barrel. Reach it
 * through `MlvPage.snap`.
 */
export interface MlvPageSnapState {
  /** Effective snap progress: 0 fully expanded, 1 fully snapped. */
  readonly progress: Signal<number>;

  /** True once the chrome is closer to its snapped state than the open one. */
  readonly snapped: Signal<boolean>;

  /**
   * True once the scroller has moved off the top, i.e. the chrome is sitting
   * over content rather than at the head of it.
   *
   * This is a **different** question from {@link snapped}, and Material and
   * UIKit both keep the two apart for the same reason: a bar that never
   * changes height still has to know it is over content, so it can paint a
   * separation signal. A pinned bar has a collapse fraction of zero forever.
   */
  readonly overlapped: Signal<boolean>;

  /**
   * Reveals every collapsed chrome region **synchronously** and scrolls the
   * page back to the top, which is what actually expands the chrome.
   */
  expand(): void;
}

/**
 * A region of the page chrome that collapses on the snap timeline and can be
 * revealed ahead of it. Implemented by `MlvPageSnapRegionBase`, which registers
 * itself so `expand()` can make collapsed chrome focusable.
 */
export interface MlvPageSnapRegion {
  /**
   * Reveals the region immediately, before the scroll lands, so a `focus()`
   * issued in the same task is not refused on hidden chrome.
   */
  reveal(): void;

  /**
   * Re-applies the region's own hidden state to the DOM. Called when the
   * reveal window ends, because a reveal that never round-tripped through
   * change detection leaves the host binding holding a stale value.
   */
  syncHiddenState(): void;
}

/**
 * @internal The controller surface `MlvPageSnapRegionBase` consumes. It exists
 * as an interface so the abstract base can type its injected coordinator
 * without pulling the `@Injectable` implementation into the public typings.
 */
export interface MlvPageSnapCoordinator extends MlvPageSnapState {
  /** True while `expand()` bridges its own scroll and regions stay visible. */
  readonly revealing: Signal<boolean>;

  /** Registers a region; the returned callback unregisters it. */
  registerRegion(region: MlvPageSnapRegion): () => void;
}
