import type { Editor, JSONContent } from '@tiptap/core';
import { ySyncPluginKey } from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';
import type { MemoryCollaborationHub } from './testing/memory-relay';

describe('MlvEditorCollaboration — block IDs and heading anchors (F-D16)', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  /** Appends unassigned paragraphs straight into the server's shared document. */
  const writeParagraphs = (
    hub: MemoryCollaborationHub,
    ...texts: string[]
  ): void => {
    const server = hub.serverDoc as Y.Doc;
    server.transact(() => {
      const fragment = server.getXmlFragment('default');
      for (const text of texts) {
        const paragraph = new Y.XmlElement('paragraph');
        paragraph.insert(0, [new Y.XmlText(text)]);
        fragment.insert(fragment.length, [paragraph]);
      }
    });
  };

  const blockIds = (editor: Editor): unknown[] =>
    (editor.getJSON().content ?? []).map(
      (block: JSONContent) => block.attrs?.['blockId'] ?? null,
    );

  it('assigns IDs once after the first sync, and never mints on a remote transaction', async () => {
    const hub = rig.hub('server');
    writeParagraphs(hub, 'One', 'Two');
    const a = await rig.mount({ transport: hub.endpoint(), blockIds: true });
    await rig.sync(hub);
    const editor = tiptap(a);
    const ids = blockIds(editor);
    expect(ids).toHaveLength(2);
    ids.forEach((id) => expect(id).toMatch(/^[0-9a-z]{10}$/));
    // The pass wrote the IDs into the shared document.
    expect(hub.serverDoc?.getXmlFragment('default').toString()).toContain(
      String(ids[0]),
    );

    // A block arriving from a peer stays unassigned on this client.
    writeParagraphs(hub, 'Three');
    await rig.sync(hub);
    expect(blockIds(editor)).toEqual([...ids, null]);

    // The next local edit touching it mints it (N1-D3, lazily).
    const end = editor.state.doc.content.size - 1;
    editor.view.dispatch(editor.state.tr.insertText('!', end));
    const minted = blockIds(editor)[2];
    expect(minted).toMatch(/^[0-9a-z]{10}$/);
    expect(new Set(blockIds(editor)).size).toBe(3);
  });

  it('converges when two first joiners mint the same unassigned blocks concurrently', async () => {
    const hub = rig.hub('server');
    writeParagraphs(hub, 'One', 'Two', 'Three');
    hub.pause();
    const a = await rig.mount({ transport: hub.endpoint(), blockIds: true });
    const b = await rig.mount({ transport: hub.endpoint(), blockIds: true });
    hub.flushShuffled(99);
    hub.resume();
    await rig.sync(hub);
    const [editorA, editorB] = [tiptap(a), tiptap(b)];
    expect(blockIds(editorA)).toEqual(blockIds(editorB));
    expect(new Set(blockIds(editorA)).size).toBe(3);
    blockIds(editorA).forEach((id) => expect(id).toMatch(/^[0-9a-z]{10}$/));
    expect(JSON.stringify(editorA.getJSON())).toBe(
      JSON.stringify(editorB.getJSON()),
    );
  });

  it('does not recompute heading slugs on a remote transaction', async () => {
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      headingAnchors: true,
    });
    const b = await rig.mount({
      transport: hub.endpoint(),
      headingAnchors: true,
    });
    await rig.sync(hub);
    const [editorA, editorB] = [tiptap(a), tiptap(b)];
    editorB.commands.setContent('<h2>Release notes</h2><p>Body</p>');
    await rig.sync(hub);
    const anchor = (editor: Editor): unknown =>
      editor.getJSON().content?.[0]?.attrs?.['anchor'];
    expect(anchor(editorB)).toBe('release-notes');
    expect(anchor(editorA)).toBe('release-notes');

    const docA = a.componentInstance.collaboration().document() as Y.Doc;
    const localUpdates: unknown[] = [];
    docA.on('update', (_update: Uint8Array, origin: unknown) => {
      if (origin === ySyncPluginKey) localUpdates.push(origin);
    });
    const from = a.componentInstance.transactions.length;
    editorB.view.dispatch(
      editorB.state.tr.insertText(' 2', 1 + 'Release notes'.length),
    );
    await rig.sync(hub);
    expect(anchor(editorB)).toBe('release-notes-2');
    expect(anchor(editorA)).toBe('release-notes-2');
    expect(localUpdates).toEqual([]);
    expect(
      a.componentInstance.transactions.slice(from).map((event) => event.origin),
    ).not.toContain('local');
  });
});
