import { EMPTY, filter, fromEvent, merge, type Observable, take } from 'rxjs';

/**
 * @internal Emits once, then completes, when the pointer gesture started by
 * `pointerId` ends — on `pointerup`, on `pointercancel`, or when
 * `captureElement` loses pointer capture — whichever comes first.
 *
 * Exported from `@malva-ui/cdk/utils` only so the drag gestures of the other
 * Malva packages (split pane, sidebar rail, drawer resize, slider, scrollbar)
 * share one definition of "the gesture ended"; it is not part of the public
 * API and may change in any release.
 *
 * Every drag that ends on `pointerup` alone stays live forever after the
 * browser cancels the pointer instead — a touch drag turned into a scroll or a
 * pinch, a palm rejection, the tab losing focus mid-drag. And a drag listening
 * on the captured element stays live after capture is lost — another element
 * calling `setPointerCapture`, or the captured element (or an ancestor of it)
 * leaving the document — because the release then goes wherever the pointer
 * is, not to that element.
 * Either way the drag class, the page-wide cursor and `user-select` stay
 * latched and the move listener keeps resizing on the next hover.
 *
 * - Ends from another pointer are ignored, so a second finger that lifts or is
 *   cancelled does not end the first finger's drag.
 * - `lostpointercapture` bubbles, so on `captureElement` it is admitted only
 *   when it was dispatched at `captureElement` itself. A descendant that
 *   captured and released some pointer of its own is not this gesture losing
 *   capture.
 * - When `captureElement` leaves the document — removed itself, or with a
 *   removed ancestor — the browser dispatches `lostpointercapture` at the
 *   **document**, not at the detached element, and sends the later
 *   `pointerup` to whatever is under the pointer (measured in Chromium 153
 *   and Firefox 146; WebKit not measured). So the owner document is heard
 *   too, and a `lostpointercapture` there counts once
 *   `captureElement.isConnected` is `false` — while it is still connected, the
 *   event reaching the document is only the bubble of the arm above.
 *   Deliberately **no** target guard on this arm: once the element is
 *   detached, capture is already gone, so any `lostpointercapture` for this
 *   pointer is a real end — including one an engine dispatches at a connected
 *   ancestor rather than at the document itself.
 * - After a `pointerup` the browser releases implicit capture and fires
 *   `lostpointercapture` too; `take(1)` lets the first end win, so a consumer
 *   can tell a release (`event.type === 'pointerup'`) from an interruption.
 *
 * Pair it with `takeUntil()` on the move stream **and** with
 * `takeUntilDestroyed()`, so a destroy mid-gesture still releases both — see
 * `.claude/projects/best-practices.md` § _DOM Listeners_.
 *
 * @param target — Where the `pointerup` / `pointercancel` listeners attach: the
 *   captured element itself, or a `Document` / `Window` the events bubble to.
 * @param pointerId — The `pointerId` of the `pointerdown` that started the
 *   gesture.
 * @param captureElement — The element the gesture called `setPointerCapture()`
 *   on, or `null` when it captures nothing.
 *
 * @example
 * ```ts
 * const end$ = mlvPointerGestureEnd(handle, down.pointerId, handle);
 * fromEvent<PointerEvent>(handle, 'pointermove')
 *   .pipe(takeUntil(end$), takeUntilDestroyed(this._destroyRef))
 *   .subscribe((move) => this._resize(move));
 * ```
 */
export function mlvPointerGestureEnd(
  target: EventTarget,
  pointerId: number,
  captureElement: Element | null = null,
): Observable<PointerEvent> {
  const lostCapture$ = captureElement
    ? merge(
        fromEvent<PointerEvent>(captureElement, 'lostpointercapture').pipe(
          filter((event) => event.target === captureElement),
        ),
        // The captured element left the document: the browser dispatches the
        // event at the document (see the JSDoc). Read from the element's own
        // document, never the ambient global. No target guard, on purpose.
        fromEvent<PointerEvent>(
          captureElement.ownerDocument,
          'lostpointercapture',
        ).pipe(filter(() => !captureElement.isConnected)),
      )
    : EMPTY;

  return merge(
    fromEvent<PointerEvent>(target, 'pointerup'),
    fromEvent<PointerEvent>(target, 'pointercancel'),
    lostCapture$,
  ).pipe(
    filter((event) => event.pointerId === pointerId),
    take(1),
  );
}
