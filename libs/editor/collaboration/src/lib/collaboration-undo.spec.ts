import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { yUndoPluginKey } from '@tiptap/y-tiptap';
import type * as Y from 'yjs';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';
import type { MemoryTransport } from './testing/memory-relay';

describe('MlvEditorCollaboration — undo', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  /** Inserts plain text as one local transaction, with no HTML parsing. */
  const type = (editor: Editor, pos: number, text: string): void =>
    editor.view.dispatch(editor.state.tr.insertText(text, pos));

  async function pair() {
    const hub = rig.hub('server');
    const a = await rig.mount({ transport: hub.endpoint() });
    const b = await rig.mount({ transport: hub.endpoint() });
    await rig.sync(hub);
    return { hub, a, b, editorA: tiptap(a), editorB: tiptap(b) };
  }

  it("reverts only the local user's change, keeping a peer's text inside it", async () => {
    const { hub, a, editorA, editorB } = await pair();
    type(editorA, 1, 'Hello world');
    await rig.sync(hub);
    expect(editorB.getText()).toBe('Hello world');

    // B types inside A's inserted run.
    type(editorB, 1 + 'Hello'.length, ' dear');
    await rig.sync(hub);
    expect(editorA.getText()).toBe('Hello dear world');

    expect(editorA.commands.undo()).toBe(true);
    await rig.sync(hub);
    // y-tiptap maps the PM change to Yjs by a string diff, so B's insert is
    // recorded as 'dear ' after A's 'Hello '; A's undo removes A's characters only.
    expect(editorA.getText()).toBe('dear ');
    expect(editorB.getText()).toBe('dear ');
    // A's own undo is a local transaction.
    expect(a.componentInstance.transactions.at(-1)?.origin).toBe('local');
    expect(editorB.can().undo()).toBe(true);
  });

  it('enables and disables toolbar Undo on undo-stack events, even without a transaction', async () => {
    const { a, editorA } = await pair();
    const undoButton = (): HTMLButtonElement =>
      a.nativeElement.querySelector(
        '.mlv-editor-undo-redo button',
      ) as HTMLButtonElement;
    expect(undoButton().disabled).toBe(true);
    editorA.commands.insertContentAt(1, 'Typed');
    await rig.settle();
    expect(undoButton().disabled).toBe(false);

    // Clearing the stack dispatches no transaction; the stack event alone
    // must refresh the toolbar.
    const undoManager = (
      yUndoPluginKey.getState(editorA.state) as { undoManager: Y.UndoManager }
    ).undoManager;
    const transactions = a.componentInstance.transactions.length;
    undoManager.clear();
    await rig.settle();
    expect(a.componentInstance.transactions.length).toBe(transactions);
    expect(undoButton().disabled).toBe(true);
  });

  it('can undo inside the first transaction event after a local edit (U11)', async () => {
    const { a, editorA } = await pair();
    const seen: boolean[] = [];
    const subscription = a.componentInstance
      .editor()
      .transaction.subscribe((event) => {
        if (event.transaction.docChanged) seen.push(event.editor.can().undo());
      });
    editorA.commands.insertContentAt(1, 'x');
    subscription.unsubscribe();
    expect(seen).toEqual([true]);
  });

  it('fails closed when a consumer extension set keeps undoRedo', async () => {
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      extensions: [StarterKit],
    });
    await rig.settle();
    expect(a.componentInstance.editor().editor()).toBeNull();
    expect(
      a.componentInstance.errors.map((error) => [
        error.code,
        error.recoverable,
      ]),
    ).toEqual([['configuration', false]]);
    expect(a.componentInstance.errors[0].message).toContain('undoRedo');
    expect((hub.endpoints[0] as MemoryTransport).subscribeCount).toBe(0);

    const b = await rig.mount({
      transport: hub.endpoint(),
      extensions: [StarterKit.configure({ undoRedo: false })],
    });
    await rig.sync(hub);
    expect(b.componentInstance.errors).toEqual([]);
    expect(b.componentInstance.collaboration().status()).toBe('synced');
  });
});
