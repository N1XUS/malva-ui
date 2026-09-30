import { Component, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  MLV_EDITOR_AI_CONTEXT,
  MlvEditor,
  MlvEditorAiImprove,
  type MlvEditorAiProvider,
} from '@malva-ui/editor';
import type { Editor } from '@tiptap/core';
import * as decoding from 'lib0/decoding';
import { MlvEditorCollaboration } from './collaboration';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
  type CollaborationTestEditor,
} from './testing/collaboration-harness';
import {
  MemoryCollaborationHub,
  type MemoryTransport,
} from './testing/memory-relay';

/*
 * #516 × F1: the clean appearance while collaborating. AI stays off (F-D15,
 * until #738), so every clean-mode AI entry point is disabled; the command
 * menu's D-B2 preview sends a peer nothing; the gutter "+" never points at a
 * wrong block when a peer's edit moves its block; and nothing is claimed
 * before the first sync.
 */

const provider: MlvEditorAiProvider = {
  stream: async function* (): AsyncGenerator<string> {
    yield 'Rewritten';
  },
};

/** Outer type and, for sync frames, the sync message type. */
const kind = (frame: Uint8Array): string => {
  const decoder = decoding.createDecoder(frame);
  const outer = decoding.readVarUint(decoder);
  if (outer === 0)
    return ['step1', 'step2', 'update'][decoding.readVarUint(decoder)];
  return outer === 1 ? 'awareness' : outer === 3 ? 'query' : `type${outer}`;
};

const panel = () => document.querySelector<HTMLElement>('.mlv-menu__panel');

const menuItems = (): HTMLElement[] => [
  ...(panel()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
];

/** Waits one task: a keyboard open focuses its first item a task later. */
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve));

/** Presses Mod+Alt+Enter (Control here: jsdom reports no Apple platform). */
function chord(content: HTMLElement): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    ctrlKey: true,
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
  content.dispatchEvent(event);
  return event;
}

/** Top-level text of each block. */
const texts = (editor: Editor): string[] => {
  const out: string[] = [];
  editor.state.doc.forEach((node) => out.push(node.textContent));
  return out;
};

/** Text of the block holding the selection head. */
const caretBlock = (editor: Editor) => editor.state.selection.$head.parent;

/** The mount the handle and the "+" live in. */
const mountOf = (fixture: ComponentFixture<CollaborationTestEditor>) =>
  (fixture.nativeElement as HTMLElement).querySelector(
    '.mlv-editor__block-handle',
  )?.parentElement as HTMLElement;

const addOf = (mount: HTMLElement) =>
  mount.querySelector<HTMLElement>('.mlv-editor__block-add');

const hover = (mount: HTMLElement, clientY: number) =>
  mount.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY }));

/**
 * jsdom lays nothing out: every top-level block `i` of `editor` gets the box
 * 30 + 30i … +20, looked up live, so a peer's insert moves the boxes.
 */
function stubLayout(editor: Editor): void {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element): DOMRect {
      const index = [...editor.view.dom.children].indexOf(this);
      if (index < 0) return original.call(this);
      const top = 30 + index * 30;
      return {
        top,
        left: 48,
        width: 304,
        height: 20,
        right: 352,
        bottom: top + 20,
        x: 48,
        y: top,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );
}

@Component({
  selector: 'mlv-collaboration-improve-host',
  imports: [MlvEditor, MlvEditorCollaboration, MlvEditorAiImprove],
  template: `
    <mlv-editor
      [aiProvider]="provider"
      [mlvEditorCollaboration]="transport"
      collaborationDocumentId="doc-improve"
      collaborationInitialContent="<p>Hello world</p>"
    >
      <mlv-editor-ai-improve mlvEditorToolbarStart />
    </mlv-editor>
  `,
})
class ImproveHost {
  readonly hub = new MemoryCollaborationHub('server');
  readonly transport = this.hub.endpoint();
  readonly provider = provider;
  readonly editor = viewChild.required(MlvEditor);
}

