import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import type { WritableSignal, Signal } from '@angular/core';

/** How the current pinned state came to be. */
type MlvPageSnapPinOrigin = 'manual' | 'scroll';

/**
 * A region of the page chrome that collapses on the snap timeline and can be
 * revealed ahead of it. Implemented by `MlvPageSnap`, which registers itself
 * with the controller so `expand()` can make collapsed chrome focusable.
 */
export interface MlvPageSnapRegion {
  /**
   * Reveals the region immediately, before any tween runs, so a `focus()`
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
 * Owns the snap progress of a page's collapsing top chrome.
 *
 * Progress is **scroll-scrubbed**: `main[mlvPage]` maps its scroll offset onto
 * a 0..1 timeline (`snapRange` pixels of scroll = the full timeline), so
 * chrome motion is proportional to scrolling instead of a time-based
 * animation. The effective value is published as the `--mlv-page-snap` CSS
 * custom property on the page host; elements interpolate their own state from
 * it (see `MlvPageSnap`).
 *
 * Pinning distinguishes its origin:
 * - **Manual** (chevron toggle): an explicit choice — while manually pinned
 *   collapsed, the geometry-compensation spacer is reclaimed (`spacerScale`
 *   tweens to 0) so no dead space remains above the content, including at the
 *   top of the page.
 * - **Scroll** (pin button freezing a scroll-derived state): the frozen state
 *   is a scroll artifact — when the user returns to the top, the controller
 *   unpins automatically and the chrome expands.
 *
 * `expand()` / `collapse()` drive the same manual pin imperatively; `expand()`
 * additionally reveals every registered `MlvPageSnapRegion` on the spot, so
 * consumers can focus a control inside chrome the scroll had collapsed.
 *
 * Provided by `MlvPage`. Inject optionally from header/summary components and
 * snap directives — absence simply means "no scroll-linked behaviour".
 */
@Injectable()
export class MlvPageSnapController {
  /** @private Raw scroll-derived progress, 0 (top) .. 1 (fully snapped). */
  private readonly _scrollProgress = signal(0);

  /**
   * @private Frozen progress while pinned or after a manual toggle;
   * `null` means the progress follows the scroll position.
   */
  private readonly _frozen = signal<number | null>(null);

  /** @private How the current frozen state was produced. */
  private _pinOrigin: MlvPageSnapPinOrigin | null = null;

  /**
   * @private Scale applied by `MlvPage` to the geometry-compensation spacer;
   * tweens to 0 while manually pinned collapsed (dead space reclaimed).
   */
  private readonly _spacerScale = signal(1);

  /** @private Frame handles of the running tweens, per animated signal. */
  private readonly _tweenFrames = new Map<WritableSignal<number>, number>();

  /** @private Adapter so the frozen tween can share the signal tween helper. */
  private readonly _frozenNumber = signal(0);

  /** @private Cancels pending tweens when the owning page is destroyed. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Snap regions that `expand()` reveals ahead of the tween. */
  private readonly _regions = new Set<MlvPageSnapRegion>();

  /** @private Backs the `revealing` bridge flag. */
  private readonly _revealing = signal(false);

  /** Effective snap progress: 0 fully expanded, 1 fully snapped. */
  readonly progress = computed(() => this._frozen() ?? this._scrollProgress());

  /** True while the chrome state is frozen and ignores scrolling. */
  readonly pinned = computed(() => this._frozen() !== null);

  /** True once the chrome is closer to its snapped state than the open one. */
  readonly snapped = computed(() => this.progress() >= 0.5);

  /**
   * @internal True while `expand()` bridges its own tween: snap regions stay
   * visible — and therefore focusable — from the call itself until the
   * progress has left their window. Read by `MlvPageSnap`.
   */
  readonly revealing: Signal<boolean> = this._revealing;

  /**
   * Multiplier for the geometry-compensation spacer, 1 (full compensation)
   * .. 0 (reclaimed). Consumed by `MlvPage`.
   */
  readonly spacerScale: Signal<number> = this._spacerScale;

