import type { MlvSchedulerPointerPosition } from './scheduler-drag.service';

/**
 * Milliseconds a touch must rest before a scheduler pointer gesture arms.
 *
 * Shared by range selection (both views) and chip resize, and equal to the
 * SortableJS `delay` the drag service uses for chip drag-moves, so every touch
 * gesture in the scheduler has the same "press, then drag" feel and a plain
 * swipe always scrolls.
 */
export const TOUCH_GESTURE_DELAY = 200;

/**
 * The element under a pointer position, falling back to `fallback`.
 *
 * A gesture that hit-tests cells CANNOT read `event.target` on a `pointermove`:
 * the Pointer Events spec gives a **touch** pointer implicit capture to the
 * element its `pointerdown` landed on, so every subsequent move reports that
 * one element no matter where the finger has travelled. A range selection
 * resolved from the target therefore painted the pressed cell and nothing else
 * on a touch screen, while the same gesture with a mouse — which has no
 * implicit capture — painted the whole range.
 *
 * `elementFromPoint` is the position-based answer both pointer types agree on.
 * It is absent in jsdom and returns `null` for a point outside the viewport, so
 * the caller's own target is kept as the fallback in both cases.
 */
export function elementAt(
  doc: Document,
  at: MlvSchedulerPointerPosition,
  fallback: EventTarget | null,
): EventTarget | null {
  if (typeof doc.elementFromPoint !== 'function') return fallback;
  return doc.elementFromPoint(at.x, at.y) ?? fallback;
}

/** Callbacks of `attachPointerDrag`. */
export interface MlvSchedulerPointerDragHandlers {
  /** Fires once, when the pointer first crosses the threshold. `point` is where the pointer went down. */
  onStart?(point: MlvSchedulerPointerPosition, event: Event): void;
  /** Fires on every pointermove after the threshold. */
  onMove(point: MlvSchedulerPointerPosition, event: Event): void;
  /** Fires on pointerup. `moved` is `false` for a plain click that never crossed the threshold. */
  onEnd(point: MlvSchedulerPointerPosition, moved: boolean, event: Event): void;
  /** Fires on Escape or pointercancel; `onEnd` is not called afterwards. */
  onCancel?(): void;
}

/** Options of `attachPointerDrag`. */
export interface MlvSchedulerPointerDragOptions {
  /** Distance in px before a press becomes a drag. Default `5`. */
  readonly threshold?: number;
  /**
   * Capture the pointer on the element (`setPointerCapture`) so moves keep arriving outside it. Default `true`.
   * Set `false` when the handler needs `event.target` hit-testing (range selection over cells).
   */
  readonly capture?: boolean;
  /** Return `true` for targets that must not start a drag (chips, buttons). */
  ignore?(target: Element): boolean;
  /**
   * Milliseconds a TOUCH pointer must stay still before the gesture arms.
   * Default `0` — touch behaves like mouse and arms at `threshold`.
   *
   * With a delay, a touch that moves before the timer fires abandons the
   * gesture silently: nothing is captured and no default is prevented, so the
   * browser pans the scroller as usual. Once it fires, the gesture takes over
   * — the pointer is captured and `touchmove` is prevented for its duration,
   * which is what stops the browser from starting a pan mid-gesture (the same
   * `delay` + `delayOnTouchOnly` contract SortableJS uses for chip drags).
   * Mouse and pen ignore it and keep the movement threshold.
   */
  readonly touchDelay?: number;
}

/**
 * Minimal press-drag-release tracker on top of Pointer Events. The caller decides the meaning of the
 * coordinates; this only handles button filtering, threshold, capture, cancellation and cleanup.
 * Register inside `NgZone.runOutsideAngular()` — pointermove is a hot path.
 */
