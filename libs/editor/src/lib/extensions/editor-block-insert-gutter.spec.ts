import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MlvEditorBlockHandleInsertRequest } from './editor-block-handle';
import { MlvEditorBlockHandle } from './editor-block-handle';
import {
  MLV_EDITOR_BLOCK_ADD_PRESS_SLOP,
  mlvEditorBlockInserter,
  mlvEditorInsertSlotRect,
  mlvEditorIsInsertChord,
} from './editor-block-inserter';

const THREE_BLOCKS = '<p>A</p><p>B</p><p>C</p>';

/** A plain `DOMRect`-shaped value; jsdom has no `DOMRect` constructor. */
function rect(left: number, top: number, width: number, height: number) {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

/** A `(hover: none)` media query list the spec can flip. */
interface FakeQuery {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

describe('MlvEditorBlockHandle insert (#516, U6)', () => {
  const mounts: HTMLElement[] = [];

  // jsdom performs no hit testing; see `editor-block-handle.spec.ts`.
  beforeAll(() => {
    const target = document as Document & {
      elementFromPoint?: (x: number, y: number) => Element | null;
    };
    target.elementFromPoint ??= () => null;
  });

  afterEach(() => {
    while (mounts.length) mounts.pop()?.remove();
    vi.restoreAllMocks();
    delete (document.defaultView as Partial<Window>).matchMedia;
  });

  function createHarness(
    options: {
      insert?: boolean;
      content?: string;
      touch?: FakeQuery;
      dir?: 'rtl' | 'ltr';
    } = {},
  ) {
    const { insert = true, content = THREE_BLOCKS, touch, dir } = options;
    const scope = document.createElement('div');
    if (dir) scope.setAttribute('dir', dir);
    document.body.appendChild(scope);
    mounts.push(scope);
    const mount = document.createElement('div');
    mount.style.position = 'relative';
    scope.appendChild(mount);
    const host = document.createElement('div');
    mount.appendChild(host);
    if (touch) {
      // jsdom implements no `matchMedia`; the inserter reads the mount's
      // window, so the stub goes there and `afterEach` removes it.
      Object.defineProperty(document.defaultView as Window, 'matchMedia', {
        configurable: true,
        value: (query: string) =>
          query === '(hover: none)'
            ? touch
            : {
                matches: false,
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
              },
      });
    }

    let insertEnabled = true;
    let label = 'Insert block';
    const requests: MlvEditorBlockHandleInsertRequest[] = [];
    const editor = new Editor({
      element: host,
      content,
      extensions: [
        StarterKit,
        MlvEditorBlockHandle.configure({
          mount: () => mount,
          label: () => 'Drag block',
          announceMove: () => undefined,
          enabled: () => true,
          ...(insert
            ? {
                insert: {
                  enabled: () => insertEnabled,
                  label: () => label,
                  open: (request) => requests.push(request),
                },
              }
            : {}),
        }),
      ],
    });
    vi.spyOn(mount, 'getBoundingClientRect').mockReturnValue(
      rect(0, 0, 400, 300),
    );
    Object.defineProperty(mount, 'offsetWidth', {
      value: 400,
      configurable: true,
    });
    // Blocks at 30–50, 60–80, 90–110, as the handle spec lays them out.
    [...editor.view.dom.children].forEach((child, index) =>
      vi
        .spyOn(child, 'getBoundingClientRect')
        .mockReturnValue(rect(48, 30 + index * 30, 304, 20)),
    );

    return {
      editor,
      mount,
      requests,
      setInsertEnabled: (value: boolean) => {
        insertEnabled = value;
      },
      setLabel: (value: string) => {
        label = value;
      },
      add: () =>
        mount.querySelector('.mlv-editor__block-add') as HTMLElement | null,
      indicator: () =>
        mount.querySelector('.mlv-editor__drop-indicator') as HTMLElement,
      target: () =>
        mount.querySelector('.mlv-editor__block-target') as HTMLElement | null,
      hover: (clientY: number) =>
        mount.dispatchEvent(
          new MouseEvent('mousemove', { clientX: 10, clientY }),
        ),
      /** Runs the plugin views' `update` without a document change. */
      refresh: () => editor.view.dispatch(editor.state.tr.setMeta('x', 1)),
    };
  }

  /** A keydown ProseMirror sees on its content element. */
  function chord(
    view: HTMLElement,
    init: KeyboardEventInit = {},
    altGraph = false,
  ): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    if (altGraph) {
      Object.defineProperty(event, 'getModifierState', {
        value: (key: string) => key === 'AltGraph',
      });
    }
    view.dispatchEvent(event);
    return event;
  }

  it('renders an aria-hidden, unfocusable "+" beside the hovered block only while enabled', () => {
    const { editor, add, hover, setInsertEnabled, refresh } = createHarness();
    try {
      expect(add()).toBeNull();
      hover(65);
      const element = add();
      expect(element?.getAttribute('data-visible')).toBe('true');
      expect(element?.getAttribute('aria-hidden')).toBe('true');
      expect(element?.hasAttribute('tabindex')).toBe(false);
      expect(element?.title).toBe('Insert block');
      expect(element?.style.top).toBe('60px');

      setInsertEnabled(false);
      refresh();
      expect(add()).toBeNull();
      hover(95);
      expect(add()).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it('renders no "+" and claims no chord without an insert option', () => {
    const { editor, add, hover } = createHarness({ insert: false });
    try {
      hover(65);
      expect(add()).toBeNull();
      editor.commands.setTextSelection(1);
      expect(chord(editor.view.dom).defaultPrevented).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('keeps focus and selection on press and opens the hovered block on click', () => {
    const { editor, add, hover, requests } = createHarness();
    try {
      hover(65);
      const element = add() as HTMLElement;
      const press = new MouseEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(press, 'pointerType', { value: 'mouse' });
      element.dispatchEvent(press);
      expect(press.defaultPrevented).toBe(true);

      element.click();
      expect(requests.map(({ pos, via }) => ({ pos, via }))).toEqual([
        { pos: 3, via: 'pointer' },
      ]);
    } finally {
      editor.destroy();
    }
  });

  it('opens the caret block on Mod+Alt+Enter while enabled, and leaves the key alone otherwise', () => {
    const { editor, requests, setInsertEnabled } = createHarness();
    try {
      editor.commands.setTextSelection(4);
      const opened = chord(editor.view.dom);
      expect(opened.defaultPrevented).toBe(true);
      expect(requests.map(({ pos, via }) => ({ pos, via }))).toEqual([
        { pos: 3, via: 'keyboard' },
      ]);

      setInsertEnabled(false);
      expect(chord(editor.view.dom).defaultPrevented).toBe(false);
      expect(requests).toHaveLength(1);
    } finally {
      editor.destroy();
    }
  });

  it('ignores a chord that reports AltGraph (D-B6)', () => {
    const { editor, requests } = createHarness();
    try {
      editor.commands.setTextSelection(4);
      const event = chord(editor.view.dom, {}, true);
      expect(event.defaultPrevented).toBe(false);
      expect(requests).toHaveLength(0);
    } finally {
      editor.destroy();
    }
  });

  it('reads Mod as Meta on Apple platforms and Control elsewhere, never with Shift', () => {
    const at = (init: KeyboardEventInit) =>
      new KeyboardEvent('keydown', { key: 'Enter', altKey: true, ...init });
    expect(mlvEditorIsInsertChord(at({ metaKey: true }), true)).toBe(true);
    expect(mlvEditorIsInsertChord(at({ ctrlKey: true }), true)).toBe(false);
    expect(mlvEditorIsInsertChord(at({ ctrlKey: true }), false)).toBe(true);
    expect(mlvEditorIsInsertChord(at({ metaKey: true }), false)).toBe(false);
    expect(
      mlvEditorIsInsertChord(at({ ctrlKey: true, shiftKey: true }), false),
    ).toBe(false);
    expect(
      mlvEditorIsInsertChord(
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }),
        false,
      ),
    ).toBe(false);
  });

  it('maps its block through edits and hides when the block is deleted', () => {
    const { editor, add, hover, requests } = createHarness();
    try {
      hover(65);
      editor.commands.insertContentAt(1, 'X');
      (add() as HTMLElement).click();
      expect(requests.at(-1)?.pos).toBe(4);

      editor.commands.deleteRange({ from: 4, to: 7 });
      expect(add()?.getAttribute('data-visible')).toBe('false');
      (add() as HTMLElement).click();
      expect(requests).toHaveLength(1);
    } finally {
      editor.destroy();
    }
  });

  it('hides on a whole-document replace and comes back on the next move', () => {
    const { editor, add, hover } = createHarness();
    try {
      hover(35);
      expect(add()?.getAttribute('data-visible')).toBe('true');
      editor.commands.setContent('<p>Q</p><p>R</p><p>S</p>');
      expect(add()?.getAttribute('data-visible')).toBe('false');

      [...editor.view.dom.children].forEach((child, index) =>
        vi
          .spyOn(child, 'getBoundingClientRect')
          .mockReturnValue(rect(48, 30 + index * 30, 304, 20)),
      );
      hover(35);
      expect(add()?.getAttribute('data-visible')).toBe('true');
    } finally {
      editor.destroy();
    }
  });

  it('follows the caret block under (hover: none) while the content has focus', () => {
    const touch: FakeQuery = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const { editor, add, hover, requests } = createHarness({ touch });
    try {
      hover(95);
      expect(add()).toBeNull();

      editor.view.dom.focus();
      editor.commands.setTextSelection(4);
      expect(add()?.getAttribute('data-visible')).toBe('true');
      expect(add()?.style.top).toBe('60px');

      // A touch press keeps it shown through the blur the tap causes
      // (§ 17 item 8 fallback), so the click still lands.
      const press = new MouseEvent('pointerdown', { cancelable: true });
      Object.defineProperty(press, 'pointerType', { value: 'touch' });
      add()?.dispatchEvent(press);
      editor.view.dom.blur();
      editor.view.dispatch(editor.state.tr.setMeta('x', 1));
      expect(add()?.getAttribute('data-visible')).toBe('true');
      add()?.click();
      expect(requests.map(({ via }) => via)).toEqual(['pointer']);

      editor.view.dispatch(editor.state.tr.setMeta('x', 2));
      expect(add()?.getAttribute('data-visible')).toBe('false');
    } finally {
      editor.destroy();
    }
    expect(touch.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });

  it('opens on the release of a touch or pen press and ignores a later click (§ 17 item 8)', () => {
    const touch: FakeQuery = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const { editor, add, requests } = createHarness({ touch });
    try {
      editor.view.dom.focus();
      editor.commands.setTextSelection(4);
      const element = add() as HTMLElement;
      const pointer = (type: string, pointerType: string) => {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'pointerType', { value: pointerType });
        element.dispatchEvent(event);
        return event;
      };

      // WebKit sends no click after a prevented touch pointerdown (measured,
      // e2e): the release opens the menu.
      expect(pointer('pointerdown', 'touch').defaultPrevented).toBe(true);
      pointer('pointerup', 'touch');
      expect(requests.map(({ pos, via }) => ({ pos, via }))).toEqual([
        { pos: 3, via: 'pointer' },
      ]);
      // Chromium's compatibility click is cancelled at touchend; one that
      // still arrives (a pen without touch events) opens nothing more.
      const end = new Event('touchend', { bubbles: true, cancelable: true });
      element.dispatchEvent(end);
      expect(end.defaultPrevented).toBe(true);
      element.click();
      expect(requests).toHaveLength(1);

      pointer('pointerdown', 'pen');
      pointer('pointerup', 'pen');
      expect(requests).toHaveLength(2);

      // A press the page turned into a pan opens nothing.
      pointer('pointerdown', 'touch');
      element.dispatchEvent(new Event('pointercancel'));
      pointer('pointerup', 'touch');
      expect(requests).toHaveLength(2);

      // A mouse press still opens on its click alone.
      pointer('pointerdown', 'mouse');
      pointer('pointerup', 'mouse');
      expect(requests).toHaveLength(2);
      element.click();
      expect(requests).toHaveLength(3);
    } finally {
      editor.destroy();
    }
  });

  it('opens nothing for a touch or pen press that travelled past the slop, nor for its click', () => {
    const touch: FakeQuery = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const { editor, add, requests } = createHarness({ touch });
    try {
      editor.view.dom.focus();
      editor.commands.setTextSelection(4);
      const element = add() as HTMLElement;
      const pointer = (type: string, pointerType: string, x: number) => {
        const event = new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: 40,
        });
        Object.defineProperty(event, 'pointerType', { value: pointerType });
        element.dispatchEvent(event);
      };

      // A short drag the page did not claim as a pan: no pointercancel.
      pointer('pointerdown', 'touch', 20);
      pointer('pointerup', 'touch', 60);
      element.click();
      pointer('pointerdown', 'pen', 20);
      pointer('pointerup', 'pen', 20 + MLV_EDITOR_BLOCK_ADD_PRESS_SLOP + 1);
      expect(requests).toHaveLength(0);

      // A tap that wobbles within the slop still opens.
      pointer('pointerdown', 'touch', 20);
      pointer('pointerup', 'touch', 20 + MLV_EDITOR_BLOCK_ADD_PRESS_SLOP);
      expect(requests).toHaveLength(1);
    } finally {
      editor.destroy();
    }
  });

  it('removes the "+" and its listeners on destroy', () => {
    const { editor, add, hover, requests } = createHarness();
    hover(65);
    const element = add() as HTMLElement;
    const removed = vi.spyOn(element, 'removeEventListener');
    editor.destroy();
    expect(element.isConnected).toBe(false);
    expect(removed.mock.calls.map(([type]) => type).sort()).toEqual([
      'click',
      'pointercancel',
      'pointerdown',
      'pointerup',
      'touchend',
    ]);
    element.click();
    expect(requests).toHaveLength(0);
  });

  it('previews the target without a transaction: the drop line after a block, an outline on an empty paragraph (D-B2)', () => {
    const { editor, indicator, target } = createHarness({
      content: '<p>A</p><p></p><p>C</p>',
    });
    try {
      const transactions = vi.fn();
      editor.on('transaction', transactions);
      const inserter = mlvEditorBlockInserter(editor.view);

      editor.commands.setTextSelection(1);
      transactions.mockClear();
      inserter?.showPreview();
      expect(indicator().getAttribute('data-visible')).toBe('true');
      // Midway between the first block (ends 50) and the second (starts 60).
      expect(indicator().style.top).toBe('55px');
      expect(target()).toBeNull();
      inserter?.hidePreview();
      expect(indicator().getAttribute('data-visible')).toBe('false');

      editor.commands.setTextSelection(4);
      transactions.mockClear();
      inserter?.showPreview();
      expect(target()?.style.top).toBe('60px');
      expect(target()?.style.height).toBe('20px');
      expect(target()?.getAttribute('aria-hidden')).toBe('true');
      expect(indicator().getAttribute('data-visible')).toBe('false');
      inserter?.hidePreview();
      expect(target()).toBeNull();
      expect(transactions).not.toHaveBeenCalled();
    } finally {
      editor.destroy();
    }
  });

  it('anchors the menu at the inline-start edge of the block in a scoped [dir="rtl"]', () => {
    const { editor, add, hover } = createHarness({ dir: 'rtl' });
    try {
      // No "+" rendered yet: the block's own inline-start edge stands in,
      // its right edge under a scoped `dir="rtl"`.
      expect(mlvEditorInsertSlotRect(editor.view, 3).left).toBe(352);
      hover(65);
      vi.spyOn(add() as HTMLElement, 'getBoundingClientRect').mockReturnValue(
        rect(356, 60, 24, 24),
      );
      const slot = mlvEditorInsertSlotRect(editor.view, 3);
      expect([slot.left, slot.top, slot.width]).toEqual([356, 60, 24]);
    } finally {
      editor.destroy();
    }
  });

  it('anchors at the left edge of the block under an LTR scope', () => {
    const { editor } = createHarness({ dir: 'ltr' });
    try {
      expect(mlvEditorInsertSlotRect(editor.view, 3).left).toBe(48);
    } finally {
      editor.destroy();
    }
  });
});
