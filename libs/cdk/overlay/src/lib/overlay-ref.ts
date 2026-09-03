import type { OverlayRef } from '@angular/cdk/overlay';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';

/**
 * Abstract base for imperative overlay references (today: `MlvDrawerRef`; the
 * dialog runs on `@angular/cdk/dialog` and wraps the CDK's own ref instead).
 *
 * Handles the shared close lifecycle: emitting `beforeClose()` synchronously,
 * playing the leave animation on the backdrop and panel, disposing the CDK
 * overlay once `animationend` fires (with a fallback timeout for
 * `prefers-reduced-motion`), then emitting the close result on `afterClosed()`.
 *
 * Subclasses supply the CSS class names and fallback duration for their surface.
 * Extend this class and add the concrete class name — do not add an `@Injectable`
 * decorator (refs are created imperatively via `new`).
 *
 * @typeParam R - The result type emitted by `afterClosed()`. Defaults to `unknown`.
 */
export abstract class MlvOverlayRef<R = unknown> {
  /** @private Emits the close result once the overlay is disposed, then completes. */
  private readonly _closedSubject = new Subject<R | undefined>();
  /** @private Emits synchronously when `close()` is called, before the leave animation starts. */
  private readonly _beforeClose = new Subject<void>();
  /** @private Prevents duplicate listeners, timers, and result emissions when close is requested repeatedly. */
  private _closeStarted = false;

  /** @protected CSS class added to the backdrop element to trigger its leave animation. */
  protected abstract readonly _backdropLeavingClass: string;
  /** @protected CSS class added to the panel element to trigger its leave animation. */
  protected abstract readonly _panelLeaveClass: string;
  /** @protected Fallback timeout (ms) used when `animationend` never fires (e.g. reduced motion). */
  protected abstract readonly _leaveFallbackMs: number;

  constructor(
    /** @protected The CDK overlay reference this handle controls. */
    protected readonly _overlayRef: OverlayRef,
  ) {}

  /**
   * Closes the overlay, playing the leave animation before disposing the CDK
   * overlay and emitting `result` on `afterClosed()`.
   *
   * @param result - Optional value forwarded to `afterClosed()` subscribers.
   */
  close(result?: R): void {
    if (this._closeStarted) {
      return;
    }
    this._closeStarted = true;

    this._beforeClose.next();
    this._beforeClose.complete();

    const backdropEl = this._overlayRef.backdropElement;
    if (backdropEl) {
      backdropEl.classList.add(this._backdropLeavingClass);
    }

    const panelEl = this._overlayRef.overlayElement;
    if (panelEl) {
      let disposed = false;
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        clearTimeout(timer);
        this._overlayRef.dispose();
        this._closedSubject.next(result);
        this._closedSubject.complete();
      };

      panelEl.classList.add(this._panelLeaveClass);
      // Kept raw (issue #76 triage): `once: true` detaches the listener on the
      // first event, and whichever of the two paths wins calls `dispose()`,
      // which removes `panelEl` from the DOM along with anything still bound to
      // it. There is also no destroy scope to hand `takeUntilDestroyed` — refs
      // are constructed with `new`, outside any injection context.
      panelEl.addEventListener('animationend', dispose, { once: true });
      const timer = setTimeout(dispose, this._leaveFallbackMs);
    } else {
      this._overlayRef.dispose();
      this._closedSubject.next(result);
      this._closedSubject.complete();
    }
  }

  /** Observable that emits once with the close result after disposal, then completes. */
  afterClosed(): Observable<R | undefined> {
    return this._closedSubject.asObservable();
  }

  /** Observable that emits and completes synchronously when `close()` is called, before the animation. */
  beforeClose(): Observable<void> {
    return this._beforeClose.asObservable();
  }
}
