import { signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';

import type { MlvBaseToastRef } from './toast.types';

/**
 * Handle returned by `MlvToastService.show()` and `MlvToastService.open()`.
 *
 * It can be injected by component content, is exposed to template content, and
 * guarantees that repeated close requests only reach the service once.
 *
 * @typeParam D - Type of the data supplied for this toast.
 */
export class MlvToastRef<D = unknown> implements MlvBaseToastRef {
  /** Unique ID assigned by the toast or notification service. */
  readonly id: string;
  /** Data supplied through the toast or notification configuration. */
  readonly data: D;

  /** @private Emits once when the toast has been removed by its service. */
  private readonly _afterClosed = new Subject<void>();
  /** @private Mutable backing state for the public `closed` signal. */
  private readonly _closed = signal(false);
  /** @private Callback that routes closure through the owning service. */
  private readonly _requestClose: () => void;
  /** @private Prevents duplicate service close requests. */
  private _closeRequested = false;

  /** Whether this toast has finished its service-owned close lifecycle. */
  readonly closed = this._closed.asReadonly();

  constructor(id: string, data: D, requestClose: () => void) {
    this.id = id;
    this.data = data;
    this._requestClose = requestClose;
  }

  /** Requests programmatic dismissal of this toast. Safe to call repeatedly. */
  close(): void {
    if (this._closeRequested || this._closed()) {
      return;
    }
    this._closeRequested = true;
    this._requestClose();
  }

  /** Emits once when the owning service removes the toast, then completes. */
  afterClosed(): Observable<void> {
    return this._afterClosed.asObservable();
  }

  /** @internal Completes this reference exactly once from the owning service. */
  _markClosed(): void {
    if (this._closed()) {
      return;
    }
    this._closed.set(true);
    this._afterClosed.next();
    this._afterClosed.complete();
  }
}