export function attachPointerDrag(
  element: HTMLElement,
  handlers: MlvSchedulerPointerDragHandlers,
  options: MlvSchedulerPointerDragOptions = {},
): () => void {
  const threshold = options.threshold ?? 5;
  const capture = options.capture ?? true;
  const touchDelay = options.touchDelay ?? 0;
  const doc = element.ownerDocument;
  let origin: MlvSchedulerPointerPosition | null = null;
  let pointerId: number | null = null;
  let started = false;
  /** `true` between pointerdown and the touch delay firing: the gesture may still be abandoned. */
  let pending = false;
  /** `true` while the running gesture came from a touch pointer under a `touchDelay`. */
  let delayedTouch = false;
  let delayTimer: ReturnType<typeof setTimeout> | null = null;

  /** Swallows `touchmove` so the browser cannot start a pan under an armed gesture. */
  const onTouchMove = (event: Event): void => {
    if (event.cancelable) event.preventDefault();
  };

  const point = (event: Event): MlvSchedulerPointerPosition => {
    const { clientX, clientY } = event as PointerEvent;
    return { x: clientX, y: clientY };
  };

  const stop = (): void => {
    if (delayTimer !== null) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
    pending = false;
    delayedTouch = false;
    element.removeEventListener('touchmove', onTouchMove);
    if (
      pointerId !== null &&
      capture &&
      typeof element.releasePointerCapture === 'function' &&
      element.hasPointerCapture?.(pointerId)
    ) {
      element.releasePointerCapture(pointerId);
    }
    origin = null;
    pointerId = null;
    started = false;
    doc.removeEventListener('pointermove', onMove);
    doc.removeEventListener('pointerup', onUp);
    doc.removeEventListener('pointercancel', onCancel);
    doc.removeEventListener('keydown', onKeydown);
  };

  /**
   * A second pointer (a second finger, or the mouse while a pen is down) must not steer a gesture it
   * did not start. Events without a `pointerId` — jsdom's synthetic ones — are never filtered out.
   */
  const foreign = (event: Event): boolean => {
    const id = (event as PointerEvent).pointerId;
    return pointerId !== null && typeof id === 'number' && id !== pointerId;
  };

  const onMove = (event: Event): void => {
    if (!origin || foreign(event)) return;
    const at = point(event);
    const travelled = Math.hypot(at.x - origin.x, at.y - origin.y);
    // Still waiting out the touch delay: movement means the user is scrolling,
    // so drop the gesture without ever having captured or prevented anything.
    if (pending) {
      if (travelled >= threshold) onCancel();
      return;
    }
    if (!started) {
      if (travelled < threshold) return;
      started = true;
      handlers.onStart?.(origin, event);
    }
    handlers.onMove(at, event);
  };

  const onUp = (event: Event): void => {
    if (!origin || foreign(event)) return;
    const moved = started;
    const at = point(event);
    stop();
    handlers.onEnd(at, moved, event);
  };

  const onCancel = (event?: Event): void => {
    if (!origin || (event && foreign(event))) return;
    stop();
    handlers.onCancel?.();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') onCancel();
  };

  /** Captures the pointer and blocks native panning; the point where a delayed touch gesture takes over. */
  const arm = (): void => {
    pending = false;
    delayTimer = null;
    if (
      capture &&
      pointerId !== null &&
      typeof element.setPointerCapture === 'function'
    ) {
      try {
        element.setPointerCapture(pointerId);
      } catch {
        // jsdom and detached elements throw; the document listeners below still see the events.
      }
    }
    if (delayedTouch) {
      element.addEventListener('touchmove', onTouchMove, { passive: false });
    }
  };

  const onDown = (event: Event): void => {
    // A press while a gesture is already running belongs to another pointer; ignore it entirely
    // rather than re-anchoring the origin under the finger that is already dragging.
    if (origin) return;
    const pe = event as PointerEvent;
    if (pe.button !== undefined && pe.button !== 0) return;
    const target = event.target as Element | null;
    if (target && options.ignore?.(target)) return;
    origin = point(event);
    pointerId = typeof pe.pointerId === 'number' ? pe.pointerId : null;
    started = false;
    if (touchDelay > 0 && pe.pointerType === 'touch') {
      pending = true;
      delayedTouch = true;
      delayTimer = setTimeout(arm, touchDelay);
    } else {
      arm();
    }
    doc.addEventListener('pointermove', onMove);
    doc.addEventListener('pointerup', onUp);
    doc.addEventListener('pointercancel', onCancel);
    doc.addEventListener('keydown', onKeydown);
  };

  element.addEventListener('pointerdown', onDown);
  return () => {
    stop();
    element.removeEventListener('pointerdown', onDown);
  };
}
