import { mlvPointerGestureEnd } from './pointer-gesture-end';

/** jsdom ships no `PointerEvent`; the repo builds them from `MouseEvent`. */
function pointerEvent(type: string, pointerId = 1): PointerEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event as unknown as PointerEvent;
}

describe('mlvPointerGestureEnd', () => {
  let host: HTMLElement;
  let child: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    child = document.createElement('span');
    host.appendChild(child);
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
    vi.restoreAllMocks();
  });

  function collect(
    target: EventTarget,
    captureElement: Element | null = host,
  ): { types: string[]; completed: () => boolean } {
    const types: string[] = [];
    let completed = false;
    mlvPointerGestureEnd(target, 1, captureElement).subscribe({
      next: (event) => types.push(event.type),
      complete: () => (completed = true),
    });
    return { types, completed: () => completed };
  }

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])(
    'emits once and completes on %s',
    (type) => {
      const end = collect(host);
      host.dispatchEvent(pointerEvent(type));

      expect(end.types).toEqual([type]);
      expect(end.completed()).toBe(true);
    },
  );

  it('lets a pointerup win over the lostpointercapture that follows it', () => {
    const end = collect(host);
    host.dispatchEvent(pointerEvent('pointerup'));
    host.dispatchEvent(pointerEvent('lostpointercapture'));

    expect(end.types).toEqual(['pointerup']);
  });

  it('ignores ends from another pointer', () => {
    const end = collect(host);
    host.dispatchEvent(pointerEvent('pointercancel', 2));
    host.dispatchEvent(pointerEvent('pointerup', 2));
    host.dispatchEvent(pointerEvent('lostpointercapture', 2));

    expect(end.types).toEqual([]);
    expect(end.completed()).toBe(false);
  });

  it('ignores a lostpointercapture bubbling up from a descendant', () => {
    const end = collect(host);
    child.dispatchEvent(pointerEvent('lostpointercapture'));

    expect(end.types).toEqual([]);

    host.dispatchEvent(pointerEvent('lostpointercapture'));
    expect(end.types).toEqual(['lostpointercapture']);
  });

  it('hears pointerup / pointercancel bubbling to a document target', () => {
    const end = collect(document);
    child.dispatchEvent(pointerEvent('pointercancel'));

    expect(end.types).toEqual(['pointercancel']);
  });

  it('listens for no lost capture when nothing was captured', () => {
    const end = collect(host, null);
    host.dispatchEvent(pointerEvent('lostpointercapture'));

    expect(end.types).toEqual([]);

    host.dispatchEvent(pointerEvent('pointerup'));
    expect(end.types).toEqual(['pointerup']);
  });

  describe('captured element removed mid-gesture', () => {
    // Chromium 153 and Firefox 146 (measured): removing the capturing element,
    // or an ancestor of it, dispatches `lostpointercapture` at the document,
    // not at the element, and the later `pointerup` targets whatever is under
    // the pointer. jsdom has no pointer capture, so each spec dispatches what
    // those engines dispatch.

    it('ends on the lostpointercapture the document receives', () => {
      const end = collect(host);
      host.remove();
      document.dispatchEvent(pointerEvent('lostpointercapture'));

      expect(end.types).toEqual(['lostpointercapture']);
      expect(end.completed()).toBe(true);
    });

    it('ends when an ancestor of the captured element is removed', () => {
      const end = collect(child, child);
      host.remove();
      document.dispatchEvent(pointerEvent('lostpointercapture'));

      expect(end.types).toEqual(['lostpointercapture']);
    });

    it('ends on a lostpointercapture dispatched at a connected ancestor', () => {
      // Deliberately no target guard on the document arm: once the element is
      // detached its capture is gone, so an engine dispatching the event at a
      // connected ancestor instead of the document still ends the gesture.
      const end = collect(host);
      host.remove();
      document.body.dispatchEvent(pointerEvent('lostpointercapture'));

      expect(end.types).toEqual(['lostpointercapture']);
      expect(end.completed()).toBe(true);
    });

    it('would not end on the release the browser sends elsewhere', () => {
      const end = collect(host);
      host.remove();
      document.body.dispatchEvent(pointerEvent('pointerup'));

      // The element-level `pointerup` arm never hears it — which is why the
      // document arm exists.
      expect(end.types).toEqual([]);
    });

    it('ignores a lostpointercapture at the document while the element is connected', () => {
      const end = collect(host);
      document.dispatchEvent(pointerEvent('lostpointercapture'));

      expect(end.types).toEqual([]);
      expect(end.completed()).toBe(false);
    });

    it('ignores another pointer losing capture at the document', () => {
      const end = collect(host);
      host.remove();
      document.dispatchEvent(pointerEvent('lostpointercapture', 2));

      expect(end.types).toEqual([]);
    });
  });

  it('removes all of its listeners once it has emitted', () => {
    const add = vi.spyOn(host, 'addEventListener');
    const remove = vi.spyOn(host, 'removeEventListener');
    const addOnDocument = vi.spyOn(document, 'addEventListener');
    const removeOnDocument = vi.spyOn(document, 'removeEventListener');
    collect(host);
    expect(add).toHaveBeenCalledTimes(3);
    expect(addOnDocument).toHaveBeenCalledTimes(1);

    host.dispatchEvent(pointerEvent('pointercancel'));

    expect(remove).toHaveBeenCalledTimes(3);
    expect(removeOnDocument).toHaveBeenCalledTimes(1);
  });
});
