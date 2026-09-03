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
