import { DestroyRef, DOCUMENT, inject, Injectable } from '@angular/core';
import type { Subscription } from 'rxjs';
import { fromEvent, merge } from 'rxjs';

/**
 * A swipe row as the coordinator sees it: something that can be closed and
 * can say whether a DOM node is inside it.
 */
export interface MlvSwipeActionsParticipant {
  /** Scrolls the row back onto its content. */
  close(): void;
  /** Whether `target` is inside the row's own DOM. */
  contains(target: EventTarget | null): boolean;
}

/**
 * Keeps at most one swipe row revealed at a time, application-wide, and owns
 * the single document listener that closes it from the outside.
 *
 * Rows register the moment they leave their closed offset ({@link activate})
 * and unregister when they rest on it again or are destroyed
 * ({@link release}). Activating a second row closes the first — the iOS
 * behaviour where starting to swipe another cell dismisses the open one — and
 * only while some row is active does the document carry a capture-phase
 * `pointerdown` and a `focusin` listener; a press or a focus move outside the
 * active row closes it. Nothing is attached while every row is closed, however
 * many rows a list renders.
 *
 * Internal to `@malva-ui/core/swipe-actions`; not part of the public barrel.
 */
@Injectable({ providedIn: 'root' })
export class MlvSwipeActionsCoordinator {
  /** @private Document the outside-press / focus-out listeners bind to. */
  private readonly _document = inject(DOCUMENT);

  /** @private The row currently displaced from its closed offset, if any. */
  private _active: MlvSwipeActionsParticipant | null = null;

  /** @private The document listeners, attached only while a row is active. */
  private _outside: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this._stopListening());
  }

  /**
   * Marks `row` as the displaced one, closing whichever row held that role
   * before, and makes sure the document listeners are attached.
   */
  activate(row: MlvSwipeActionsParticipant): void {
    if (this._active === row) return;
    this._active?.close();
    this._active = row;
    this._startListening();
  }

  /**
   * Clears `row` as the displaced one and drops the document listeners.
   * Ignored when another row has taken over in the meantime.
   */
  release(row: MlvSwipeActionsParticipant): void {
    if (this._active !== row) return;
    this._active = null;
    this._stopListening();
  }

  /**
   * @private Attaches the outside listeners once. `pointerdown` is bound in
   * the capture phase so an inner `stopPropagation()` cannot hide a press
   * from it, and passively because it never prevents anything. Both streams
   * are owned by `_outside` rather than `takeUntilDestroyed`: they are
   * re-created per active row, and a root service is destroyed only with the
   * application.
   */
  private _startListening(): void {
    if (this._outside) return;
    this._outside = merge(
      fromEvent<PointerEvent>(this._document, 'pointerdown', {
        capture: true,
        passive: true,
      }),
      fromEvent<FocusEvent>(this._document, 'focusin'),
    ).subscribe((event) => {
      const active = this._active;
      if (active && !active.contains(event.target)) active.close();
    });
  }

  /** @private Detaches the outside listeners. */
  private _stopListening(): void {
    this._outside?.unsubscribe();
    this._outside = null;
  }
}
