import { describe, expect, it, vi } from 'vitest';
import { attachPointerDrag } from './scheduler-pointer';

/** jsdom has no PointerEvent; a plain Event with the pointer fields set is what the helper reads. */
function pointerEvent(
  type: string,
  x: number,
  y: number,
  extra: Record<string, unknown> = {},
): Event {
  return Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
    ...extra,
  });
}

describe('attachPointerDrag', () => {
  it('starts after the threshold, reports moves and ends with moved = true', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const onStart = vi.fn();
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const detach = attachPointerDrag(
      el,
      { onStart, onMove, onEnd },
      { threshold: 5 },
    );

    el.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    el.dispatchEvent(pointerEvent('pointermove', 12, 12)); // below threshold
    expect(onStart).not.toHaveBeenCalled();
    el.dispatchEvent(pointerEvent('pointermove', 30, 12));
    expect(onStart).toHaveBeenCalledWith({ x: 10, y: 10 }, expect.any(Event));
    expect(onMove).toHaveBeenCalledWith({ x: 30, y: 12 }, expect.any(Event));
    el.dispatchEvent(pointerEvent('pointerup', 31, 12));
    expect(onEnd).toHaveBeenCalledWith(
      { x: 31, y: 12 },
      true,
      expect.any(Event),
    );
    detach();
    el.remove();
  });

  it('ends with moved = false for a plain click (no threshold crossed)', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const onEnd = vi.fn();
    const onMove = vi.fn();
    const detach = attachPointerDrag(el, { onMove, onEnd }, { threshold: 5 });
    el.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    el.dispatchEvent(pointerEvent('pointerup', 11, 10));
    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledWith(
      { x: 11, y: 10 },
      false,
      expect.any(Event),
    );
    detach();
    el.remove();
  });

  it('ignores secondary buttons and ignored targets', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const child = document.createElement('span');
    child.className = 'skip';
    el.appendChild(child);
    const onEnd = vi.fn();
    const detach = attachPointerDrag(
      el,
      { onMove: vi.fn(), onEnd },
      { ignore: (t) => t.classList.contains('skip') },
    );
    el.dispatchEvent(pointerEvent('pointerdown', 0, 0, { button: 2 }));
    el.dispatchEvent(pointerEvent('pointerup', 0, 0, { button: 2 }));
    child.dispatchEvent(pointerEvent('pointerdown', 0, 0));
    child.dispatchEvent(pointerEvent('pointerup', 0, 0));
    expect(onEnd).not.toHaveBeenCalled();
    detach();
    el.remove();
  });

  it('cancels on Escape and on pointercancel without calling onEnd', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const onCancel = vi.fn();
    const onEnd = vi.fn();
    const detach = attachPointerDrag(el, { onMove: vi.fn(), onEnd, onCancel });
    el.dispatchEvent(pointerEvent('pointerdown', 0, 0));
    el.dispatchEvent(pointerEvent('pointermove', 20, 0));
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
    el.dispatchEvent(pointerEvent('pointerup', 20, 0));
    expect(onEnd).not.toHaveBeenCalled();

    el.dispatchEvent(pointerEvent('pointerdown', 0, 0));
    el.dispatchEvent(pointerEvent('pointercancel', 0, 0));
    expect(onCancel).toHaveBeenCalledTimes(2);
    detach();
    el.remove();
  });

  it('ignores a second pointerdown while a gesture is running', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const detach = attachPointerDrag(
      el,
      { onStart, onMove: vi.fn(), onEnd },
      { threshold: 5 },
    );

    el.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    // A second finger lands elsewhere: re-anchoring the origin here would make
    // the running gesture jump, and would leak a second set of listeners.
    el.dispatchEvent(pointerEvent('pointerdown', 200, 200, { pointerId: 2 }));
    el.dispatchEvent(pointerEvent('pointermove', 40, 10));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith({ x: 10, y: 10 }, expect.any(Event));

    el.dispatchEvent(pointerEvent('pointerup', 40, 10));
    expect(onEnd).toHaveBeenCalledTimes(1);
    detach();
    el.remove();
  });

  it('only follows the pointer that started the gesture', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const onCancel = vi.fn();
    const detach = attachPointerDrag(
      el,
      { onMove, onEnd, onCancel },
      { threshold: 5 },
    );

    el.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    el.dispatchEvent(pointerEvent('pointermove', 90, 90, { pointerId: 2 }));
    el.dispatchEvent(pointerEvent('pointercancel', 90, 90, { pointerId: 2 }));
    el.dispatchEvent(pointerEvent('pointerup', 90, 90, { pointerId: 2 }));
    expect(onMove).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();

    el.dispatchEvent(pointerEvent('pointermove', 40, 10));
    el.dispatchEvent(pointerEvent('pointerup', 40, 10));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    detach();
    el.remove();
  });

  describe('touchDelay', () => {
    /** Captures whether the element got a non-passive `touchmove` blocker. */
    function trackTouchMove(el: HTMLElement): () => boolean {
      let armed = false;
      const add = el.addEventListener.bind(el);
      const remove = el.removeEventListener.bind(el);
      el.addEventListener = ((type: string, ...rest: unknown[]) => {
        if (type === 'touchmove') armed = true;
        return (add as (...a: unknown[]) => void)(type, ...rest);
      }) as typeof el.addEventListener;
      el.removeEventListener = ((type: string, ...rest: unknown[]) => {
        if (type === 'touchmove') armed = false;
        return (remove as (...a: unknown[]) => void)(type, ...rest);
      }) as typeof el.removeEventListener;
      return () => armed;
    }

    it('abandons a touch gesture that moves before the delay fires', () => {
      vi.useFakeTimers();
      const el = document.createElement('div');
      document.body.appendChild(el);
      const capture = vi.fn();
      el.setPointerCapture = capture;
      const isArmed = trackTouchMove(el);
      const onStart = vi.fn();
      const onMove = vi.fn();
      const onCancel = vi.fn();
      const detach = attachPointerDrag(
        el,
        { onStart, onMove, onEnd: vi.fn(), onCancel },
        { threshold: 5, touchDelay: 200 },
      );

      el.dispatchEvent(
        pointerEvent('pointerdown', 10, 10, { pointerType: 'touch' }),
      );
      // Nothing is claimed yet: no capture, no touchmove blocker — the
      // browser is free to pan the scroller.
      expect(capture).not.toHaveBeenCalled();
      expect(isArmed()).toBe(false);

      vi.advanceTimersByTime(150);
      el.dispatchEvent(
        pointerEvent('pointermove', 10, 40, { pointerType: 'touch' }),
      );
      expect(onStart).not.toHaveBeenCalled();
      expect(onMove).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);

      // The abandoned gesture is fully torn down: the timer cannot revive it.
      vi.advanceTimersByTime(500);
      expect(capture).not.toHaveBeenCalled();
      detach();
      el.remove();
      vi.useRealTimers();
    });

    it('arms a touch gesture that rests for the delay, and blocks native panning', () => {
      vi.useFakeTimers();
      const el = document.createElement('div');
      document.body.appendChild(el);
      el.setPointerCapture = vi.fn();
      el.hasPointerCapture = () => true;
      el.releasePointerCapture = vi.fn();
      const isArmed = trackTouchMove(el);
      const onStart = vi.fn();
      const onMove = vi.fn();
      const detach = attachPointerDrag(
        el,
        { onStart, onMove, onEnd: vi.fn() },
        { threshold: 5, touchDelay: 200 },
      );

      el.dispatchEvent(
        pointerEvent('pointerdown', 10, 10, { pointerType: 'touch' }),
      );
      vi.advanceTimersByTime(200);
      expect(el.setPointerCapture).toHaveBeenCalledWith(1);
      expect(isArmed()).toBe(true);
      const touchMove = new Event('touchmove', { cancelable: true });
      el.dispatchEvent(touchMove);
      expect(touchMove.defaultPrevented).toBe(true);

      el.dispatchEvent(
        pointerEvent('pointermove', 10, 40, { pointerType: 'touch' }),
      );
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onMove).toHaveBeenCalledTimes(1);

      el.dispatchEvent(
        pointerEvent('pointerup', 10, 40, { pointerType: 'touch' }),
      );
      expect(isArmed()).toBe(false);
      detach();
      el.remove();
      vi.useRealTimers();
    });

    it('leaves a mouse pointer on the movement threshold', () => {
      vi.useFakeTimers();
      const el = document.createElement('div');
      document.body.appendChild(el);
      const isArmed = trackTouchMove(el);
      const onStart = vi.fn();
      const detach = attachPointerDrag(
        el,
        { onStart, onMove: vi.fn(), onEnd: vi.fn() },
        { threshold: 5, touchDelay: 200 },
      );

      el.dispatchEvent(pointerEvent('pointerdown', 10, 10));
      el.dispatchEvent(pointerEvent('pointermove', 30, 10)); // no wait
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(isArmed()).toBe(false); // touchmove blocking is touch-only
      detach();
      el.remove();
      vi.useRealTimers();
    });
  });

  it('stops listening after detach', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const onEnd = vi.fn();
    const detach = attachPointerDrag(el, { onMove: vi.fn(), onEnd });
    detach();
    el.dispatchEvent(pointerEvent('pointerdown', 0, 0));
    el.dispatchEvent(pointerEvent('pointerup', 0, 0));
    expect(onEnd).not.toHaveBeenCalled();
    el.remove();
  });
});
