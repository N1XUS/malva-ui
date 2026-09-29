import { mlvEditorDefaultExtensions } from '@malva-ui/editor';
import { getSchema } from '@tiptap/core';
import { yUndoPluginKey } from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import { createMlvEditorCollaborationSeed } from './collaboration-seed';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';
import type { MemoryTransport } from './testing/memory-relay';

describe('MlvEditorCollaboration — write gate and seeding', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  const codes = (errors: { code: string; recoverable: boolean }[]) =>
    errors.map((error) => [error.code, error.recoverable]);

  it('is read-only and busy until the first sync, then opens and emits editorReady once', async () => {
    const hub = rig.hub('server', { autoConnect: false });
    const a = await rig.mount({ transport: hub.endpoint() });
    const editor = tiptap(a);
    const host = a.nativeElement.querySelector('mlv-editor') as HTMLElement;
    expect(editor.isEditable).toBe(false);
    expect(editor.view.dom.getAttribute('aria-readonly')).toBe('true');
    expect(editor.view.dom.getAttribute('aria-busy')).toBe('true');
    expect(host.classList.contains('mlv-editor--syncing')).toBe(true);
    expect(a.componentInstance.readyCount).toBe(0);
    expect(
      a.componentInstance
        .editor()
        .run((current) => current.commands.insertContent('x')),
    ).toBe(false);

    (hub.endpoints[0] as MemoryTransport).goOnline();
    await rig.sync(hub);
    expect(editor.isEditable).toBe(true);
    expect(editor.view.dom.hasAttribute('aria-readonly')).toBe(false);
    expect(editor.view.dom.hasAttribute('aria-busy')).toBe(false);
    expect(host.classList.contains('mlv-editor--syncing')).toBe(false);
    expect(a.componentInstance.readyCount).toBe(1);
  });

  it('goes offline on the sync timeout, emits editorReady and an error, and stays read-only', async () => {
    const hub = rig.hub('server', { autoConnect: false });
    const a = await rig.mount({ transport: hub.endpoint(), syncTimeout: 20 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await rig.settle();
    const editor = tiptap(a);
    expect(a.componentInstance.collaboration().status()).toBe('offline');
    expect(a.componentInstance.readyCount).toBe(1);
    expect(codes(a.componentInstance.errors)).toEqual([
      ['collaboration', true],
    ]);
    expect(editor.isEditable).toBe(false);
    expect(editor.view.dom.getAttribute('aria-readonly')).toBe('true');
    expect(editor.view.dom.hasAttribute('aria-busy')).toBe(false);

    // A late sync opens the gate; editorReady is not emitted again.
    (hub.endpoints[0] as MemoryTransport).goOnline();
    await rig.sync(hub);
    expect(editor.isEditable).toBe(true);
    expect(a.componentInstance.readyCount).toBe(1);
  });

  it('is editable offline at once over a host document that carries the seed flag', async () => {
    const schema = getSchema(mlvEditorDefaultExtensions({ format: 'html' }));
    const document = new Y.Doc();
    Y.applyUpdate(
      document,
      createMlvEditorCollaborationSeed(
        {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Stored' }] },
          ],
        },
        { schema },
      ),
    );
    const hub = rig.hub('server', { autoConnect: false });
    const a = await rig.mount({ transport: hub.endpoint(), document });
    await rig.settle();
    expect(tiptap(a).isEditable).toBe(true);
    expect(tiptap(a).getText()).toBe('Stored');
    rig.destroy();
    expect(document.isDestroyed).toBe(false);
    document.destroy();
  });

  it('stays editable after a disconnect, tracking unsynced changes until the next sync', async () => {
    const hub = rig.hub('server');
    const a = await rig.mount({ transport: hub.endpoint() });
    await rig.sync(hub);
    const endpoint = hub.endpoints[0] as MemoryTransport;
    endpoint.goOffline();
    await rig.settle();
    const editor = tiptap(a);
    expect(a.componentInstance.collaboration().status()).toBe('offline');
    expect(editor.isEditable).toBe(true);
    editor.commands.insertContent('offline');
    expect(a.componentInstance.collaboration().hasUnsyncedChanges()).toBe(true);
    endpoint.goOnline();
    await rig.sync(hub);
    expect(a.componentInstance.collaboration().hasUnsyncedChanges()).toBe(
      false,
    );
    expect(hub.serverDoc?.getXmlFragment('default').toString()).toContain(
      'offline',
    );
  });

  it('seeds the fallback content once, never from value, and not as an undo step', async () => {
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      initialContent: '<p>Seed</p>',
    });
    await rig.sync(hub);
    const b = await rig.mount({
      transport: hub.endpoint(),
      initialContent: '<p>Other</p>',
    });
    await rig.sync(hub);
    expect(tiptap(a).getText()).toBe('Seed');
    expect(tiptap(b).getText()).toBe('Seed');
    expect(tiptap(a).can().undo()).toBe(false);
    const undoManager = (
      yUndoPluginKey.getState(tiptap(a).state) as { undoManager: Y.UndoManager }
    ).undoManager;
    expect(undoManager.undoStack).toHaveLength(0);

    const lone = rig.hub('server');
    const c = await rig.mount({
      transport: lone.endpoint(),
      value: '<p>From value</p>',
    });
    await rig.sync(lone);
    expect(tiptap(c).getText()).toBe('');
    // The shared (empty) document replaced the model value; empty serializes to null.
    expect(c.componentInstance.value()).toBeNull();
    expect(c.componentInstance.errors).toEqual([]);
  });

  it('turns a remote document failing the schema check into a collaboration failure, keeping the doc', async () => {
    const document = new Y.Doc();
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      document,
      initialContent: '<p>Fine</p>',
    });
    await rig.sync(hub);
    const server = hub.serverDoc as Y.Doc;
    // Bold and code on one run: both marks are known and allowed, so the
    // schema guard (D-F9) lets it through and y-tiptap renders it, but
    // `doc.check()` rejects the mark set (code excludes every mark). Unknown
    // nodes, marks and attributes, and disallowed content, fail at the guard
    // instead (collaboration-schema-guard.spec.ts).
    server.transact(() => {
      const paragraph = new Y.XmlElement('paragraph');
      const text = new Y.XmlText();
      text.insert(0, 'both', { bold: {}, code: {} });
      paragraph.insert(0, [text]);
      server.getXmlFragment('default').insert(1, [paragraph]);
    });
    await rig.sync(hub);
    const editor = tiptap(a);
    expect(codes(a.componentInstance.errors)).toEqual([
      ['collaboration', false],
    ]);
    expect(a.componentInstance.collaboration().status()).toBe('failed');
    expect(editor.isEditable).toBe(false);
    expect((hub.endpoints[0] as MemoryTransport).unsubscribeCount).toBe(1);
    expect(document.isDestroyed).toBe(false);
    expect(server.isDestroyed).toBe(false);
    // Cut off: the editor never writes its stale document back, which would
    // delete whatever it no longer renders.
    const updates: Uint8Array[] = [];
    document.on('update', (update: Uint8Array) => updates.push(update));
    editor.view.dispatch(editor.state.tr.insertText('typed', 1));
    editor.commands.setTextSelection(2);
    await rig.settle();
    expect(updates).toEqual([]);
    rig.destroy();
    document.destroy();
  });
});
