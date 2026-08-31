import type { CdkDialogContainer, DialogRef } from '@angular/cdk/dialog';
import type { Signal } from '@angular/core';
import { signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';

import type { MlvDialogConfig } from './dialog-config';

/** Lifecycle of the surface animation driven by `MlvDialogRef.animationState`. */
export type MlvDialogAnimationState = 'enter' | 'idle' | 'leave';

/**
 * Upper bound the leave animation is given before the dialog is disposed
 * anyway (reduced motion, a content root that is not `<mlv-dialog>`, jsdom).
 */
const LEAVE_FALLBACK_MS = 250;

/**
 * Handle returned by `MlvDialogService.open()` (and exposed to content through
 * DI and the template context) for controlling a dialog and receiving its result.
 *
 * Wraps the CDK `DialogRef` the engine creates. `close()` plays the surface's
 * leave animation first — `animationState` flips to `'leave'`, `<mlv-dialog>`
 * adds `.mlv-dialog--leave`, and its `animationend` calls back here — and only
 * then disposes the CDK dialog, so `afterClosed()` emits after the animation.
 *
 * @typeParam R - Result type emitted by `afterClosed()`.
 * @typeParam D - Type of `data`.
 */
export class MlvDialogRef<R = unknown, D = unknown> {
  /** Payload from `MlvDialogConfig.data`. */
  readonly data: D;
  /** The consumer's configuration this dialog was opened with. */
  readonly config: Readonly<MlvDialogConfig<D>>;
  /** Id of the dialog container element (CDK-generated unless `config.id` was set). */
  readonly id: string;
  /** Drives the surface's `--enter` / `--leave` classes. */
  readonly animationState: Signal<MlvDialogAnimationState>;

  /** @private Writable side of {@link animationState}. */
  private readonly _animationState = signal<MlvDialogAnimationState>('enter');
  /** @private Emits once, synchronously, at the start of `close()`. */
  private readonly _beforeClose = new Subject<void>();
  /** @private Guards `close()` against re-entry and late calls. */
  private _closeStarted = false;
  /**
   * @private Set once the CDK dialog has actually closed. From then on the ref
   * is inert: a late `animationend` from the torn-down surface must not move
   * `animationState` or re-enter the close path.
   */
  private _disposed = false;
  /** @private Result captured by the first `close()` call. */
  private _result: R | undefined;
  /** @private Fallback timer that disposes when `animationend` never arrives. */
  private _leaveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    /** @private The CDK reference this handle controls. */
    private readonly _cdkRef: DialogRef<R>,
    config: Readonly<MlvDialogConfig<D>>,
  ) {
    this.config = config;
    this.data = config.data as D;
    this.id = _cdkRef.id;
    this.animationState = this._animationState.asReadonly();

    // The CDK can close without us (history navigation, overlay detachment,
    // CDK closeAll). Treat that as terminal so a later close() is a no-op.
    _cdkRef.closed.subscribe(() => {
      this._closeStarted = true;
      this._disposed = true;
      this._clearLeaveTimer();
      this._beforeClose.complete();
    });
  }

  /**
   * Closes the dialog: emits `beforeClose()`, plays the leave animation, then
   * disposes and emits `result` on `afterClosed()`. Idempotent.
   *
   * @param result - Value forwarded to `afterClosed()` subscribers.
   */
  close(result?: R): void {
    if (this._closeStarted) {
      return;
    }
    this._closeStarted = true;
    this._result = result;

    this._beforeClose.next();
    this._beforeClose.complete();

    this._cdkRef.overlayRef.backdropElement?.classList.add(
      'mlv-dialog-backdrop--leaving',
    );
    this._animationState.set('leave');
    this._leaveTimer = setTimeout(() => this._finishClose(), LEAVE_FALLBACK_MS);
  }

  /** Emits once with the close result after the dialog is disposed, then completes. */
  afterClosed(): Observable<R | undefined> {
    return this._cdkRef.closed;
  }

  /** Emits and completes synchronously when `close()` is called, before the leave animation. */
  beforeClose(): Observable<void> {
    return this._beforeClose.asObservable();
  }

  /**
   * Keydown events that reach this dialog. The CDK delivers a keydown only to
   * the topmost overlay with keydown observers, so a dialog (or a select /
   * combobox popup) opened on top of this one receives Escape instead of it.
   * Pair with `closeOnEscape: false` to run a close guard yourself.
   */
  keydownEvents(): Observable<KeyboardEvent> {
    return this._cdkRef.keydownEvents;
  }

  /** Backdrop clicks on this dialog. Pair with `closeOnBackdrop: false` to run a close guard yourself. */
  backdropClick(): Observable<MouseEvent> {
    return this._cdkRef.backdropClick;
  }

  /** Updates the overlay pane's width and/or height. */
  updateSize(width?: string | number, height?: string | number): this {
    this._cdkRef.updateSize(width, height);
    return this;
  }

  /** Adds class(es) to the overlay pane. */
  addPanelClass(classes: string | string[]): this {
    this._cdkRef.addPanelClass(classes);
    return this;
  }

  /** Removes class(es) from the overlay pane. */
  removePanelClass(classes: string | string[]): this {
    this._cdkRef.removePanelClass(classes);
    return this;
  }

  /**
   * @internal Called by `<mlv-dialog>` when its own CSS animation ends:
   * the enter animation settles to `'idle'`, the leave animation disposes.
   */
  _onSurfaceAnimationEnd(): void {
    if (this._disposed) {
      return;
    }
    const state = this._animationState();
    if (state === 'enter') {
      this._animationState.set('idle');
    } else if (state === 'leave') {
      this._finishClose();
    }
  }

  /**
   * @internal Registers `id` as a label of the dialog. Used by
   * `mlv-dialog-header` so the visible title becomes the accessible name.
   * `ariaLabelledBy` from the config is queued first by the CDK container and
   * therefore still wins; `ariaLabel` suppresses `aria-labelledby` entirely.
   */
  _labelBy(id: string): void {
    this._container()?._addAriaLabelledBy(id);
  }

  /** @internal Reverses {@link _labelBy} when the header is destroyed. */
  _unlabelBy(id: string): void {
    this._container()?._removeAriaLabelledBy(id);
  }

  /** @private The CDK container while the dialog is open, `null` once disposed. */
  private _container(): CdkDialogContainer | null {
    return (
      (this._cdkRef
        .containerInstance as unknown as CdkDialogContainer | null) ?? null
    );
  }

  /** @private Disposes the CDK dialog with the captured result. Safe to call twice. */
  private _finishClose(): void {
    this._clearLeaveTimer();
    if (this._cdkRef.containerInstance) {
      this._cdkRef.close(this._result);
    }
  }

  /** @private Cancels the fallback timer if it is pending. */
  private _clearLeaveTimer(): void {
    if (this._leaveTimer !== undefined) {
      clearTimeout(this._leaveTimer);
      this._leaveTimer = undefined;
    }
  }
}
