import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  i18nTestProvider,
  provideMlvI18nTesting,
} from '@malva-ui/i18n/testing';
import { Editor } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { fileURLToPath } from 'node:url';
import { compile } from 'sass';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MlvEditor } from '../editor/editor';
import {
  MlvEditorBlockHandle,
  type MlvEditorBlockMove,
} from './editor-block-handle';
import { mlvEditorDefaultExtensions } from './editor-extensions';
import { MlvEditorUploadPlaceholder } from './editor-upload-placeholder';

const THREE_BLOCKS = '<p>A</p><p>B</p><p>C</p>';

interface Harness {
  readonly editor: Editor;
  readonly moves: MlvEditorBlockMove[];
  readonly setEnabled: (value: boolean) => void;
}

function createHarness(content = THREE_BLOCKS): Harness {
  const moves: MlvEditorBlockMove[] = [];
  let enabled = true;
  const editor = new Editor({
    content,
    extensions: [
      StarterKit,
      MlvEditorBlockHandle.configure({
        mount: () => null,
        label: () => 'Drag block',
        announceMove: (move) => moves.push(move),
        enabled: () => enabled,
      }),
    ],
  });
  return {
    editor,
    moves,
    setEnabled: (value) => {
      enabled = value;
    },
  };
}

const texts = (editor: Editor) =>
  editor.getJSON().content?.map((node) => node.content?.[0]?.text) ?? [];

const types = (editor: Editor) =>
  editor.getJSON().content?.map((node) => node.type) ?? [];

describe('MlvEditorBlockHandle commands', () => {
  it('moves a block down using pre-move indices', () => {
    const { editor } = createHarness();
    try {
      expect(editor.commands.moveBlock({ from: 0, to: 2 })).toBe(true);
      expect(texts(editor)).toEqual(['B', 'C', 'A']);
    } finally {
      editor.destroy();
    }
  });

  it('moves a block up using pre-move indices', () => {
    const { editor } = createHarness();
    try {
      expect(editor.commands.moveBlock({ from: 2, to: 0 })).toBe(true);
      expect(texts(editor)).toEqual(['C', 'A', 'B']);
    } finally {
      editor.destroy();
    }
  });

  it('records a move as one undo step', () => {
    const { editor } = createHarness();
    try {
      editor.commands.moveBlock({ from: 0, to: 1 });
      expect(texts(editor)).toEqual(['B', 'A', 'C']);
      expect(editor.commands.undo()).toBe(true);
      expect(texts(editor)).toEqual(['A', 'B', 'C']);
    } finally {
      editor.destroy();
    }
  });

  it('keeps the selection inside the moved block so repeated moves act on it', () => {
    const { editor } = createHarness();
    try {
      editor.commands.setTextSelection(2); // inside 'A'
      expect(editor.commands.moveBlockDown()).toBe(true);
      expect(texts(editor)).toEqual(['B', 'A', 'C']);
      expect(editor.commands.moveBlockDown()).toBe(true);
      expect(texts(editor)).toEqual(['B', 'C', 'A']);
    } finally {
      editor.destroy();
    }
  });

  it('keeps an atom block selected so repeated moves act on that same node', () => {
    const { editor } = createHarness('<hr><p>B</p><p>C</p><p>D</p>');
    try {
      editor.commands.setNodeSelection(0); // the horizontal rule
      expect(types(editor)).toEqual([
        'horizontalRule',
        'paragraph',
        'paragraph',
        'paragraph',
      ]);

      expect(editor.commands.moveBlockDown()).toBe(true);
      expect(types(editor)).toEqual([
        'paragraph',
        'horizontalRule',
        'paragraph',
        'paragraph',
      ]);
      expect(editor.state.selection.$from.index(0)).toBe(1);

      expect(editor.commands.moveBlockDown()).toBe(true);
      expect(types(editor)).toEqual([
        'paragraph',
        'paragraph',
        'horizontalRule',
        'paragraph',
      ]);
      expect(texts(editor)).toEqual(['B', 'C', undefined, 'D']);
      expect(editor.state.selection.$from.index(0)).toBe(2);
    } finally {
      editor.destroy();
    }
  });

  it.each([
    ['first block up', 0],
    ['last block down', 2],
  ] as const)(
    'refuses to move the %s and leaves the document unchanged',
    (_label, index) => {
      const { editor } = createHarness();
      try {
        const position = index === 0 ? 2 : editor.state.doc.content.size - 2;
        editor.commands.setTextSelection(position);
        const before = editor.getJSON();
        const moved =
          index === 0
            ? editor.commands.moveBlockUp()
            : editor.commands.moveBlockDown();
        expect(moved).toBe(false);
        expect(editor.getJSON()).toEqual(before);
      } finally {
        editor.destroy();
      }
    },
  );

  it.each([
    ['an out-of-range source', { from: 9, to: 0 }],
    ['an out-of-range target', { from: 0, to: 9 }],
    ['a no-op move', { from: 1, to: 1 }],
    ['a fractional index', { from: 0.5, to: 1 }],
  ])('rejects %s without changing the document', (_label, options) => {
    const { editor } = createHarness();
    try {
      const before = editor.getJSON();
      expect(editor.commands.moveBlock(options)).toBe(false);
      expect(editor.getJSON()).toEqual(before);
    } finally {
      editor.destroy();
    }
  });

  it('refuses to move while disabled and leaves the document unchanged', () => {
    const { editor, setEnabled } = createHarness();
    try {
      setEnabled(false);
      const before = editor.getJSON();
      expect(editor.commands.moveBlock({ from: 0, to: 1 })).toBe(false);
      expect(editor.getJSON()).toEqual(before);
    } finally {
      editor.destroy();
    }
  });

  it('reports a completed move with its node type and one-based position', () => {
    const { editor, moves } = createHarness('<h2>A</h2><p>B</p><p>C</p>');
    try {
      expect(editor.commands.moveBlock({ from: 0, to: 2 })).toBe(true);
      expect(moves).toEqual([{ type: 'heading', position: 3, total: 3 }]);
    } finally {
      editor.destroy();
    }
  });

  it('does not report a move for a dry-run capability check', () => {
    const { editor, moves } = createHarness();
    try {
      expect(editor.can().moveBlock({ from: 0, to: 1 })).toBe(true);
      expect(moves).toEqual([]);
      expect(texts(editor)).toEqual(['A', 'B', 'C']);
    } finally {
      editor.destroy();
    }
  });

  it('binds Alt+Shift+Arrow to the move commands', () => {
    const { editor } = createHarness();
    try {
      const moveBlockUp = vi.fn(() => true);
      const moveBlockDown = vi.fn(() => true);
      const shortcuts = MlvEditorBlockHandle.config.addKeyboardShortcuts?.call({
        editor: { commands: { moveBlockUp, moveBlockDown } },
      } as never);

      expect(Object.keys(shortcuts ?? {})).toEqual([
        'Alt-Shift-ArrowUp',
        'Alt-Shift-ArrowDown',
      ]);
      shortcuts?.['Alt-Shift-ArrowUp']?.({ editor });
      shortcuts?.['Alt-Shift-ArrowDown']?.({ editor });
      expect(moveBlockUp).toHaveBeenCalledTimes(1);
      expect(moveBlockDown).toHaveBeenCalledTimes(1);

      const bound = MlvEditorBlockHandle.config.addKeyboardShortcuts?.call({
        editor,
      } as never);
      editor.commands.setTextSelection(2); // inside 'A'
      expect(bound?.['Alt-Shift-ArrowDown']?.({ editor })).toBe(true);
      expect(texts(editor)).toEqual(['B', 'A', 'C']);
      expect(bound?.['Alt-Shift-ArrowUp']?.({ editor })).toBe(true);
      expect(texts(editor)).toEqual(['A', 'B', 'C']);
    } finally {
      editor.destroy();
    }
  });
});

describe('MlvEditorBlockHandle composition', () => {
  it('is part of the default preset and creates fresh instances', () => {
    const first = mlvEditorDefaultExtensions();
    const second = mlvEditorDefaultExtensions();
    const names = first.map((extension) => extension.name);

    expect(names).toContain('mlvEditorBlockHandle');
    expect(
      names.filter((name) => name === 'mlvEditorBlockHandle'),
    ).toHaveLength(1);
    expect(first.find((e) => e.name === 'mlvEditorBlockHandle')).not.toBe(
      second.find((e) => e.name === 'mlvEditorBlockHandle'),
    );
  });

  it('leaves the keymap inert for a literal extension set without the handle', () => {
    const editor = new Editor({
      content: THREE_BLOCKS,
      extensions: [StarterKit],
    });
    try {
      const before = editor.getJSON();
      expect(
        (editor.commands as Record<string, unknown>)['moveBlockDown'],
      ).toBeUndefined();
      expect(editor.getJSON()).toEqual(before);
    } finally {
      editor.destroy();
    }
  });
});

