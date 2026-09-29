import { LiveAnnouncer } from '@angular/cdk/a11y';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MLV_EDITOR_I18N, type MlvEditorI18n } from '@malva-ui/i18n';
import type { Editor } from '@tiptap/core';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';

/*
 * F-D14: a block drag under peers' edits. The `dragstart` snapshot of boxes
 * and indices goes stale when a peer inserts, removes or reflows a block, and
 * any document change used to end the drag — so under collaboration every
 * peer keystroke cancelled it silently. The source is tracked instead: a
 * block that survives keeps the drag, re-measured; one that was deleted or
 * changed cancels it with an announcement.
 */

const CANCELLED = 'Block move cancelled: someone else changed the document.';

describe('Block drag under collaboration (F-D14)', () => {
  let rig: CollaborationRig;
  let spoken: string[];

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
    spoken = [];
    vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce').mockImplementation(
      (message) => {
        spoken.push(String(message));
        return Promise.resolve();
      },
    );
  });

  afterEach(() => {
    rig.destroy();
    vi.restoreAllMocks();
  });

  /** Top-level text of each block. */
  const texts = (editor: Editor): string[] => {
    const out: string[] = [];
    editor.state.doc.forEach((node) => out.push(node.textContent));
    return out;
  };

  /** Indices of the blocks carrying the source dim. */
  const dimmed = (editor: Editor): number[] =>
    [...editor.view.dom.children].flatMap((child, index) =>
      child.classList.contains('mlv-editor__block--dragging') ? [index] : [],
    );

  /** Start of the top-level block whose text is `text`. */
  const startOf = (editor: Editor, text: string): number => {
    let found = -1;
    editor.state.doc.forEach((node, offset) => {
      if (node.textContent === text) found = offset;
    });
    return found;
  };

  /**
   * jsdom lays nothing out: every top-level block `i` of `editor` gets the
   * box 30 + 30i … +20, looked up live, so a re-measure after a peer's edit
   * sees the new order.
   */
  const stubLayout = (editor: Editor): void => {
    const original = Element.prototype.getBoundingClientRect;
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
  };

  /** Fires a drag-family event with a stub `dataTransfer`. */
  const fire = (target: EventTarget, type: string, clientY = 0): void => {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY,
    });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        effectAllowed: '',
        dropEffect: '',
        setData: () => undefined,
        setDragImage: () => undefined,
      },
    });
    target.dispatchEvent(event);
  };

  /**
   * Hovers the block at `clientY` and starts dragging it; returns the mount.
   * A drop that must find no drag is fired on the mount: with no drag to
   * claim it, one on the content would reach ProseMirror's native drop,
   * which calls `elementFromPoint` (absent in jsdom).
   */
  const grab = (editor: Editor, clientY: number): HTMLElement => {
    const handle = editor.view.dom
      .closest('.mlv-editor')
      ?.querySelector('.mlv-editor__block-handle') as HTMLElement;
    const mount = handle.parentElement as HTMLElement;
    mount.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY }));
    fire(handle, 'dragstart');
    return mount;
  };

  async function pair(blockIds = false) {
    const hub = rig.hub('server');
    const content = '<p>A</p><p>B</p><p>C</p>';
    const a = await rig.mount({
      transport: hub.endpoint(),
      initialContent: content,
      blockIds,
    });
    const b = await rig.mount({
      transport: hub.endpoint(),
      initialContent: content,
      blockIds,
    });
    await rig.sync(hub);
    const editorA = tiptap(a);
    stubLayout(editorA);
    return { hub, editorA, editorB: tiptap(b) };
  }

  it('keeps the drag across a peer inserting a block before it, and drops the right block', async () => {
    const { hub, editorA, editorB } = await pair();
    grab(editorA, 65); // block 1, "B"
    expect(dimmed(editorA)).toEqual([1]);

    editorB.commands.insertContentAt(0, '<p>Z</p>');
    await rig.sync(hub);
    expect(texts(editorA)).toEqual(['Z', 'A', 'B', 'C']);
    expect(dimmed(editorA)).toEqual([2]);

    // Below "C"'s midpoint (130 in the re-measured layout).
    fire(editorA.view.dom, 'drop', 135);
    await rig.sync(hub);
    expect(texts(editorA)).toEqual(['Z', 'A', 'C', 'B']);
    expect(texts(editorB)).toEqual(texts(editorA));
    expect(spoken).toEqual(['Moved paragraph to position 4 of 4']);
  });

  it('keeps the drag across a peer typing in another block', async () => {
    const { hub, editorA, editorB } = await pair();
    grab(editorA, 35); // block 0, "A"
    editorB.commands.insertContentAt(startOf(editorB, 'C') + 2, '!');
    await rig.sync(hub);
    expect(dimmed(editorA)).toEqual([0]);
    fire(editorA.view.dom, 'drop', 105);
    expect(texts(editorA)).toEqual(['B', 'C!', 'A']);
    expect(spoken).toEqual(['Moved paragraph to position 3 of 3']);
  });

  it('cancels and announces when a peer types in the dragged block', async () => {
    const { hub, editorA, editorB } = await pair();
    const mount = grab(editorA, 65); // "B"
    editorB.commands.insertContentAt(startOf(editorB, 'B') + 2, '!');
    await rig.sync(hub);
    expect(dimmed(editorA)).toEqual([]);
    expect(spoken).toEqual([CANCELLED]);

    fire(mount, 'drop', 105);
    expect(texts(editorA)).toEqual(['A', 'B!', 'C']);
  });

  it("announces the English fallback when the pack's copy is blank", async () => {
    const pack = TestBed.inject(
      MLV_EDITOR_I18N,
    ) as WritableSignal<MlvEditorI18n>;
    pack.update((value) => ({ ...value, collaborationMoveCancelled: '  ' }));
    const { hub, editorA, editorB } = await pair();
    grab(editorA, 65); // "B"
    editorB.commands.insertContentAt(startOf(editorB, 'B') + 2, '!');
    await rig.sync(hub);
    expect(spoken).toEqual([CANCELLED]);
  });

  it('cancels and announces when a peer deletes the dragged block', async () => {
    const { hub, editorA, editorB } = await pair();
    const mount = grab(editorA, 65); // "B"
    const from = startOf(editorB, 'B');
    editorB.view.dispatch(editorB.state.tr.delete(from, from + 3));
    await rig.sync(hub);
    expect(texts(editorA)).toEqual(['A', 'C']);
    expect(dimmed(editorA)).toEqual([]);
    expect(spoken).toEqual([CANCELLED]);

    fire(mount, 'drop', 75);
    expect(texts(editorA)).toEqual(['A', 'C']);
  });

  it('keeps the drag when a peer types in the dragged block that carries a block id', async () => {
    const { hub, editorA, editorB } = await pair(true);
    grab(editorA, 35); // "A"
    editorB.commands.insertContentAt(startOf(editorB, 'A') + 2, '!');
    await rig.sync(hub);
    expect(texts(editorA)).toEqual(['A!', 'B', 'C']);
    expect(dimmed(editorA)).toEqual([0]);

    fire(editorA.view.dom, 'drop', 105);
    await rig.sync(hub);
    expect(texts(editorA)).toEqual(['B', 'C', 'A!']);
    expect(texts(editorB)).toEqual(texts(editorA));
    expect(spoken).toEqual(['Moved paragraph to position 3 of 3']);
  });

  it('still ends the drag silently on a local edit', async () => {
    const { editorA } = await pair();
    const mount = grab(editorA, 35); // "A"
    editorA.commands.insertContentAt(startOf(editorA, 'C') + 2, '!');
    expect(dimmed(editorA)).toEqual([]);
    fire(mount, 'drop', 105);
    expect(texts(editorA)).toEqual(['A', 'B', 'C!']);
    expect(spoken).toEqual([]);
  });
});