describe('Clean appearance under collaboration (#516 × F1)', () => {
  let rig: CollaborationRig;

  beforeAll(() => {
    // jsdom performs no hit testing; see `editor-block-handle.spec.ts`.
    const target = document as Document & {
      elementFromPoint?: (x: number, y: number) => Element | null;
    };
    target.elementFromPoint ??= () => null;
  });

  beforeEach(async () => {
    await configureCollaborationTestBed([ImproveHost]);
    rig = new CollaborationRig();
  });

  afterEach(() => {
    rig.destroy();
    vi.restoreAllMocks();
  });

  /** Two synced clean peers; only A has an AI provider. */
  async function pair() {
    const hub = rig.hub('server');
    const content = '<p>Alpha</p><p>Beta</p><p>Gamma</p>';
    const transport = hub.endpoint();
    const a = await rig.mount({
      transport,
      initialContent: content,
      toolbarAppearance: 'clean',
      aiProvider: provider,
    });
    const b = await rig.mount({
      transport: hub.endpoint(),
      initialContent: content,
      toolbarAppearance: 'clean',
    });
    await rig.sync(hub);
    return { hub, a, transport, editorA: tiptap(a), editorB: tiptap(b) };
  }

  /** Presses Escape in the menu and lets the panel detach. */
  async function escape(): Promise<void> {
    const focused = document.activeElement as HTMLElement | null;
    const target = focused && panel()?.contains(focused) ? focused : panel();
    target?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    await rig.settle();
    await finishLeave();
  }

  /** Lets a closing panel's leave animation finish. */
  async function finishLeave(): Promise<void> {
    document
      .querySelectorAll('.mlv-popup--leave')
      .forEach((element) =>
        element.dispatchEvent(new Event('animationend', { bubbles: true })),
      );
    await rig.settle();
  }

  const aiOf = (fixture: ComponentFixture<unknown>) =>
    fixture.debugElement
      .query((node) => node.name === 'mlv-editor')
      .injector.get(MLV_EDITOR_AI_CONTEXT);

  it('keeps canStart false while bound, with a provider and the write gate open', async () => {
    const { a, editorA } = await pair();
    const ai = aiOf(a);
    expect([ai.hasProvider(), editorA.isEditable, ai.canStart()]).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('disables Improve in the clean bubble over a text selection', async () => {
    const { editorA } = await pair();
    editorA.view.dom.focus();
    editorA.commands.setTextSelection({ from: 1, to: 6 });
    await rig.settle();
    const improve = document.querySelector<HTMLElement>(
      '.mlv-editor-bubble mlv-editor-ai-improve',
    );
    expect(improve?.hidden).toBe(false);
    expect(improve?.querySelector('button')?.disabled).toBe(true);
  });

  it('disables a consumer-placed Improve control over a text selection', async () => {
    const fixture = TestBed.createComponent(ImproveHost);
    const host = fixture.componentInstance;
    try {
      for (let round = 0; round < 4; round++) {
        host.hub.flush();
        fixture.detectChanges();
        await fixture.whenStable();
      }
      const editor = host.editor().editor() as Editor;
      editor.view.dom.focus();
      editor.commands.setTextSelection({ from: 1, to: 6 });
      fixture.detectChanges();
      await fixture.whenStable();
      const button = (fixture.nativeElement as HTMLElement).querySelector(
        '.mlv-editor__toolbar-band mlv-editor-ai-improve button',
      ) as HTMLButtonElement;
      expect([editor.isEditable, aiOf(fixture).hasProvider()]).toEqual([
        true,
        true,
      ]);
      expect(button.disabled).toBe(true);
    } finally {
      fixture.destroy();
      host.hub.destroy();
    }
  });

  it('disables Ask AI in the command menu', async () => {
    const { editorA } = await pair();
    const content = editorA.view.dom as HTMLElement;
    content.focus();
    editorA.commands.setTextSelection(3);
    await rig.settle();
    chord(content);
    await rig.settle();
    const ask = menuItems().find(
      (item) => item.textContent?.trim() === 'Ask AI…',
    );
    expect(ask?.getAttribute('aria-disabled')).toBe('true');
    await escape();
  });

  it('sends the peer no document update when the menu opens and is dismissed at the caret (D-B2)', async () => {
    const { hub, a, transport, editorA, editorB } = await pair();
    const content = editorA.view.dom as HTMLElement;
    content.focus();
    editorA.commands.setTextSelection(3);
    await rig.sync(hub);
    const doc = editorA.state.doc;
    const from = transport.sent.length;

    chord(content);
    await rig.settle();
    await nextTask();
    await rig.settle();
    expect(panel()).not.toBeNull();
    const indicator = (a.nativeElement as HTMLElement).querySelector(
      '.mlv-editor__drop-indicator',
    );
    expect(indicator?.getAttribute('data-visible')).toBe('true');
    await escape();
    await rig.sync(hub);

    expect(panel()).toBeNull();
    expect(transport.sent.slice(from).map(kind)).toEqual([]);
    expect(editorA.state.doc).toBe(doc);
    expect(editorB.getJSON()).toEqual(editorA.getJSON());

    // The channel is live: a real edit does reach the peer as an update.
    editorA.commands.insertContent('!');
    await rig.sync(hub);
    expect(transport.sent.slice(from).map(kind)).toContain('update');
    expect(texts(editorB)[0]).toBe('Al!pha');
  });

  it('sends no document update when the "+" opens the menu on another block (D-B2)', async () => {
    const { hub, a, transport, editorA, editorB } = await pair();
    stubLayout(editorA);
    const mount = mountOf(a);
    editorA.commands.setTextSelection(2);
    await rig.sync(hub);
    const from = transport.sent.length;

    hover(mount, 95); // "Gamma"
    addOf(mount)?.click();
    await rig.settle();
    expect(panel()).not.toBeNull();
    expect(caretBlock(editorA).textContent).toBe('Gamma');
    await escape();
    await rig.sync(hub);

    expect(
      transport.sent
        .slice(from)
        .map(kind)
        .filter((frame) => frame !== 'awareness'),
    ).toEqual([]);
    expect(editorB.getJSON()).toEqual(editorA.getJSON());
  });

  it('closes the menu when the session fails, and runs no item into the cut-off document', async () => {
    const { hub, transport, editorA, editorB } = await pair();
    const content = editorA.view.dom as HTMLElement;
    content.focus();
    editorA.commands.setTextSelection(3);
    await rig.sync(hub);
    chord(content);
    await rig.settle();
    const bullet = menuItems().find(
      (item) => item.textContent?.trim() === 'Bullet list',
    );
    expect(bullet?.getAttribute('aria-disabled')).not.toBe('true');
    const doc = editorA.state.doc;
    const peer = editorB.getJSON();
    const from = transport.sent.length;

    transport.error(new Error('socket gone'));
    await rig.settle();
    await finishLeave();
    expect(editorA.isEditable).toBe(false);
    expect(panel()).toBeNull();

    // A press racing the close writes nothing either.
    bullet?.click();
    await rig.settle();
    expect(editorA.state.doc).toBe(doc);
    expect(
      transport.sent
        .slice(from)
        .map(kind)
        .filter((frame) => frame !== 'awareness'),
    ).toEqual([]);
    expect(editorB.getJSON()).toEqual(peer);
  });

  it('hides the "+" when a peer inserts above its block, and opens the right block on the next move', async () => {
    const { hub, a, editorA, editorB } = await pair();
    stubLayout(editorA);
    const mount = mountOf(a);
    hover(mount, 65); // "Beta"
    expect(addOf(mount)?.getAttribute('data-visible')).toBe('true');

    editorB.commands.insertContentAt(0, '<p>Zeta</p>');
    await rig.sync(hub);
    expect(texts(editorA)).toEqual(['Zeta', 'Alpha', 'Beta', 'Gamma']);
    // y-tiptap replaces the whole document on every remote update, so the
    // position the "+" maps is deleted: it hides, never pointing at a wrong
    // block (tracking it with F's position tracker is the follow-up).
    expect(addOf(mount)?.getAttribute('data-visible')).toBe('false');
    addOf(mount)?.click();
    await rig.settle();
    expect(panel()).toBeNull();

    hover(mount, 95); // "Beta", now block 2
    expect(addOf(mount)?.getAttribute('data-visible')).toBe('true');
    addOf(mount)?.click();
    await rig.settle();
    expect(panel()).not.toBeNull();
    expect(caretBlock(editorA).textContent).toBe('Beta');
    await escape();
  });

  it('keeps the caret in its block across a peer insert above, so the chord opens that block', async () => {
    const { hub, editorA, editorB } = await pair();
    const content = editorA.view.dom as HTMLElement;
    content.focus();
    editorA.commands.setTextSelection(16); // "Ga|mma"
    await rig.sync(hub);
    expect(caretBlock(editorA).textContent).toBe('Gamma');

    editorB.commands.insertContentAt(0, '<p>Zeta</p>');
    await rig.sync(hub);
    const $head = editorA.state.selection.$head;
    expect([$head.parent.textContent, $head.parentOffset]).toEqual([
      'Gamma',
      2,
    ]);

    chord(content);
    await rig.settle();
    expect(panel()).not.toBeNull();
    expect(caretBlock(editorA).textContent).toBe('Gamma');
    await escape();
  });

  it('neither advertises nor claims the chord before the first sync', async () => {
    const hub = rig.hub('server', { autoConnect: false });
    const a = await rig.mount({
      transport: hub.endpoint(),
      toolbarAppearance: 'clean',
    });
    const editor = tiptap(a);
    const content = editor.view.dom as HTMLElement;
    expect(editor.isEditable).toBe(false);
    expect(content.getAttribute('aria-keyshortcuts')).toBe('Alt+F10');
    expect(chord(content).defaultPrevented).toBe(false);
    expect(panel()).toBeNull();

    (hub.endpoints[0] as MemoryTransport).goOnline();
    await rig.sync(hub);
    expect(content.getAttribute('aria-keyshortcuts')).toBe(
      'Alt+F10 Control+Alt+Enter',
    );
  });

  it('shows no caret "+" under (hover: none) before the first sync, and does once synced', async () => {
    // jsdom implements no `matchMedia`; the inserter reads it at creation.
    const query = (matches: boolean) => ({
      matches,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (media: string) => query(media === '(hover: none)'),
    });
    try {
      const hub = rig.hub('server', { autoConnect: false });
      const a = await rig.mount({
        transport: hub.endpoint(),
        toolbarAppearance: 'clean',
      });
      const editor = tiptap(a);
      stubLayout(editor);
      const mount = mountOf(a);
      editor.view.dom.focus();
      editor.commands.setTextSelection(1);
      await rig.settle();
      expect(editor.view.hasFocus()).toBe(true);
      expect(addOf(mount)).toBeNull();

      (hub.endpoints[0] as MemoryTransport).goOnline();
      await rig.sync(hub);
      editor.view.dom.focus();
      editor.commands.setTextSelection(1);
      await rig.settle();
      expect(addOf(mount)?.getAttribute('data-visible')).toBe('true');
    } finally {
      delete (window as Partial<Window>).matchMedia;
    }
  });
});
