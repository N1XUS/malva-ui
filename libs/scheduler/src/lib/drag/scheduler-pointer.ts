import type { MlvSchedulerPointerPosition } from './scheduler-drag.service';

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
  const doc = element.ownerDocument;
  let origin: MlvSchedulerPointerPosition | null = null;
  let pointerId: number | null = null;
  let started = false;

  const point = (event: Event): MlvSchedulerPointerPosition => {
    const { clientX, clientY } = event as PointerEvent;
    return { x: clientX, y: clientY };
  };

  const stop = (): void => {
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

  const onMove = (event: Event): void => {
    if (!origin) return;
    const at = point(event);
    if (!started) {
      if (Math.hypot(at.x - origin.x, at.y - origin.y) < threshold) return;
      started = true;
      handlers.onStart?.(origin, event);
    }
    handlers.onMove(at, event);
  };

  const onUp = (event: Event): void => {
    if (!origin) return;
    const moved = started;
    const at = point(event);
    stop();
    handlers.onEnd(at, moved, event);
  };

  const onCancel = (): void => {
    if (!origin) return;
    stop();
    handlers.onCancel?.();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') onCancel();
  };

  const onDown = (event: Event): void => {
    const pe = event as PointerEvent;
    if (pe.button !== undefined && pe.button !== 0) return;
    const target = event.target as Element | null;
    if (target && options.ignore?.(target)) return;
    origin = point(event);
    pointerId = typeof pe.pointerId === 'number' ? pe.pointerId : null;
    started = false;
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
