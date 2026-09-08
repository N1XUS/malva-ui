import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/** @private Document attribute the page stylesheets key their freeze off. */
const TRANSITION_ATTRIBUTE = 'data-mlv-page-view-transition';

/**
 * The part of a `ViewTransition` this needs, named structurally so the page
 * package does not depend on the DOM lib version that first declared it.
 */
export interface MlvPageViewTransitionLike {
  /** Settles when the transition has finished, successfully or not. */
  readonly finished: Promise<unknown>;
}

/**
 * What `withViewTransitions({ onViewTransitionCreated })` hands its callback.
 * Only the transition itself is used; the route snapshots are ignored.
 */
export interface MlvPageViewTransitionInfoLike {
  /** The live transition. */
  readonly transition: MlvPageViewTransitionLike;
}

/**
 * Tracks whether a router view transition is currently running.
 *
 * A view transition freezes the **old** side of the page as a snapshot while
 * the new side stays live. A scroll-scrubbed collapse that keeps running
 * during that window therefore animates one side against a still image: the
 * old header is frozen at whatever progress it had, the new one keeps moving,
 * and the crossfade blends two different collapse states. While this reports
 * `active` the page pauses its scrub — the CSS timeline through the
 * `[data-mlv-page-view-transition]` attribute this publishes on the document
 * element, the JavaScript fallback through the signal.
 *
 * Wire it with {@link mlvPageViewTransitionHook}.
 */
@Injectable({ providedIn: 'root' })
export class MlvPageViewTransition {
  /** @private Owning document; the attribute goes on its root element. */
  private readonly _document = inject(DOCUMENT);

  /** @private Writable source behind {@link active}. */
  private readonly _active = signal(false);

  /** Whether a view transition is in flight right now. */
  readonly active: Signal<boolean> = this._active.asReadonly();

  /**
   * @private Number of overlapping transitions. The router starts a new one
   * for a navigation that interrupts another, and the first to finish must not
   * lift the freeze the second still needs.
   */
  private _depth = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this._depth = 0;
      this._publish(false);
    });
  }

  /**
   * Marks a transition as running until it finishes.
   *
   * @param transition The live transition; its `finished` promise ends the window.
   */
  track(transition: MlvPageViewTransitionLike): void {
    this._depth++;
    this._publish(true);
    const done = (): void => {
      this._depth = Math.max(0, this._depth - 1);
      if (this._depth === 0) {
        this._publish(false);
      }
    };
    transition.finished.then(done, done);
  }

  /** @private Mirrors the flag onto the signal and the document attribute. */
  private _publish(active: boolean): void {
    this._active.set(active);
    const root = this._document.documentElement;
    if (active) {
      root.setAttribute(TRANSITION_ATTRIBUTE, '');
    } else {
      root.removeAttribute(TRANSITION_ATTRIBUTE);
    }
  }
}

/**
 * Builds the `onViewTransitionCreated` callback that tells the page family a
 * transition is in flight.
 *
 * ```ts
 * provideRouter(
 *   routes,
 *   withViewTransitions({ onViewTransitionCreated: mlvPageViewTransitionHook() }),
 * );
 * ```
 *
 * The hook runs inside the router's injection context, which is where the
 * service is resolved from — so there is nothing to provide and nothing to
 * inject at the call site.
 *
 * **No page component stamps a `view-transition-name` by default.** Those
 * names must be unique across the whole document, and a duplicate does not
 * warn: the browser skips *every* transition on the page. Two live page
 * headers — one leaving, one arriving, which is exactly what a view
 * transition is — would be a guaranteed duplicate. Chrome that a shell has
 * only one of can be named, and the opt-in
 * `@malva-ui/core/styles/page-view-transitions.css` does that for the shell's
 * topbar and sidebars so they hold still while the canvas crossfades.
 */
export function mlvPageViewTransitionHook(): (
  info: MlvPageViewTransitionInfoLike,
) => void {
  return (info) => inject(MlvPageViewTransition).track(info.transition);
}
