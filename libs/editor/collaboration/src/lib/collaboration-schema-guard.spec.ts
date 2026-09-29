import { type Editor, getSchema } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';
import * as Y from 'yjs';
import { createMlvEditorCollaborationSeed } from './collaboration-seed';
import { MLV_EDITOR_COLLABORATION_SESSION_ORIGIN } from './collaboration-session';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';
import type {
  MemoryCollaborationHub,
  MemoryTransport,
} from './testing/memory-relay';

/*
 * D-F9: y-tiptap deletes shared content its schema cannot build. A client
 * lacking a node, mark or attribute a peer wrote fails closed instead, and
 * neither the shared document nor the other peers lose anything.
 */

const LOCAL = [StarterKit.configure({ undoRedo: false })];
const RICH = [
  StarterKit.configure({ undoRedo: false }),
  Highlight,
  Image,
  TextAlign.configure({ types: ['paragraph'] }),
];
const SEED = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fine' }] }],
};

const codes = (errors: { code: string; recoverable: boolean }[]) =>
  errors.map((error) => [error.code, error.recoverable]);
const vector = (doc: Y.Doc) => Array.from(Y.encodeStateVector(doc));
const fragmentOf = (doc: Y.Doc) => doc.getXmlFragment('default').toString();

describe('MlvEditorCollaboration — schema guard (D-F9)', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  it('pins the Yjs contract: an observer removed on beforeObserverCalls is not called', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('default');
    const calls: string[] = [];
    const observer = (): number => calls.push('observer');
    fragment.observeDeep(observer);
    const before = (): void => {
      calls.push('before');
      fragment.unobserveDeep(observer);
    };
    doc.on('beforeObserverCalls', before);
    fragment.insert(0, [new Y.XmlElement('paragraph')]);
    doc.off('beforeObserverCalls', before);
    fragment.observeDeep(observer);
    fragment.insert(0, [new Y.XmlElement('paragraph')]);
    expect(calls).toEqual(['before', 'observer']);
  });

  /** A server seeded with content both schemas accept, and a local-schema client A. */
  async function start(withSender: boolean) {
    const hub = rig.hub('server');
    const server = hub.serverDoc as Y.Doc;
    Y.applyUpdate(
      server,
      createMlvEditorCollaborationSeed(SEED, { schema: getSchema(LOCAL) }),
    );
    const a = await rig.mount({ transport: hub.endpoint(), extensions: LOCAL });
    const b = withSender
      ? await rig.mount({ transport: hub.endpoint(), extensions: RICH })
      : null;
    await rig.sync(hub);
    const docA = a.componentInstance.collaboration().document() as Y.Doc;
    return {
      hub,
      server,
      a,
      b,
      docA,
      editorA: tiptap(a),
      editorB: b ? tiptap(b) : null,
    };
  }

  interface Row {
    readonly name: string;
    /** The content A cannot build, written by B (a richer schema) or straight on the server. */
    readonly edit: (
      editorB: Editor | null,
      hub: MemoryCollaborationHub,
    ) => void;
    readonly marker: string;
    readonly sender: boolean;
  }

  const ROWS: readonly Row[] = [
    {
      name: 'a mark it lacks',
      sender: true,
      marker: '<highlight>',
      edit: (b) =>
        b?.commands.insertContentAt(
          b.state.doc.content.size,
          '<p><mark>marked</mark></p>',
        ),
    },
    {
      // A changed text whose parent nothing else touched: only the
      // XmlText → parent branch of the runtime guard sees it.
      name: 'a mark it lacks, on existing text',
      sender: true,
      marker: '<highlight>Fine',
      edit: (b) =>
        b?.chain().setTextSelection({ from: 1, to: 5 }).toggleHighlight().run(),
    },
    {
      name: 'a node it lacks',
      sender: true,
      marker: '<image',
      edit: (b) =>
        b?.commands.insertContentAt(
          b.state.doc.content.size,
          '<img src="https://example.com/a.png">',
        ),
    },
    {
      name: 'an attribute it lacks',
      sender: true,
      marker: 'textAlign="center"',
      edit: (b) => b?.chain().setTextSelection(2).setTextAlign('center').run(),
    },
    {
      // A plain-object prototype member: `in` would find it on `spec.attrs`.
      name: 'an attribute named after an Object.prototype member',
      sender: false,
      marker: 'constructor="x"',
      edit: (_b, hub) => {
        const server = hub.serverDoc as Y.Doc;
        const paragraph = server.getXmlFragment('default').get(0);
        (paragraph as Y.XmlElement).setAttribute('constructor', 'x');
      },
    },
    {
      name: 'a mark attribute named after an Object.prototype member',
      sender: false,
      marker: 'constructor="x"',
      edit: (_b, hub) => {
        const server = hub.serverDoc as Y.Doc;
        const paragraph = server.getXmlFragment('default').get(0);
        const text = (paragraph as Y.XmlElement).get(0) as Y.XmlText;
        text.format(0, 4, { bold: { constructor: 'x' } });
      },
    },
    {
      name: 'content its schema does not allow there',
      sender: false,
      marker: '<listitem>',
      edit: (_b, hub) => {
        const server = hub.serverDoc as Y.Doc;
        const item = new Y.XmlElement('listItem');
        const paragraph = new Y.XmlElement('paragraph');
        paragraph.insert(0, [new Y.XmlText('loose')]);
        item.insert(0, [paragraph]);
        server.getXmlFragment('default').insert(1, [item]);
      },
    },
  ];

  it.each(ROWS.map((row) => [row.name, row] as const))(
    'fails closed on %s, deleting nothing anywhere',
    async (_name, row) => {
      const { hub, server, a, b, docA, editorA, editorB } = await start(
        row.sender,
      );
      const endpointA = hub.endpoints[0] as MemoryTransport;
      // Deletions advance no clock: watch for any write A makes itself.
      const writes: Uint8Array[] = [];
      docA.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin !== MLV_EDITOR_COLLABORATION_SESSION_ORIGIN)
          writes.push(update);
      });
      const sent = endpointA.sent.length;
      const json = editorA.getJSON();
      expect(a.componentInstance.collaboration().status()).toBe('synced');

      row.edit(editorB, hub);
      await rig.sync(hub);

      expect(a.componentInstance.collaboration().status()).toBe('failed');
      expect(codes(a.componentInstance.errors)).toEqual([
        ['collaboration', false],
      ]);
      expect(editorA.isEditable).toBe(false);
      expect(endpointA.unsubscribeCount).toBe(1);
      // Nothing was deleted: the content is in the server's document, in the
      // sender's, and in A's own, which A never wrote to. Without the guard,
      // y-tiptap deletes an unknown mark's text or an unknown node for everyone.
      expect(fragmentOf(server)).toContain(row.marker);
      expect(fragmentOf(docA)).toBe(fragmentOf(server));
      if (b) {
        expect(
          fragmentOf(b.componentInstance.collaboration().document() as Y.Doc),
        ).toBe(fragmentOf(server));
        expect(
          vector(b.componentInstance.collaboration().document() as Y.Doc),
        ).toEqual(vector(server));
        expect(b.componentInstance.collaboration().status()).toBe('synced');
      }
      expect(writes).toEqual([]);
      expect(endpointA.sent.length).toBe(sent);
      expect(editorA.getJSON()).toEqual(json);
      expect(docA.isDestroyed).toBe(false);
    },
  );

  it('never writes to the shared document once failed, whatever the editor does', async () => {
    const { hub, docA, editorA, editorB } = await start(true);
    editorB?.commands.insertContentAt(
      editorB.state.doc.content.size,
      '<p><mark>marked</mark></p>',
    );
    await rig.sync(hub);
    const updates: Uint8Array[] = [];
    docA.on('update', (update: Uint8Array) => updates.push(update));
    editorA.view.dispatch(editorA.state.tr.insertText('typed', 1));
    editorA.commands.setTextSelection(3);
    editorA.commands.undo();
    await rig.settle();
    expect(updates).toEqual([]);
  });

  it('refuses a host document that already holds content it lacks, before rendering or connecting', async () => {
    const host = new Y.Doc();
    Y.applyUpdate(
      host,
      createMlvEditorCollaborationSeed(SEED, { schema: getSchema(RICH) }),
    );
    host.transact(() => {
      const paragraph = new Y.XmlElement('paragraph');
      const text = new Y.XmlText();
      text.insert(0, 'marked', { highlight: {} });
      paragraph.insert(0, [text]);
      host.getXmlFragment('default').insert(1, [paragraph]);
    });
    const before = { vector: vector(host), content: fragmentOf(host) };
    const updates: Uint8Array[] = [];
    host.on('update', (update: Uint8Array) => updates.push(update));
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      document: host,
      extensions: LOCAL,
    });
    await rig.sync(hub);
    const editorA = tiptap(a);
    const endpointA = hub.endpoints[0] as MemoryTransport;
    expect(a.componentInstance.collaboration().status()).toBe('failed');
    expect(codes(a.componentInstance.errors)).toEqual([
      ['collaboration', false],
    ]);
    expect(endpointA.subscribeCount).toBe(0);
    expect(editorA.isEditable).toBe(false);
    expect(editorA.getText()).toBe('');
    editorA.view.dispatch(editorA.state.tr.insertText('typed', 1));
    await rig.settle();
    expect(updates).toEqual([]);
    expect({ vector: vector(host), content: fragmentOf(host) }).toEqual(before);
    rig.destroy();
    expect(host.isDestroyed).toBe(false);
    host.destroy();
  });

  it('keeps valid remote edits flowing, including concurrent deletions that leave a block empty', async () => {
    const { hub, a, b, editorA, editorB } = await start(true);
    editorB?.commands.insertContentAt(
      editorB.state.doc.content.size,
      '<p>Second</p>',
    );
    await rig.sync(hub);
    // Each client deletes a different block at once: the merged document has
    // none, which ProseMirror refills with an empty paragraph.
    hub.pause();
    editorA.view.dispatch(
      editorA.state.tr.delete(0, editorA.state.doc.child(0).nodeSize),
    );
    const first = editorB?.state.doc.child(0).nodeSize ?? 0;
    editorB?.view.dispatch(
      editorB.state.tr.delete(first, editorB.state.doc.content.size),
    );
    hub.resume();
    await rig.sync(hub);
    expect(a.componentInstance.collaboration().status()).toBe('synced');
    expect(b?.componentInstance.collaboration().status()).toBe('synced');
    expect(a.componentInstance.errors).toEqual([]);
    expect(editorA.getText()).toBe(editorB?.getText());
  });
});