  constructor() {
    this._destroyRef.onDestroy(() => {
      for (const frame of this._tweenFrames.values()) {
        cancelAnimationFrame(frame);
      }
      this._tweenFrames.clear();
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
   * @internal Called by `MlvPage` on every scroll event of its viewport.
   * A pinned controller keeps reporting the frozen value; a scroll-origin
   * pin releases itself once the user returns to the top, where the frozen
   * scroll artifact would only leave dead space.
   */
  updateFromScroll(scrollTop: number, snapRange: number): void {
    const progress =
      snapRange > 0 ? Math.min(Math.max(scrollTop / snapRange, 0), 1) : 0;
    this._scrollProgress.set(progress);
    if (this.pinned() && this._pinOrigin === 'scroll' && scrollTop <= 1) {
      this.setPinned(false);
    }
  }

  /**
   * Pins the chrome at its current progress (`true`) or releases it back to
   * scroll-following (`false`, animating to the scroll-derived value). A pin
   * taken from a scroll-following state is a scroll-origin pin; pinning while
   * already frozen by the chevron keeps the manual origin.
   */
  setPinned(pinned: boolean): void {
    if (pinned === this.pinned()) {
      return;
    }
    if (pinned) {
      this._cancelTween(this._frozenNumber);
      this._pinOrigin ??= 'scroll';
      this._frozen.set(this.progress());
      return;
    }
    this._pinOrigin = null;
    // Releasing the pin cancels a running expand tween as well.
    this._endReveal();
    this._animateSignal(this._spacerScale, 1);
    this._animateFrozenTo(this._scrollProgress(), () => this._frozen.set(null));
  }

  /**
   * Snaps the chrome fully open or closed (the chevron control). The result
   * is a manual pin — otherwise the very next scroll event would undo the
   * choice. Collapsing manually also reclaims the compensation spacer so no
   * dead space remains above the content.
   */
  toggle(): void {
    if (this.snapped()) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  /**
   * Expands the chrome regardless of the scroll position and pins it there
   * (a manual pin, like the chevron control). Every registered snap region is
   * revealed **synchronously**, before the tween starts, so a consumer can
   * move focus into collapsed chrome in the same task:
   *
   * ```ts
   * this.snap.expand();
   * headerTab.focus();
   * ```
   */
  expand(): void {
    for (const region of this._regions) {
      region.reveal();
    }
    this._revealing.set(true);
    this._pinOrigin = 'manual';
    this._animateSignal(this._spacerScale, 1);
    this._animateFrozenTo(0, () => this._endReveal());
  }

  /**
   * Collapses the chrome regardless of the scroll position and pins it there,
   * reclaiming the compensation spacer so no dead space remains above the
   * content.
   */
  collapse(): void {
    // Collapsing cancels the expand tween, so the bridge that outlived it
    // would strand every region visible-but-scrubbed — an invisible tab stop.
    this._endReveal();
    this._pinOrigin = 'manual';
    this._animateSignal(this._spacerScale, 0);
    this._animateFrozenTo(1);
  }

  /**
   * @private Ends the reveal bridge and hands every region back its own
   * hidden state. `reveal()` writes the DOM ahead of change detection, so a
   * bridge that opens and closes without a render in between would otherwise
   * leave the host binding's cached value disagreeing with the element.
   */
  private _endReveal(): void {
    if (!this._revealing()) {
      return;
    }
    this._revealing.set(false);
    for (const region of this._regions) {
      region.syncHiddenState();
    }
  }

  /** @private Tweens the frozen progress via the shared signal tween. */
  private _animateFrozenTo(target: number, done?: () => void): void {
    this._frozenNumber.set(this.progress());
    this._frozen.set(this.progress());
    this._animateSignal(this._frozenNumber, target, done, (value) =>
      this._frozen.set(value),
    );
  }

  /** @private rAF tween so manual state changes stay smooth. */
  private _animateSignal(
    target: WritableSignal<number>,
    to: number,
    done?: () => void,
    mirror?: (value: number) => void,
  ): void {
    this._cancelTween(target);
    const from = target();
    const reducedMotion =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (
      reducedMotion ||
      typeof requestAnimationFrame === 'undefined' ||
      Math.abs(to - from) < 0.001
    ) {
      target.set(to);
      mirror?.(to);
      done?.();
      return;
    }

    const durationMs = 200;
    let startTime: number | null = null;
    const step = (now: number): void => {
      startTime ??= now;
      const t = Math.min((now - startTime) / durationMs, 1);
      const eased = 1 - (1 - t) ** 3;
      const value = from + (to - from) * eased;
      target.set(value);
      mirror?.(value);
      if (t < 1) {
        this._tweenFrames.set(target, requestAnimationFrame(step));
      } else {
        this._tweenFrames.delete(target);
        done?.();
      }
    };
    this._tweenFrames.set(target, requestAnimationFrame(step));
  }

  /** @private Stops the running tween of one signal, if any. */
  private _cancelTween(target: WritableSignal<number>): void {
    const frame = this._tweenFrames.get(target);
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      this._tweenFrames.delete(target);
    }
  }
}