describe('MlvEditorBlockHandle view', () => {
  const mounts: HTMLElement[] = [];

  /**
   * jsdom performs no hit testing, so `Document.elementFromPoint` is absent and
   * ProseMirror's own `posAtCoords` throws instead of returning null. The
   * StarterKit dropcursor plugin calls it on every `dragover` this extension
   * deliberately does *not* claim — the pass-through path a test below asserts.
   * Null is the truthful answer for a DOM that lays nothing out.
   */
  beforeAll(() => {
    const target = document as Document & {
      elementFromPoint?: (x: number, y: number) => Element | null;
    };
    target.elementFromPoint ??= () => null;
  });

  afterEach(() => {
    while (mounts.length) mounts.pop()?.remove();
    // The harness spies on `document`, which outlives the test.
    vi.restoreAllMocks();
  });

  /**
   * `markdown` swaps the bare StarterKit set for the real default preset with
   * a Markdown manager, which is the only way to reach `getMarkdown()` — the
   * third serializer the drop indicator must stay out of. `uploadPlaceholder`
   * adds the one other extension in this library that renders a top-level
   * widget decoration.
   */
  function createMountedHarness(
    options: {
      scale?: number;
      markdown?: boolean;
      uploadPlaceholder?: boolean;
      content?: string;
    } = {},
  ) {
    const {
      scale = 1,
      markdown = false,
      uploadPlaceholder = false,
      content = THREE_BLOCKS,
    } = options;
    const mount = document.createElement('div');
    mount.style.position = 'relative';
    document.body.appendChild(mount);
    mounts.push(mount);
    const host = document.createElement('div');
    mount.appendChild(host);

    // Spied before the plugin view runs so every listener it registers is
    // recorded. `vi.spyOn` calls through, so nothing else changes.
    const mountAdd = vi.spyOn(mount, 'addEventListener');
    const mountRemove = vi.spyOn(mount, 'removeEventListener');
    const documentAdd = vi.spyOn(document, 'addEventListener');
    const documentRemove = vi.spyOn(document, 'removeEventListener');

    let enabled = true;
    let label = 'Drag block';
    const blockHandle = {
      mount: () => mount,
      label: () => label,
      announceMove: () => undefined,
      enabled: () => enabled,
    };
    const editor = new Editor({
      element: host,
      content,
      extensions: markdown
        ? mlvEditorDefaultExtensions({ format: 'markdown', blockHandle })
        : [
            StarterKit,
            ...(uploadPlaceholder ? [MlvEditorUploadPlaceholder] : []),
            MlvEditorBlockHandle.configure(blockHandle),
          ],
    });

    // jsdom has no layout; stub the two rects the conversion reads.
    vi.spyOn(mount, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      left: 0,
      width: 400 * scale,
      height: 300 * scale,
      right: 400 * scale,
      bottom: 300 * scale,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(mount, 'offsetWidth', {
      value: 400,
      configurable: true,
    });

    /**
     * Mount listeners plus the `document` listeners this plugin registers.
     * Handlers are kept by reference so a removal only pairs when it passes
     * the same function back.
     */
    const listenerCalls = (
      mountSpy: typeof mountAdd,
      documentSpy: typeof documentAdd,
    ): Array<{ type: unknown; handler: unknown }> =>
      [
        ...mountSpy.mock.calls,
        ...documentSpy.mock.calls.filter(([type]) => type === 'keydown'),
      ].map(([type, handler]) => ({ type, handler }));

    return {
      editor,
      mount,
      setEnabled: (value: boolean) => {
        enabled = value;
      },
      /** Re-reads like the host's own signal-backed label does. */
      setLabel: (value: string) => {
        label = value;
      },
      handle: () =>
        mount.querySelector('.mlv-editor__block-handle') as HTMLElement | null,
      indicator: () =>
        mount.querySelector(
          '.mlv-editor__drop-indicator',
        ) as HTMLElement | null,
      /** Every listener added to the mount or to `document` since construction. */
      added: () => listenerCalls(mountAdd, documentAdd),
      /** Every matching removal, so a leak shows up as an unpaired entry. */
      removed: () => listenerCalls(mountRemove, documentRemove),
    };
  }

  it('mounts one non-focusable, aria-hidden handle', () => {
    const { editor, handle } = createMountedHarness();
    try {
      const element = handle();
      expect(element).not.toBeNull();
      expect(element?.getAttribute('aria-hidden')).toBe('true');
      expect(element?.getAttribute('draggable')).toBe('true');
      expect(element?.hasAttribute('tabindex')).toBe(false);
      expect(element?.getAttribute('data-visible')).toBe('false');
      // The icon is sized by `.mlv-editor__block-handle svg`, so the markup
      // must not pin intrinsic pixel dimensions.
      const icon = element?.querySelector('svg');
      expect(icon).not.toBeNull();
      expect(icon?.hasAttribute('width')).toBe(false);
      expect(icon?.hasAttribute('height')).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  /** Gives one rendered child a vertical box, since jsdom lays nothing out. */
  function stubBox(element: Element, top: number, height: number): void {
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      top,
      left: 0,
      width: 400,
      height,
      right: 400,
      bottom: top + height,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect);
  }

  /**
   * Gives each rendered block a vertical box. The three blocks of
   * `THREE_BLOCKS` occupy 30–50, 60–80, and 90–110, leaving a deliberate 10px
   * gap between each pair — and, just as deliberately, 30px of empty space
   * above the first block, so a hover there is genuinely outside every box and
   * reaches the clamp.
   */
  function stubBlockBoxes(editor: Editor): void {
    [...editor.view.dom.children].forEach((child, index) =>
      stubBox(child, 30 + index * 30, 20),
    );
  }

  const move = (mount: HTMLElement, clientY: number) =>
    mount.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY }));

  it('converts block geometry out of the zoom scale', () => {
    const { editor, mount, handle } = createMountedHarness({ scale: 1.5 });
    try {
      // Every child, not just the hovered one: resolution assumes the rendered
      // children are vertically ordered, and jsdom's default all-zero rect for
      // an unstubbed sibling would put it above the one box that is stubbed.
      [...editor.view.dom.children].forEach((child, index) =>
        stubBox(child, 60 + index * 40, 30),
      );

      // 60px on screen at scale 1.5 is 40px in the unscaled layer.
      move(mount, 70);
      expect(handle()?.style.top).toBe('40px');
      expect(handle()?.dataset['index']).toBe('0');
      expect(handle()?.getAttribute('data-visible')).toBe('true');

      mount.dispatchEvent(new MouseEvent('mouseleave'));
      expect(handle()?.getAttribute('data-visible')).toBe('false');
    } finally {
      editor.destroy();
    }
  });

  /**
   * The hit as the plugin publishes it: the resolved top-level index, and the
   * block's own `top` converted into the mount's unscaled space. Null while the
   * handle is retracted, which is how "resolved nothing" reads from outside.
   *
   * `MlvEditorBlockHit` carries a `bottom` as well, but the hover path is its
   * only producer and nothing observable consumes it — the drag resolves
   * against its own snapshot instead — so parity is asserted on the two
   * values that reach the DOM, plus the separate assertion below that both
   * edges come off one rect read of the winning element.
   */
  const hover = (
    harness: ReturnType<typeof createMountedHarness>,
    clientY: number,
  ): { index: string | undefined; top: string } | null => {
    move(harness.mount, clientY);
    const element = harness.handle();
    return element?.getAttribute('data-visible') === 'true'
      ? { index: element.dataset['index'], top: element.style.top }
      : null;
  };

  it.each([
    // Above every block — the content's top `padding-block`. Reaches the
    // clamp, since no box starts before y=30, and must offer the first block
    // rather than blink the handle out.
    ['above the topmost block', 5, '0', '30px'],
    // The clamp's own boundary: the first block's leading edge belongs to it,
    // not to the empty space above it.
    ["exactly on the first block's top edge", 30, '0', '30px'],
    // The leading edge of a block that is not the first: the boundary the
    // clamp cannot mask, since the block below it is a real answer too.
    ["exactly on a later block's top edge", 60, '1', '60px'],
    // Inside the second block's own box (60–80).
    ['inside a block box', 70, '1', '60px'],
    // A block's trailing edge still belongs to that block.
    ["exactly on a block's bottom edge", 80, '1', '60px'],
    // In the 10px gap between the second (…80) and third (90…): the preceding
    // block wins.
    ['in the gap between two blocks', 85, '1', '60px'],
    // One pixel short of the next block's leading edge — still the gap.
    ["immediately above a block's top edge", 89, '1', '60px'],
    // Past the end of the document.
    ['below the last block', 500, '2', '90px'],
  ] as const)(
    'resolves a pointer %s to the expected block',
    (_label, clientY, index, top) => {
      const harness = createMountedHarness();
      try {
        stubBlockBoxes(harness.editor);
        expect(hover(harness, clientY)).toEqual({ index, top });
      } finally {
        harness.editor.destroy();
      }
    },
  );

  it.each([
    // The seam itself: 'A' ends and 'B' starts on the same pixel, and the
    // block above owns it — the box whose `bottom` the pointer reaches wins,
    // which is where the scan this replaced ended up. The 10px gaps in the
    // table above structurally cannot reach this case.
    ['on the seam between two touching blocks', 50, '0', '30px'],
    ['on the second seam', 70, '1', '50px'],
    // One pixel past a seam is unambiguously the lower block.
    ['one pixel past a seam', 51, '1', '50px'],
    // The first block's leading edge has no block above it to lose to.
    ["on the first block's leading edge", 30, '0', '30px'],
  ] as const)(
    'resolves a pointer %s to the expected block',
    (_label, clientY, index, top) => {
      const harness = createMountedHarness();
      try {
        // Touching boxes: 30–50, 50–70, 70–90. `.ProseMirror p` keeps 0.75rem
        // between border boxes, so the shipped stylesheet never produces this;
        // the answer on that pixel is still not one to change silently.
        [...harness.editor.view.dom.children].forEach((child, position) =>
          stubBox(child, 30 + position * 20, 20),
        );
        expect(hover(harness, clientY)).toEqual({ index, top });
      } finally {
        harness.editor.destroy();
      }
    },
  );

  /**
   * A widget whose box says nothing about where it sits. `display: none`
   * reports an all-zero rect, and `prosemirror-gapcursor`'s shipped stylesheet
   * is `position: absolute; display: none` outside `.ProseMirror-focused` — so
   * a gap-cursor selection surviving a blur puts exactly this at top level.
   * The upload placeholder stands in for it here because it is the widget this
   * library can insert on demand.
   */
  function stubOutOfFlowWidget(editor: Editor): void {
    expect(
      editor.commands.insertUploadPlaceholder({ id: 'blurred', position: 6 }),
    ).toBe(true);
    const children = [...editor.view.dom.children];
    expect(children).toHaveLength(4);
    stubBox(children[0], 30, 20); // 'A'
    stubBox(children[1], 60, 20); // 'B'
    stubBox(children[2], 0, 0); // the widget: an all-zero rect
    stubBox(children[3], 90, 20); // 'C'
  }

  it.each([
    // The pointer is inside 'A'. A search comparing against the widget's
    // all-zero `top` reads it as sitting above the pointer, drags the probe
    // past both 'A' and 'B', and answers 'B' — the handle drawn beside a block
    // the pointer is nowhere near, and a drag started there moving it.
    ['inside the first block', 40, '0', '30px'],
    ['inside the block before the widget', 70, '1', '60px'],
    ['inside the block after the widget', 95, '2', '90px'],
    ['above every block', 5, '0', '30px'],
    ['below every block', 500, '2', '90px'],
  ] as const)(
    "ignores an out-of-flow widget's box when resolving a pointer %s",
    (_label, clientY, index, top) => {
      const harness = createMountedHarness({ uploadPlaceholder: true });
      try {
        stubOutOfFlowWidget(harness.editor);
        expect(hover(harness, clientY)).toEqual({ index, top });
      } finally {
        harness.editor.destroy();
      }
    },
  );

  it('retracts a visible handle when the editor renders no children at all', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    const dom = editor.view.dom as HTMLElement & { children?: unknown };
    try {
      stubBlockBoxes(editor);
      // Retracting from a *visible* handle is what makes this more than a
      // no-throw assertion: an unguarded `children[0]` throws out of the
      // listener, `dispatchEvent` swallows it, and the handle would stay
      // parked over a block that is no longer rendered.
      expect(hover(harness, 70)).toEqual({ index: '1', top: '60px' });

      // ProseMirror's schema is `block+`, so an empty document still renders
      // one paragraph and this shape is unreachable through the editor itself.
      Object.defineProperty(dom, 'children', {
        value: [] as unknown as HTMLCollection,
        configurable: true,
      });
      expect(hover(harness, 40)).toBeNull();
    } finally {
      delete dom.children;
      editor.destroy();
    }
  });

  /**
   * `THREE_BLOCKS` with real widget decorations in four of its top-level
   * positions: one before the first block, a run of two between the first and
   * the second, and one past the last. Widgets are direct children of
   * `view.dom` exactly like blocks, and `posAtDOM` maps each of them to the
   * perfectly valid index of the block beside it, so nothing but the
   * `nodeDOM` containment check tells the two apart.
   *
   * Boxes, in DOM order: widget 28–30, 'A' 30–50, widget 50–52, widget 52–54,
   * 'B' 60–80, 'C' 90–110, widget 110–112. The sliver widths are the point —
   * a hit taken from one would hand `dropTargetIndex` a two-pixel box to find
   * a midpoint in.
   */
  function stubInterleavedBoxes(editor: Editor): Element[] {
    for (const [id, position] of [
      ['lead', 0],
      ['mid-a', 3],
      ['mid-b', 3],
      ['tail', 9],
    ] as const) {
      expect(editor.commands.insertUploadPlaceholder({ id, position })).toBe(
        true,
      );
    }
    const children = [...editor.view.dom.children];
    expect(children).toHaveLength(7);
    const boxes: readonly [number, number][] = [
      [28, 2],
      [30, 20],
      [50, 2],
      [52, 2],
      [60, 20],
      [90, 20],
      [110, 2],
    ];
    children.forEach((child, index) =>
      stubBox(child, boxes[index][0], boxes[index][1]),
    );
    return children;
  }

  it.each([
    // Above everything, including the leading widget: the clamp still has to
    // reach past it to the first *block*.
    ['above the leading widget', 5, '0', '30px'],
    // On the leading widget itself — still above every block, so still the
    // clamp.
    ['on a widget preceding the first block', 29, '0', '30px'],
    // Inside the run of two widgets between 'A' and 'B'. A probe landing here
    // must walk back to 'A' rather than pair 'A''s index with a 2px box.
    ['inside a run of consecutive widgets', 53, '0', '30px'],
    // The gap between the second and third blocks holds no widget at all.
    ['in a widget-free gap between blocks', 85, '1', '60px'],
    // On the trailing widget, which sits past the last block.
    ['on a widget past the last block', 111, '2', '90px'],
    ['below every child', 500, '2', '90px'],
  ] as const)(
    'resolves a pointer %s to the block, never to a widget',
    (_label, clientY, index, top) => {
      const harness = createMountedHarness({ uploadPlaceholder: true });
      try {
        stubInterleavedBoxes(harness.editor);
        expect(hover(harness, clientY)).toEqual({ index, top });
      } finally {
        harness.editor.destroy();
      }
    },
  );

  it('drops onto the block a widget run sits beside, not onto the widget', () => {
    const harness = createMountedHarness({ uploadPlaceholder: true });
    const { editor } = harness;
    try {
      stubInterleavedBoxes(editor);
      // Grab 'C', the last block.
      expect(hover(harness, 95)).toEqual({ index: '2', top: '90px' });
      fire(harness.handle(), 'dragstart');

      // y=53 is inside the widget run between 'A' (30–50) and 'B' (60–80), so
      // the hit is 'A' and 53 is past its midpoint of 40: 'C' lands between
      // 'A' and 'B'. Taking the hit from the widget at 52–54 instead would put
      // the midpoint at 53 and drop 'C' on the other side.
      fire(editor.view.dom, 'dragover', 53);
      fire(editor.view.dom, 'drop', 53);
      expect(texts(editor)).toEqual(['A', 'C', 'B']);
    } finally {
      editor.destroy();
    }
  });

  /** A document of `count` single-letter paragraphs. */
  const manyBlocks = (count: number): string =>
    Array.from({ length: count }, (_, index) => `<p>b${index}</p>`).join('');

  /**
   * Counts what one hover costs: `posAtDOM` is called exactly once per
   * `topLevelIndexOfDom`, so its call count *is* the mapping count, and the
   * per-child rect spy counts the layout reads the resolution asks for.
   * Neither counter starts until the boxes are stubbed, so the stubbing itself
   * is not measured.
   */
  function measureHover(
    harness: ReturnType<typeof createMountedHarness>,
    clientY: number,
  ): { mappings: number; rects: number } {
    const { editor } = harness;
    const children = [...editor.view.dom.children];
    let rects = 0;
    children.forEach((child, index) => {
      const top = 30 + index * 30;
      vi.spyOn(child, 'getBoundingClientRect').mockImplementation(() => {
        rects += 1;
        return {
          top,
          left: 0,
          width: 400,
          height: 20,
          right: 400,
          bottom: top + 20,
          x: 0,
          y: top,
          toJSON: () => ({}),
        } as DOMRect;
      });
    });
    const posAtDOM = vi.spyOn(editor.view, 'posAtDOM');
    move(harness.mount, clientY);
    return { mappings: posAtDOM.mock.calls.length, rects };
  }

  /**
   * Deepest hover in a document of `count` blocks: past the last box, so every
   * child is above the pointer and the resolution has the whole document to
   * get through.
   */
  const deepestY = (count: number): number => 30 + count * 30;

  /**
   * Mappings a hover may cost in a document of `count` blocks and no widgets.
   *
   * The search halves `[low, high]` every iteration and never revisits an
   * index, so it runs at most ⌈log₂(count + 1)⌉ times; each iteration resolves
   * one block, which is one mapping, plus one per widget it walks over — none
   * here. A rect is read only once a mapping has succeeded, so in a
   * widget-free document the two counts coincide.
   */
  const mappingBound = (count: number): number =>
    Math.ceil(Math.log2(count + 1));

  it.each([250, 500])(
    'maps a bounded number of children for a deep hover in a %i-block document',
    (count) => {
      const harness = createMountedHarness({ content: manyBlocks(count) });
      try {
        const { mappings, rects } = measureHover(harness, deepestY(count));
        expect(harness.handle()?.dataset['index']).toBe(String(count - 1));

        expect(mappings).toBeLessThanOrEqual(mappingBound(count));
        expect(rects).toBeLessThanOrEqual(mappingBound(count));
      } finally {
        harness.editor.destroy();
      }
    },
  );

  it('adds at most one mapping per doubling of the document', () => {
    const small = createMountedHarness({ content: manyBlocks(250) });
    const large = createMountedHarness({ content: manyBlocks(500) });
    try {
      // Both hovers are past the last block, so each has its whole document to
      // get through. The scan this replaced answered 250 and 500 mappings
      // here; a logarithmic search answers the same number plus one.
      const near = measureHover(small, deepestY(250));
      const far = measureHover(large, deepestY(500));
      expect(small.handle()?.dataset['index']).toBe('249');
      expect(large.handle()?.dataset['index']).toBe('499');

      expect(far.mappings - near.mappings).toBeLessThanOrEqual(1);
      expect(far.rects - near.rects).toBeLessThanOrEqual(1);
    } finally {
      small.editor.destroy();
      large.editor.destroy();
    }
  });

  it('resolves a shallow hover no more expensively than a deep one', () => {
    const shallow = createMountedHarness({ content: manyBlocks(500) });
    const deep = createMountedHarness({ content: manyBlocks(500) });
    try {
      // The first block, and the last, in documents of one length. A scan that
      // maps every child it passes separates these two by two orders of
      // magnitude; a binary search must not separate them at all.
      const near = measureHover(shallow, 35);
      const far = measureHover(deep, deepestY(500));
      expect(shallow.handle()?.dataset['index']).toBe('0');
      expect(deep.handle()?.dataset['index']).toBe('499');

      expect(near.mappings).toBeLessThanOrEqual(mappingBound(500));
      expect(far.mappings).toBeLessThanOrEqual(mappingBound(500));
    } finally {
      shallow.editor.destroy();
      deep.editor.destroy();
    }
  });

  /**
   * Every attribute write the plugin makes to the handle. `style.top`,
   * `dataset.index`, `title` and `data-visible` are all attribute mutations,
   * so one observer sees all four, and `takeRecords()` reads them
   * synchronously rather than waiting for the microtask the callback would.
   */
  const attributeWrites = (element: HTMLElement) => {
    const observer = new MutationObserver(() => undefined);
    observer.observe(element, { attributes: true });
    return {
      take: () => observer.takeRecords().map((record) => record.attributeName),
      stop: () => observer.disconnect(),
    };
  };

  it('writes nothing to the handle for a pointer move that resolves the same hit', () => {
    const harness = createMountedHarness();
    const { editor, mount } = harness;
    const writes = attributeWrites(harness.handle() as HTMLElement);
    try {
      stubBlockBoxes(editor);
      move(mount, 70);
      // The first move has to publish the hit.
      expect(writes.take()).not.toHaveLength(0);
      expect(harness.handle()?.dataset['index']).toBe('1');

      // Same block, a different pixel inside it, then the identical pixel: the
      // published values are unchanged, so the DOM must not be touched. These
      // writes are what invalidate layout, and a clean layout tree is what
      // makes the next move's rect reads free.
      move(mount, 75);
      move(mount, 75);
      expect(writes.take()).toEqual([]);
      expect(harness.handle()?.getAttribute('data-visible')).toBe('true');

      // A different block still publishes.
      move(mount, 95);
      expect(writes.take()).not.toHaveLength(0);
      expect(harness.handle()?.dataset['index']).toBe('2');
    } finally {
      writes.stop();
      editor.destroy();
    }
  });

  it('measures the mount once per pointer move and once per dragover', () => {
    const harness = createMountedHarness();
    const { editor, mount } = harness;
    const reads = mount.getBoundingClientRect as unknown as {
      mock: { calls: unknown[] };
    };
    try {
      stubBlockBoxes(editor);
      // The mount's `top` and its scale come off one box. Reading them
      // separately cost a second rect of the same element on every event.
      const beforeMove = reads.mock.calls.length;
      move(mount, 35);
      expect(reads.mock.calls.length - beforeMove).toBe(1);

      fire(harness.handle(), 'dragstart');
      const beforeDrag = reads.mock.calls.length;
      // Past the last block's midpoint, so a target actually resolves.
      fire(editor.view.dom, 'dragover', 105);
      expect(indicatorShown(harness)).toBe(true);
      expect(reads.mock.calls.length - beforeDrag).toBe(1);
    } finally {
      editor.destroy();
    }
  });

  it('republishes an unchanged hit after the handle has been retracted', () => {
    const harness = createMountedHarness();
    const { editor, mount } = harness;
    try {
      stubBlockBoxes(editor);
      move(mount, 70);
      mount.dispatchEvent(new MouseEvent('mouseleave'));
      expect(harness.handle()?.getAttribute('data-visible')).toBe('false');

      // The hit is the one already resolved, but the handle is hidden, so the
      // guard must not mistake "same values" for "nothing to do".
      move(mount, 70);
      expect(harness.handle()?.getAttribute('data-visible')).toBe('true');
      expect(harness.handle()?.style.top).toBe('60px');
    } finally {
      editor.destroy();
    }
  });

  it('republishes when the hit stays on the same block but the page scrolls', () => {
    const harness = createMountedHarness();
    const { editor, mount } = harness;
    try {
      stubBlockBoxes(editor);
      move(mount, 70);
      expect(harness.handle()?.style.top).toBe('60px');

      // Scrolling moves the block under a stationary pointer without changing
      // which block it is, so a guard keyed on the index alone would leave the
      // handle parked at the block's old offset.
      [...editor.view.dom.children].forEach((child, index) =>
        stubBox(child, 20 + index * 30, 20),
      );
      move(mount, 70);
      expect(harness.handle()?.dataset['index']).toBe('1');
      expect(harness.handle()?.style.top).toBe('50px');
    } finally {
      editor.destroy();
    }
  });

  it('republishes when the same offset comes to hold a different block', () => {
    const harness = createMountedHarness();
    const { editor, mount } = harness;
    try {
      stubBlockBoxes(editor);
      move(mount, 70);
      expect(harness.handle()?.dataset['index']).toBe('1');
      expect(harness.handle()?.style.top).toBe('60px');

      // Content arriving above the viewport — a resolving upload, a
      // collaborative peer — while the browser's scroll anchoring keeps what
      // the user is looking at stationary. Every rendered box stays where it
      // was on screen, so the hovered block's offset is unchanged and its
      // *index* is not. A guard keyed on the offset alone would leave
      // `data-index` naming the block one place earlier, and `dragstart` reads
      // `data-index` to decide what moves.
      editor.commands.insertContentAt(0, '<p>Z</p>');
      expect(texts(editor)).toEqual(['Z', 'A', 'B', 'C']);
      [...editor.view.dom.children].forEach((child, index) =>
        stubBox(child, index === 0 ? 0 : 30 * index, 20),
      );

      move(mount, 70);
      expect(harness.handle()?.style.top).toBe('60px');
      expect(harness.handle()?.dataset['index']).toBe('2');
    } finally {
      editor.destroy();
    }
  });

  it('republishes the title when the locale changes under an unchanged hit', () => {
    const harness = createMountedHarness();
    const { editor, mount } = harness;
    try {
      stubBlockBoxes(editor);
      move(mount, 70);
      expect(harness.handle()?.title).toBe('Drag block');

      harness.setLabel('Bloc glisser');
      move(mount, 70);
      // `label()` is a signal read, so it can change with neither the pointer
      // nor the document moving.
      expect(harness.handle()?.title).toBe('Bloc glisser');
    } finally {
      editor.destroy();
    }
  });

  it('resolves nothing when no rendered child owns a top-level node', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      stubBlockBoxes(editor);
      // What a document rendering only widget decorations looks like from
      // here: `posAtDOM` still maps every child to a valid index, and the
      // element ProseMirror rendered for that index is never the child asking.
      vi.spyOn(editor.view, 'nodeDOM').mockReturnValue(null);
      expect(hover(harness, 40)).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it('hides the handle while disabled', () => {
    const { editor, mount, setEnabled, handle } = createMountedHarness();
    try {
      setEnabled(false);
      move(mount, 10);
      expect(handle()?.getAttribute('data-visible')).toBe('false');
    } finally {
      editor.destroy();
    }
  });

  it('retracts a visible handle when the editor stops accepting moves', () => {
    const { editor, mount, setEnabled, handle } = createMountedHarness();
    try {
      stubBlockBoxes(editor);
      move(mount, 10);
      expect(handle()?.getAttribute('data-visible')).toBe('true');

      // Disabling puts `pointer-events: none` on the surface containing the
      // mount, so no further pointer event can ever arrive. The handle must
      // retract off the state update alone.
      setEnabled(false);
      editor.setEditable(false);
      expect(handle()?.getAttribute('data-visible')).toBe('false');
    } finally {
      editor.destroy();
    }
  });

  it('removes the handle when the editor is destroyed', () => {
    const { editor, handle } = createMountedHarness();
    editor.destroy();
    expect(handle()).toBeNull();
  });

  /**
   * jsdom 22 implements neither `DragEvent` nor `DataTransfer`. A `MouseEvent`
   * carries every field these handlers read; the `dataTransfer` writes are all
   * optional-chained, so their absence changes no branch under test.
   */
  /**
   * jsdom implements no `DataTransfer`, and the handlers optional-chain every
   * write, so the drag paths run without one. Supplying a stub is how the
   * `setDragImage` call becomes observable.
   */
  const createDataTransfer = () => ({
    effectAllowed: '',
    dropEffect: '',
    setData: vi.fn(),
    setDragImage: vi.fn(),
  });

  const fire = (
    target: EventTarget | null,
    type: string,
    clientY = 0,
    dataTransfer?: ReturnType<typeof createDataTransfer>,
  ) => {
    // `defaultPrevented` cannot say who claimed a drag event: ProseMirror
    // preventDefaults every `dragover` unconditionally. Propagation can —
    // the extension stops a drag it owns in the capture phase on the mount,
    // so a claimed event never reaches an ancestor of it.
    let propagated = false;
    const witness = () => {
      propagated = true;
    };
    document.addEventListener(type, witness);
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY,
    });
    if (dataTransfer) {
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    }
    target?.dispatchEvent(event);
    document.removeEventListener(type, witness);
    return { defaultPrevented: event.defaultPrevented, propagated };
  };

  /**
   * The `top` the indicator takes for each of the four gaps `THREE_BLOCKS`
   * offers, given `stubBlockBoxes`' 30–50, 60–80, 90–110 boxes and a mount at
   * y 0. Interior gaps sit midway through the natural space between two boxes;
   * the outer two sit on the first block's top and the last block's bottom.
   * Nothing parts the blocks, so this is where the line is drawn: the
   * stylesheet only centres the rule's own thickness on it.
   */
  const GAP_TOPS = ['30px', '55px', '85px', '110px'] as const;

  /**
   * Whether the drop indicator is currently previewing a gap. It is now a
   * permanent element in the mount rather than a widget decoration that comes
   * and goes, so presence says nothing and `data-visible` is the state.
   */
  const indicatorShown = (
    harness: ReturnType<typeof createMountedHarness>,
  ): boolean => harness.indicator()?.getAttribute('data-visible') === 'true';

  /** Which of `GAP_TOPS` the indicator sits on, or -1 while it is retracted. */
  const indicatorGap = (
    harness: ReturnType<typeof createMountedHarness>,
  ): number =>
    indicatorShown(harness)
      ? GAP_TOPS.indexOf(
          (harness.indicator()?.style.top ?? '') as (typeof GAP_TOPS)[number],
        )
      : -1;

  /**
   * Live top-level children carrying the source's dim. Read from the view's
   * current children on every call, never from a reference kept across a
   * redraw — which is exactly the mistake the dim itself used to make.
   */
  const dimmed = (editor: Editor): number[] =>
    [...editor.view.dom.children].flatMap((child, index) =>
      child.classList.contains('mlv-editor__block--dragging') ? [index] : [],
    );

  /**
   * Top-level children carrying any inline style. The plugin writes none: an
   * attribute written onto an element ProseMirror rendered is a DOM mutation
   * its observer answers by redrawing, and so replacing, that element.
   */
  const styled = (editor: Editor): number[] =>
    [...editor.view.dom.children].flatMap((child, index) =>
      child.hasAttribute('style') ? [index] : [],
    );

  /**
   * Makes ProseMirror's `DOMObserver` process pending mutations now rather than
   * on its microtask. `domObserver` is internal to `EditorView`, hence the
   * cast; `flush()` is what its own `MutationObserver` callback calls.
   */
  const flushDomObserver = (editor: Editor): void =>
    (
      editor.view as unknown as { domObserver: { flush(): void } }
    ).domObserver.flush();

  /**
   * Grabs the handle over the block whose box contains `clientY`.
   * `stubBlockBoxes` puts them at 30–50, 60–80 and 90–110.
   */
  function grab(
    harness: ReturnType<typeof createMountedHarness>,
    clientY: number,
  ) {
    stubBlockBoxes(harness.editor);
    move(harness.mount, clientY);
    const dataTransfer = createDataTransfer();
    fire(harness.handle(), 'dragstart', 0, dataTransfer);
    return dataTransfer;
  }

  it('reorders the document on drop and clears the indicator', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 35); // block 0
      expect(harness.handle()?.dataset['index']).toBe('0');

      // Below block 2's midpoint (100), so the block lands after it. Claiming
      // the event is what keeps ProseMirror's native slice drop — which would
      // reparent into lists and table cells — out of this drag.
      expect(fire(editor.view.dom, 'dragover', 105).propagated).toBe(false);
      expect(indicatorShown(harness)).toBe(true);
      expect(indicatorGap(harness)).toBe(3);

      expect(fire(editor.view.dom, 'drop', 105).propagated).toBe(false);
      expect(texts(editor)).toEqual(['B', 'C', 'A']);
      expect(indicatorShown(harness)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('reorders upward when the drop lands above the dragged block', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 95); // block 2
      expect(harness.handle()?.dataset['index']).toBe('2');

      fire(editor.view.dom, 'dragover', 35); // above block 0's midpoint (40)
      expect(indicatorGap(harness)).toBe(0);

      fire(editor.view.dom, 'drop', 35);
      expect(texts(editor)).toEqual(['C', 'A', 'B']);
      expect(indicatorShown(harness)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it.each([
    // Block 0's box is 30–50, so its midpoint is 40. Both points resolve to
    // the same block; only the midpoint decides which of its edges is used.
    ['above the midpoint of the hovered block', 35, 0, ['C', 'A', 'B']],
    ['below the midpoint of the hovered block', 45, 1, ['A', 'C', 'B']],
  ] as const)('drops %s', (_label, clientY, position, expected) => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 95); // block 2
      fire(editor.view.dom, 'dragover', clientY);
      expect(indicatorGap(harness)).toBe(position);

      fire(editor.view.dom, 'drop', clientY);
      expect(texts(editor)).toEqual([...expected]);
    } finally {
      editor.destroy();
    }
  });

  it.each([
    ['its own leading edge', 65],
    ['its own trailing edge', 75],
  ] as const)(
    'shows no indicator and moves nothing for a drop onto %s',
    (_label, clientY) => {
      const harness = createMountedHarness();
      const { editor } = harness;
      try {
        grab(harness, 65); // block 1, box 60–80, midpoint 70
        fire(editor.view.dom, 'dragover', clientY);
        expect(indicatorShown(harness)).toBe(false);

        fire(editor.view.dom, 'drop', clientY);
        expect(texts(editor)).toEqual(['A', 'B', 'C']);
      } finally {
        editor.destroy();
      }
    },
  );

  it('keeps resolving a drop past the last block once the indicator sits there', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 35); // block 0
      fire(editor.view.dom, 'dragover', 500);
      expect(indicatorGap(harness)).toBe(3);

      // The indicator is now a top-level rendered child that owns no document
      // node, and it sits past every block. Mistaking it for one would resolve
      // to nothing and blink the line out.
      fire(editor.view.dom, 'dragover', 500);
      expect(indicatorGap(harness)).toBe(3);

      fire(editor.view.dom, 'drop', 500);
      expect(texts(editor)).toEqual(['B', 'C', 'A']);
    } finally {
      editor.destroy();
    }
  });

  it('resolves a drop target past a pending upload placeholder, not onto it', () => {
    const harness = createMountedHarness({ uploadPlaceholder: true });
    const { editor, mount } = harness;
    try {
      // A real in-flight upload, anchored in the top-level gap between 'B' and
      // 'C'. Its widget is a direct child of `view.dom`, exactly like a block,
      // and `posAtDOM` maps it to a perfectly valid index — 'C'.
      expect(
        editor.commands.insertUploadPlaceholder({ id: 'upload', position: 6 }),
      ).toBe(true);

      const children = [...editor.view.dom.children];
      expect(children).toHaveLength(4);
      stubBox(children[0], 30, 20); // 'A'
      stubBox(children[1], 60, 20); // 'B'
      stubBox(children[2], 80, 2); // the placeholder — a sliver, not a block
      stubBox(children[3], 90, 20); // 'C'

      move(mount, 35);
      expect(harness.handle()?.dataset['index']).toBe('0');
      fire(harness.handle(), 'dragstart');

      // Below 'B' and above 'C', so 'A' belongs between the two. Taking the
      // hit from the placeholder instead would put the deciding midpoint at 81
      // — inside its 2px sliver rather than 'B''s box — and drop 'A' after 'C'.
      fire(editor.view.dom, 'dragover', 81);
      expect(indicatorShown(harness)).toBe(true);

      fire(editor.view.dom, 'drop', 81);
      expect(texts(editor)).toEqual(['B', 'A', 'C']);
    } finally {
      editor.destroy();
    }
  });

  /** A `dragleave` naming the element the pointer moved on to, if any. */
  const dragLeave = (
    editor: Editor,
    relatedTarget: EventTarget | null,
    clientY: number,
    clientX = 10,
  ) =>
    editor.view.dom.dispatchEvent(
      new MouseEvent('dragleave', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        relatedTarget,
      }),
    );

  it.each([
    // Where the browser fills `relatedTarget` in, it names the element being
    // entered — and `dragleave` fires for a crossing between two children of
    // the editor just as it does for leaving it.
    ['crosses on to another block', 'block', 45, true],
    // Still over the editor's own box, but on to something outside it: an
    // overlapping floating panel is a real departure the pointer cannot show.
    ['crosses on to an element overlapping the editor', 'outside', 105, false],
    // Chromium leaves `relatedTarget` null on drag events, so the pointer
    // itself has to decide.
    ['moves within the editor reporting no relatedTarget', 'none', 105, true],
    ['leaves the editor reporting no relatedTarget', 'none', 900, false],
  ] as const)(
    'holds the drop indicator only while the pointer is inside, as it %s',
    (_label, related, clientY, expected) => {
      const harness = createMountedHarness();
      const { editor } = harness;
      try {
        grab(harness, 35);
        fire(editor.view.dom, 'dragover', 105);
        expect(indicatorShown(harness)).toBe(true);

        const entered =
          related === 'block'
            ? editor.view.dom.firstElementChild
            : related === 'outside'
              ? document.body
              : null;
        dragLeave(editor, entered, clientY);
        expect(indicatorShown(harness)).toBe(expected);
      } finally {
        editor.destroy();
      }
    },
  );

  it.each([
    // A drag toward a sidebar, a second pane, or the window edge leaves
    // through a vertical edge, not the horizontal one every other case here
    // uses. Chromium reports no `relatedTarget`, so the pointer's own x is the
    // only thing that can tell — the mount's box is 0–400 wide.
    ['past its start edge', -10],
    ['past its end edge', 500],
  ] as const)(
    'retracts the indicator when the pointer leaves the mount %s',
    (_label, clientX) => {
      const harness = createMountedHarness();
      const { editor } = harness;
      try {
        grab(harness, 35);
        fire(editor.view.dom, 'dragover', 105);
        expect(indicatorShown(harness)).toBe(true);

        // Vertically still inside, so only the horizontal test can catch this.
        dragLeave(editor, null, 105, clientX);
        expect(indicatorShown(harness)).toBe(false);
      } finally {
        editor.destroy();
      }
    },
  );

  it('retracts the indicator on leaving but keeps the block on the pointer', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 35);
      fire(editor.view.dom, 'dragover', 105);
      expect(indicatorGap(harness)).toBe(3);

      // Without this the line stays parked at its last gap — a focus-coloured
      // rule sitting in the document while the cursor is elsewhere entirely.
      dragLeave(editor, null, 900);
      expect(indicatorShown(harness)).toBe(false);

      // The drag is not over, though: the block is still on the pointer, so
      // coming back has to resolve a target again and still drop.
      fire(editor.view.dom, 'dragover', 105);
      expect(indicatorGap(harness)).toBe(3);
      fire(editor.view.dom, 'drop', 105);
      expect(texts(editor)).toEqual(['B', 'C', 'A']);
    } finally {
      editor.destroy();
    }
  });

  it('cancels a drag on Escape, leaving the document and any later drop inert', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 35);
      fire(editor.view.dom, 'dragover', 105);
      expect(indicatorShown(harness)).toBe(true);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(indicatorShown(harness)).toBe(false);

      fire(editor.view.dom, 'drop', 105);
      expect(texts(editor)).toEqual(['A', 'B', 'C']);
      expect(indicatorShown(harness)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('retracts the indicator when the host revokes permission mid-drag', () => {
    const harness = createMountedHarness();
    const { editor, setEnabled } = harness;
    try {
      grab(harness, 35);
      fire(editor.view.dom, 'dragover', 105);
      expect(indicatorShown(harness)).toBe(true);

      setEnabled(false);
      editor.setEditable(false);
      expect(indicatorShown(harness)).toBe(false);

      // The drag is over, so releasing must neither reorder anything nor keep
      // claiming events the extension no longer owns.
      expect(fire(editor.view.dom, 'drop', 105).propagated).toBe(true);
      expect(texts(editor)).toEqual(['A', 'B', 'C']);
    } finally {
      editor.destroy();
    }
  });

  it('abandons the whole drag when the document changes underneath it', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 95); // block 2, 'C'
      fire(editor.view.dom, 'dragover', 35);
      expect(indicatorShown(harness)).toBe(true);

      // Anything else editing the document — a resolving upload placeholder,
      // a collaborative peer — invalidates the indices the pointer resolved.
      editor.commands.insertContentAt(0, '<p>Z</p>');
      expect(texts(editor)).toEqual(['Z', 'A', 'B', 'C']);
      expect(indicatorShown(harness)).toBe(false);

      // The source index is one of those indices, and it is the one that
      // decides *which* block moves: it still says 2, which now names 'B'.
      // A drop must therefore move nothing at all rather than silently
      // reorder a block the user never grabbed. Propagation is the assertion
      // that does not depend on where the re-stubbed boxes land: the drag is
      // over, so the extension must not claim the event either.
      expect(fire(editor.view.dom, 'drop', 35).propagated).toBe(true);
      expect(texts(editor)).toEqual(['Z', 'A', 'B', 'C']);
    } finally {
      editor.destroy();
    }
  });

  it('refuses to start a drag before any hover has resolved a block', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      stubBlockBoxes(editor);
      // No mousemove, so `data-index` is absent.
      expect(harness.handle()?.dataset['index']).toBeUndefined();
      expect(fire(harness.handle(), 'dragstart').defaultPrevented).toBe(true);

      // Nothing is being dragged, so both events must propagate untouched to
      // ProseMirror's own handlers rather than being claimed by this extension.
      expect(fire(editor.view.dom, 'dragover', 105).propagated).toBe(true);
      expect(indicatorShown(harness)).toBe(false);
      expect(fire(editor.view.dom, 'drop', 105).propagated).toBe(true);
      expect(texts(editor)).toEqual(['A', 'B', 'C']);
    } finally {
      editor.destroy();
    }
  });

  const ghost = () =>
    document.querySelector('.mlv-editor__drag-ghost') as HTMLElement | null;

  /**
   * Boxes that follow each element's *current* index rather than the one it
   * had when stubbed, which is what a browser's rects do. `stubBlockBoxes`
   * pins a box per element, so after a reorder every block would still report
   * the slot it came from and the settle would measure no movement at all.
   */
  function followBlockBoxes(editor: Editor): void {
    // `grab` leaves an own-property spy on each block, and an own property
    // shadows the prototype — those blocks would keep reporting the slot they
    // started in no matter where they end up.
    for (const child of [...editor.view.dom.children]) {
      (
        child.getBoundingClientRect as unknown as {
          mockRestore?: () => void;
        }
      ).mockRestore?.();
    }
    const original = Element.prototype.getBoundingClientRect;
    // On the prototype rather than per element: `moveBlock` deletes and
    // reinserts the dragged node, so the block whose movement matters most is
    // a *different* element by the time the settle measures it, and a spy
    // attached to the old one would never be asked.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element): DOMRect {
        const index = [...editor.view.dom.children].indexOf(this);
        if (index < 0) return original.call(this);
        const top = 30 + index * 30;
        return {
          top,
          left: 0,
          width: 400,
          height: 20,
          right: 400,
          bottom: top + 20,
          x: 0,
          y: top,
          toJSON: () => ({}),
        } as DOMRect;
      },
    );
  }

  it('hands a styled off-screen clone of the block to the drag image', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      const dataTransfer = grab(harness, 35); // block 0

      const image = ghost();
      expect(image).not.toBeNull();
      // Offset (0, 0): the ghost's leading corner rides the cursor.
      expect(dataTransfer.setDragImage).toHaveBeenCalledWith(image, 0, 0);
      // Rendered — which `setDragImage` requires — but never seen, and on
      // `document.body` rather than in the editor, where the zoom layer's own
      // transform would make a fixed position resolve against it.
      expect(image?.parentElement).toBe(document.body);
      expect(image?.style.top).toBe('-10000px');
      expect(image?.getAttribute('aria-hidden')).toBe('true');

      // Self-contained: outside `document.body` there is no `.mlv-editor`
      // ancestor to inherit from, so the clone carries resolved styles inline.
      const clone = image?.firstElementChild as HTMLElement;
      expect(clone.tagName).toBe(editor.view.dom.firstElementChild?.tagName);
      expect(clone.style.cssText).not.toBe('');
      // The block's own margins have no sibling to collapse against here, and
      // would otherwise pad the drag image with empty space.
      expect(clone.style.margin).toMatch(/^0/);
    } finally {
      editor.destroy();
    }
  });

  it('clones the block before dimming it, so the ghost is not faded twice', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 35);
      expect(dimmed(editor)).toEqual([0]);
      // Computed styles are resolved values, so dimming first would bake the
      // reduced opacity into the drag image the user drags.
      expect(
        (ghost()?.firstElementChild as HTMLElement).classList,
      ).not.toContain('mlv-editor__block--dragging');

      fire(harness.handle(), 'dragend');
      expect(dimmed(editor)).toEqual([]);
    } finally {
      editor.destroy();
    }
  });

  it('keeps the dim on the live block when ProseMirror redraws it', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 35);
      const before = editor.view.dom.firstElementChild;

      // What a real browser does to a block mid-drag: an attribute mutation on
      // an element ProseMirror rendered reads as an external DOM change, so the
      // observer marks the node dirty and redraws it. A class written straight
      // onto the element was lost to exactly this — in Chromium 22 of 25
      // blocks were replaced by the first `dragover`, and the dim sat on a
      // detached node. A node decoration is re-applied by the redraw instead.
      before?.setAttribute('data-probe', '');
      flushDomObserver(editor);

      // The redraw really happened, so the assertion below is about the new
      // element rather than the one the plugin saw at `dragstart`.
      expect(editor.view.dom.firstElementChild).not.toBe(before);
      expect(dimmed(editor)).toEqual([0]);
    } finally {
      editor.destroy();
    }
  });

  it.each([
    [
      'the drag ends',
      (h: ReturnType<typeof createMountedHarness>) =>
        fire(h.handle(), 'dragend'),
    ],
    [
      'the block is dropped',
      (h: ReturnType<typeof createMountedHarness>) =>
        fire(h.editor.view.dom, 'drop', 105),
    ],
    [
      'Escape cancels the drag',
      () =>
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    ],
    [
      'the document changes underneath it',
      (h: ReturnType<typeof createMountedHarness>) =>
        h.editor.commands.insertContentAt(0, '<p>Z</p>'),
    ],
    [
      'the host revokes permission',
      (h: ReturnType<typeof createMountedHarness>) => {
        h.setEnabled(false);
        h.editor.setEditable(false);
      },
    ],
  ] as const)('clears the dim when %s', (_label, finish) => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 35);
      fire(editor.view.dom, 'dragover', 105);
      expect(dimmed(editor)).toEqual([0]);

      finish(harness);
      expect(dimmed(editor)).toEqual([]);
    } finally {
      editor.destroy();
    }
  });

  it('clears a dim the plugin view inherited when a reconfigure rebuilds it mid-drag', async () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 35);
      expect(dimmed(editor)).toEqual([0]);

      // `registerPlugin` / `unregisterPlugin` reconfigure the state: every
      // plugin state field survives, but every plugin view is destroyed and
      // rebuilt. The view that owned the drag leaves with its `dragend`
      // listener, and the one replacing it never saw the drag, so nothing
      // would clear the dim until the next document change.
      editor.registerPlugin(new Plugin({}));
      // The clear is deferred out of the view factory, which runs inside
      // ProseMirror's `updatePluginViews`.
      await Promise.resolve();

      expect(dimmed(editor)).toEqual([]);
      expect(ghost()).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it('drops the dim with the document change that ends a drag, in that one dispatch', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 35);
      const dispatch = vi.spyOn(editor.view, 'dispatch');

      editor.commands.insertContentAt(0, '<p>Z</p>');

      // The edit's own transaction empties the decoration in plugin state, so
      // `update` ending the drag finds nothing left to clear. Without that,
      // the edit would render once with a decoration set built against the
      // previous document, and `update` would then dispatch a second,
      // re-entrant transaction from inside ProseMirror's `updatePluginViews`.
      // Counted rather than matched: a failing matcher would print both
      // transactions, documents and all.
      expect(dispatch.mock.calls.length).toBe(1);
      expect(dimmed(editor)).toEqual([]);
    } finally {
      editor.destroy();
    }
  });

  it('dims and undims without recording an undo step or touching the document', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      const doc = editor.state.doc;
      grab(harness, 35);
      fire(harness.handle(), 'dragend');

      // Both transactions are meta-only: no step, so history has nothing to
      // record and an aborted drag leaves nothing for Undo to walk back through.
      expect(editor.state.doc).toBe(doc);
      expect(editor.can().undo()).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it.each([
    [
      'the drag ends',
      (h: ReturnType<typeof createMountedHarness>) =>
        fire(h.handle(), 'dragend'),
    ],
    [
      'the editor is torn down mid-drag',
      (h: ReturnType<typeof createMountedHarness>) => h.editor.destroy(),
    ],
  ] as const)('removes the drag image when %s', (_label, finish) => {
    const harness = createMountedHarness();
    try {
      grab(harness, 35);
      expect(ghost()).not.toBeNull();
      finish(harness);
      // It lives on `document.body`, outside everything else teardown removes.
      expect(ghost()).toBeNull();
    } finally {
      harness.editor.destroy();
    }
  });

  it('strands no drag image when a second dragstart arrives', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 35);
      grab(harness, 95);
      // The wrapper lives on `document.body`, where only the drag that created
      // it ever looks. Overwriting the reference without removing the element
      // would leave the first one behind for the life of the page.
      expect(document.querySelectorAll('.mlv-editor__drag-ghost')).toHaveLength(
        1,
      );

      fire(harness.handle(), 'dragend');
      expect(document.querySelectorAll('.mlv-editor__drag-ghost')).toHaveLength(
        0,
      );
    } finally {
      editor.destroy();
    }
  });

  it('resolves the target from the dragstart snapshot, never from live rects', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 35); // block 0
      fire(editor.view.dom, 'dragover', 105);
      expect(indicatorGap(harness)).toBe(3);

      // Every `dragover` reads the mount's rect and nothing else: the boxes
      // measured at `dragstart` stay valid because nothing moves a block while
      // one is dragged, and the elements that were measured are ones
      // ProseMirror has replaced by now. Live rects here would resolve gap 2.
      [...editor.view.dom.children].forEach((child, index) =>
        stubBox(child, 54 + index * 30, 20),
      );
      fire(editor.view.dom, 'dragover', 105);
      expect(indicatorGap(harness)).toBe(3);
    } finally {
      editor.destroy();
    }
  });

  it('previews a gap without writing to any block ProseMirror rendered', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    try {
      grab(harness, 95); // block 2
      fire(editor.view.dom, 'dragover', 65); // block 1's leading edge, gap 1
      expect(indicatorGap(harness)).toBe(1);
      // No partition: the blocks stay where they are and the line is drawn in
      // the space already between them. A `transform` written here would land
      // on an element the next redraw discards.
      expect(styled(editor)).toEqual([]);

      fire(editor.view.dom, 'dragover', 35); // above every block, gap 0
      expect(indicatorGap(harness)).toBe(0);
      expect(styled(editor)).toEqual([]);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(indicatorShown(harness)).toBe(false);
      expect(styled(editor)).toEqual([]);
    } finally {
      editor.destroy();
    }
  });

  it('settles the blocks that moved back from where they were', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    const animate = vi.fn();
    const prototype = HTMLElement.prototype as HTMLElement & {
      animate?: unknown;
    };
    // jsdom implements no Web Animations API at all, so the property has to be
    // introduced rather than spied on.
    prototype.animate = animate;
    try {
      grab(harness, 35); // block 0, sitting at 30
      followBlockBoxes(editor);
      fire(editor.view.dom, 'drop', 105);
      expect(texts(editor)).toEqual(['B', 'C', 'A']);

      // Every block moved a slot, so each is offset back by the distance it
      // travelled and released. 'A' fell two slots, from 30 to 90.
      expect(animate).toHaveBeenCalledTimes(3);
      const offsets = animate.mock.calls.map(
        ([keyframes]) => (keyframes as { transform: string }[])[0].transform,
      );
      expect(offsets).toContain('translateY(-60px)');
      expect(offsets.filter((offset) => offset === 'translateY(30px)')).toEqual(
        ['translateY(30px)', 'translateY(30px)'],
      );
      for (const [keyframes] of animate.mock.calls) {
        expect((keyframes as { transform: string }[])[1].transform).toBe(
          'translateY(0)',
        );
      }
      // Animated on the elements on screen now, resolved after the move, not
      // on the ones measured at `dragstart`.
      expect(
        animate.mock.contexts.map(
          (element) => (element as Element).isConnected,
        ),
      ).toEqual([true, true, true]);
    } finally {
      delete prototype.animate;
      editor.destroy();
    }
  });

  it('does not settle when the user asked for reduced motion', () => {
    const harness = createMountedHarness();
    const { editor } = harness;
    const animate = vi.fn();
    const prototype = HTMLElement.prototype as HTMLElement & {
      animate?: unknown;
    };
    prototype.animate = animate;
    const target = globalThis as { matchMedia?: unknown };
    target.matchMedia = (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
    });
    try {
      grab(harness, 35);
      followBlockBoxes(editor);
      fire(editor.view.dom, 'drop', 105);

      // The reorder itself still happens — only the motion is dropped.
      expect(texts(editor)).toEqual(['B', 'C', 'A']);
      expect(animate).not.toHaveBeenCalled();
    } finally {
      delete target.matchMedia;
      delete prototype.animate;
      editor.destroy();
    }
  });

  it('keeps the handle and the drop indicator out of every serialization', () => {
    // The Markdown manager only exists in the real default preset, so this is
    // the one harness that carries all three serializers.
    const harness = createMountedHarness({ markdown: true });
    const { editor } = harness;
    try {
      grab(harness, 35);
      fire(editor.view.dom, 'dragover', 105);
      expect(indicatorShown(harness)).toBe(true);

      const json = JSON.stringify(editor.getJSON());
      for (const serialized of [editor.getHTML(), editor.getMarkdown(), json]) {
        expect(serialized).not.toContain('block-handle');
        expect(serialized).not.toContain('drop-indicator');
      }
      expect(json).not.toContain('blockHandle');
      expect(json).not.toContain('dropIndicator');
      // Guards against the assertions above passing on an empty document.
      expect(editor.getMarkdown()).toContain('A');
    } finally {
      editor.destroy();
    }
  });

  // The `dragstart`/`dragend` listeners live on the handle element itself,
  // which `destroy()` removes outright, so they cannot outlive it.
  it('pairs every mount and document listener with a removal on destroy', () => {
    const { editor, added, removed } = createMountedHarness();
    const registered = added();
    editor.destroy();
    const released = removed();

    expect(registered.map((entry) => entry.type).sort()).toEqual([
      'dragleave',
      'dragover',
      'drop',
      'keydown',
      'mouseleave',
      'mousemove',
    ]);
    expect(released).toHaveLength(registered.length);
    registered.forEach((entry) => expect(released).toContainEqual(entry));
  });
});

