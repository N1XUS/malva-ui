/**
 * Manages a countdown that can be stopped and restarted.
 * Shared between toast and notification item components.
 *
 * This timer does **not** track remaining time: stopping discards the countdown
 * and the callback, and the item restarts the full `displayTime` when the pointer
 * or focus leaves. That is deliberate — the reading clock restarts once the user
 * stops interacting, rather than resuming a partly-elapsed one.
 */
export class MlvToastTimer {
  /** @private Handle to the active `setTimeout`, or `null` when no timer is running. */
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;

  /** Start (or restart) the timer. Any previous timer is cleared automatically. */
  start(duration: number, onExpire: () => void): void {
    this.clear();
    if (duration > 0) {
      this._timeoutId = setTimeout(onExpire, duration);
    }
  }

  /**
   * Stop the countdown, discarding it. Restart with `start()`.
   *
   * Alias of `clear()`, kept because `pause()` reads correctly at the call sites
   * that stop the countdown on hover or focus.
   */
  pause(): void {
    this.clear();
  }

  /** Clear and discard the timer. */
  clear(): void {
    if (this._timeoutId !== null) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  }
}