@Component({
  imports: [MlvEditor],
  template: '<mlv-editor [value]="value()" />',
})
class BlockHandleHost {
  readonly value = signal<string | null>(THREE_BLOCKS);
}

describe('MlvEditorBlockHandle host capabilities', () => {
  it('mounts the handle into the zoom layer and titles it from the editor i18n', async () => {
    await TestBed.configureTestingModule({
      imports: [BlockHandleHost],
      providers: [
        provideMlvI18nTesting(),
        i18nTestProvider(MLV_EDITOR_I18N, { dragBlock: 'Grab this block' }),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(BlockHandleHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    const view = root.querySelector('.mlv-editor__view');
    const handle = root.querySelector<HTMLElement>('.mlv-editor__block-handle');

    // `mount()` must return the zoomed view layer itself: mounting into
    // the viewport or the content element would place the handle in the wrong
    // coordinate space, and nothing else in the suite would notice.
    expect(view).not.toBeNull();
    expect(handle).not.toBeNull();
    expect(handle?.parentElement).toBe(view);
    expect(handle?.title).toBe('Grab this block');

    fixture.destroy();
    expect(root.querySelector('.mlv-editor__block-handle')).toBeNull();
  });
});

describe('MlvEditorBlockHandle gutter placement', () => {
  const REM = 16;

  /** `--mlv-editor-gutter` resolved: `var(--mlv-spacing-6)` is `1.5rem`. */
  const GUTTER = 1.5 * REM;

  /** The three `--mlv-editor-measure` values the `contentWidth` modifiers set. */
  const MEASURES = { default: 45 * REM, wide: 60 * REM, full: null } as const;

  /** The compiled stylesheet, read as text so no CSSOM parser can normalise it. */
  const css = compile(
    // Joined rather than a literal so Vite's static `new URL('literal',
    // import.meta.url)` asset analysis does not rewrite this into a
    // dev-server URL — see editor.spec.ts for the same pattern.
    fileURLToPath(
      new URL(['..', 'editor', 'editor.scss'].join('/'), import.meta.url),
    ),
  ).css;

  const declarations = (selector: string) =>
    new RegExp(`\\${selector} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';

  const declaration = (selector: string, property: string) =>
    new RegExp(`${property}:\\s*([^;]+);`).exec(declarations(selector))?.[1];

  /**
   * Independent model of the documented column layout: `.ProseMirror` is
   * `min(measure, content box)` wide and centred by `margin-inline: auto`
   * inside `.mlv-editor__content`, whose content box is the view width less
   * one gutter on each side. `full` is `100%`, i.e. the content box itself.
   */
  function columnStart(viewWidth: number, measure: number | null): number {
    const contentWidth = viewWidth - 2 * GUTTER;
    const columnWidth =
      measure === null ? contentWidth : Math.min(measure, contentWidth);
    return GUTTER + (contentWidth - columnWidth) / 2;
  }

  /**
   * The emitted `inset-inline-start` expression, transcribed to arithmetic.
   * Percentages here resolve against the *view* layer, which is why `full`
   * substitutes the view width rather than the content box. The transcription
   * is pinned by the exact-string assertion in the first test below.
   */
  function handleStart(viewWidth: number, measure: number | null): number {
    return Math.max(0, (viewWidth - 2 * GUTTER - (measure ?? viewWidth)) / 2);
  }

  it('anchors the handle to the gutter beside the text column, not the view edge', () => {
    expect(declaration('.mlv-editor__block-handle', 'inset-inline-start')).toBe(
      'max(0rem, (100% - 2 * var(--mlv-editor-gutter) - var(--mlv-editor-measure)) / 2)',
    );
    // The arithmetic below assumes the handle is exactly one gutter wide.
    expect(declaration('.mlv-editor__block-handle', 'inline-size')).toBe(
      'var(--mlv-editor-gutter)',
    );
  });

  it.each([
    ['default', 1000],
    ['default', 500],
    ['wide', 1400],
    ['wide', 1000],
    ['full', 1000],
    ['full', 500],
  ] as const)(
    'ends flush with the %s text column at a %ipx view',
    (contentWidth, viewWidth) => {
      const measure = MEASURES[contentWidth];
      // The handle occupies [start, start + gutter]; its trailing edge must
      // land exactly on the first character of the line.
      expect(handleStart(viewWidth, measure) + GUTTER).toBe(
        columnStart(viewWidth, measure),
      );
    },
  );

  it('hides both drag affordances in print output', () => {
    // Sass emits the nested media block with its closing brace at column zero.
    const print = /@media print \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(print).toContain('.mlv-editor__block-handle');
    expect(print).toContain('.mlv-editor__drop-indicator');
  });

  it('keeps the drop indicator layout-neutral so the document cannot jitter', () => {
    // Out of flow entirely, which is what makes it both animatable and unable
    // to contribute layout. It replaced an in-flow rule whose negative block
    // margins cancelled its own thickness for the same reason.
    expect(declaration('.mlv-editor__drop-indicator', 'position')).toBe(
      'absolute',
    );
    expect(declaration('.mlv-editor__drop-indicator', 'block-size')).toBe(
      'var(--mlv-stroke-width-medium)',
    );
    expect(
      declaration('.mlv-editor__drop-indicator', 'margin-block'),
    ).toBeUndefined();
  });

  it('centres the drop indicator on the gap midpoint the plugin writes', () => {
    // The plugin's `top` is already the middle of the natural space between
    // two blocks; the stylesheet only centres the rule's own thickness on it.
    expect(declaration('.mlv-editor__drop-indicator', 'transform')).toBe(
      'translateY(-50%)',
    );
  });

  it('parts no blocks to preview a drop', () => {
    // The partition is gone with its token and its transition: the blocks
    // never move during a drag, so nothing can reflow under the pointer.
    // Undocumented as an override point, so its removal is not breaking
    // (VERSIONING §2).
    expect(css).not.toContain('--mlv-editor-drop-gap');
    expect(css).not.toContain('ProseMirror--block-dragging');
    // The line's own motion still collapses under reduced motion.
    const reduced =
      /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(
        css,
      )?.[1] ?? '';
    expect(reduced).toContain('.mlv-editor__drop-indicator');
  });

  it('dims the source through a class the decoration applies', () => {
    expect(declaration('.mlv-editor__block--dragging', 'opacity')).toBe(
      'var(--mlv-disabled-opacity)',
    );
  });

  it('tints the drag ghost instead of lifting it, outside the editor scope', () => {
    // Rasterized from `document.body`, so it cannot be nested under
    // `.mlv-editor` and still be styled.
    expect(declaration('.mlv-editor__drag-ghost', 'max-block-size')).toBe(
      '12rem',
    );
    expect(declaration('.mlv-editor__drag-ghost', 'overflow')).toBe('hidden');
    // A translucent accent-tinted copy of the block, not a raised card.
    expect(declaration('.mlv-editor__drag-ghost', 'background-color')).toBe(
      'var(--mlv-background-accent-1-pale)',
    );
    expect(
      declaration('.mlv-editor__drag-ghost', 'box-shadow'),
    ).toBeUndefined();
    // Drawn at the block's own size. The plugin anchors the pointer to the
    // wrapper's inline-start edge, and a scale about any fixed origin would
    // pull one of the two edges off it — the right one, in RTL.
    expect(declaration('.mlv-editor__drag-ghost', 'scale')).toBeUndefined();
    expect(declaration('.mlv-editor__drag-ghost', 'transform')).toBeUndefined();
  });

  it('sizes the handle icon from tokens rather than intrinsic attributes', () => {
    expect(declaration('.mlv-editor__block-handle svg', 'inline-size')).toBe(
      'var(--mlv-spacing-4)',
    );
    expect(declaration('.mlv-editor__block-handle svg', 'block-size')).toBe(
      'var(--mlv-spacing-4)',
    );
  });

  /**
   * Declarations of the rule whose selector list contains `selector` exactly.
   *
   * `declaration()` above interpolates its argument straight into a regex, so
   * `[data-resize-container]` would read as a character class; these rules are
   * also emitted grouped, and the wanted selector is not always the first in
   * its list.
   */
  const groupedRule = (selector: string): string => {
    for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (selectors.split(',').some((one) => one.trim() === selector)) {
        return body;
      }
    }
    return '';
  };

  it('rings a selected image on its own edge, not around its margin box', () => {
    // The node view nests container > wrapper > img. The container is a
    // full-width flex block, so the generic `.ProseMirror-selectednode` ring
    // would trace a column-wide rectangle around an image that is often a
    // fraction of that width — the "glow" this replaced.
    expect(
      groupedRule(
        '.mlv-editor .ProseMirror [data-resize-container].ProseMirror-selectednode',
      ),
    ).toContain('outline: none');

    // Moving the block rhythm to the container is what makes the wrapper hug
    // the image's own box: the image's margins used to sit inside the wrapper,
    // standing it proud top and bottom and carrying the resize handles — which
    // are positioned on that wrapper — off the image's corners with it.
    expect(
      groupedRule('.mlv-editor .ProseMirror [data-resize-container]'),
    ).toContain('margin-block: var(--mlv-spacing-4)');
    expect(
      groupedRule('.mlv-editor .ProseMirror [data-resize-container] img'),
    ).toContain('margin-block: 0');
  });

  it('keeps every image selection ring flush with the image', () => {
    // A gap belongs to controls with chrome for it to sit in. An image has
    // none, so an offset ring reads as a glow around the artwork rather than a
    // selection boundary.
    for (const selector of [
      '.mlv-editor .ProseMirror img.ProseMirror-selectednode',
      '.mlv-editor .ProseMirror [data-resize-container].ProseMirror-selectednode > [data-resize-wrapper]',
    ]) {
      expect(groupedRule(selector)).toContain('outline-offset: 0');
    }
  });
});
