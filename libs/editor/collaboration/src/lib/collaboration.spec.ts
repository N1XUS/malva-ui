import { By } from '@angular/platform-browser';
import { MLV_EDITOR_COLLABORATION, MlvEditor } from '@malva-ui/editor';
import * as Y from 'yjs';
import { MlvEditorCollaboration } from './collaboration';
import { mlvEditorCollaborationPaletteColor } from './collaboration-palette';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';
import type { MemoryTransport } from './testing/memory-relay';

describe('MlvEditorCollaboration — two editors', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  const stateVector = (doc: Y.Doc | null): number[] =>
    Array.from(Y.encodeStateVector(doc as Y.Doc));

  it('resolves the co-hosted directive as the editor binding (U6)', async () => {
    const hub = rig.hub('server');
    const fixture = await rig.mount({ transport: hub.endpoint() });
    const host = fixture.debugElement.query(By.directive(MlvEditor));
    const editor = host.injector.get(MlvEditor);
    const directive = host.injector.get(MlvEditorCollaboration);
    expect(editor['_collaborationBinding'] === directive).toBe(true);
    expect(host.injector.get(MLV_EDITOR_COLLABORATION) === directive).toBe(
      true,
    );
    expect(
      (host.nativeElement as HTMLElement).classList.contains(
        'mlv-editor--collaborative',
      ),
    ).toBe(true);
  });

  describe.each(['relay', 'server'] as const)('over a %s', (topology) => {
    it('converges concurrent typing under shuffled delivery', async () => {
      const hub = rig.hub(topology);
      const a = await rig.mount({
        transport: hub.endpoint(),
        initialContent: '<p>Start</p>',
      });
      const b = await rig.mount({
        transport: hub.endpoint(),
        initialContent: '<p>Start</p>',
      });
      await rig.sync(hub);
      const [editorA, editorB] = [tiptap(a), tiptap(b)];
      expect(editorA.getText()).toBe('Start');
      expect(editorB.getText()).toBe('Start');
      expect(editorA.isEditable && editorB.isEditable).toBe(true);

      for (const seed of [7, 42, 1234]) {
        hub.pause();
        editorA.commands.insertContentAt(1, `a${seed} `);
        editorB.commands.insertContentAt(
          editorB.state.doc.content.size - 1,
          ` b${seed}`,
        );
        editorA.commands.insertContentAt(
          editorA.state.doc.content.size - 1,
          '!',
        );
        hub.flushShuffled(seed);
        hub.resume();
        await rig.sync(hub);
      }

      expect(JSON.stringify(editorA.getJSON())).toBe(
        JSON.stringify(editorB.getJSON()),
      );
      for (const word of ['a7', 'a42', 'a1234', 'b7', 'b42', 'b1234']) {
        expect(editorA.getText()).toContain(word);
      }
      expect(
        stateVector(a.componentInstance.collaboration().document()),
      ).toEqual(stateVector(b.componentInstance.collaboration().document()));
    });
  });

  it('lists peers and self with sanitised identities, and emits on change', async () => {
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      user: { id: 'ada', name: '  Ada  ', color: '#ABCDEF' },
    });
    const b = await rig.mount({
      transport: hub.endpoint(),
      user: { id: 'grace', name: 'Grace', color: 'red' },
    });
    await rig.sync(hub);
    const collaborationA = a.componentInstance.collaboration();
    const peer = (
      list: readonly {
        name: string;
        color: string;
        mode: string;
        id: string | null;
      }[],
    ) => list.map(({ id, name, color, mode }) => [id, name, color, mode]);

    expect(peer(collaborationA.peers())).toEqual([
      [
        'grace',
        'Grace',
        mlvEditorCollaborationPaletteColor('grace'),
        'editing',
      ],
    ]);
    const self = collaborationA.self();
    expect(self ? peer([self]) : null).toEqual([
      ['ada', 'Ada', '#abcdef', 'editing'],
    ]);
    expect(peer(b.componentInstance.collaboration().peers())).toEqual([
      ['ada', 'Ada', '#abcdef', 'editing'],
    ]);

    // A readonly peer is announced as viewing.
    b.componentInstance.readonly.set(true);
    await rig.sync(hub);
    expect(peer(collaborationA.peers()).map((row) => row[3])).toEqual([
      'viewing',
    ]);
    expect(
      a.componentInstance.peerChanges.at(-1)?.map((entry) => entry.mode),
    ).toEqual(['viewing']);

    // Destroying B drops it from A at once.
    rig.fixtures.splice(1, 1)[0].destroy();
    await rig.sync(hub);
    expect(collaborationA.peers()).toEqual([]);
  });

  it('reports statuses through the output, and tears down on destroy', async () => {
    const hub = rig.hub('server');
    const endpoint = hub.endpoint();
    const a = await rig.mount({ transport: endpoint });
    await rig.sync(hub);
    const document = a.componentInstance.collaboration().document();
    expect(a.componentInstance.statuses).toEqual(['syncing', 'synced']);
    rig.fixtures.splice(0, 1)[0].destroy();
    expect(endpoint.outboundCompleted).toBe(true);
    expect(endpoint.unsubscribeCount).toBe(1);
    expect(document?.isDestroyed).toBe(true);
  });

  it.each([
    ['error', 'failed'],
    ['complete', 'closed'],
  ] as const)(
    'goes read-only on a transport %s, with one error',
    async (kind, status) => {
      const hub = rig.hub('server');
      const a = await rig.mount({ transport: hub.endpoint() });
      await rig.sync(hub);
      const endpoint = hub.endpoints[0] as MemoryTransport;
      if (kind === 'error') endpoint.error(new Error('socket gone'));
      else endpoint.complete();
      await rig.settle();
      const editor = tiptap(a);
      expect(a.componentInstance.collaboration().status()).toBe(status);
      expect(editor.isEditable).toBe(false);
      expect(editor.view.dom.getAttribute('aria-readonly')).toBe('true');
      expect(
        a.componentInstance.errors.map((error) => [
          error.code,
          error.recoverable,
        ]),
      ).toEqual([['collaboration', false]]);
    },
  );

  it('reports a change to a read-once input once, and keeps the session', async () => {
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      documentId: 'doc-1',
    });
    await rig.sync(hub);
    const session = a.componentInstance.collaboration().document();
    a.componentRef.setInput('documentId', 'doc-2');
    await rig.settle();
    a.componentRef.setInput('transport', hub.endpoint());
    await rig.settle();
    expect(
      a.componentInstance.errors.map((error) => [
        error.code,
        error.recoverable,
      ]),
    ).toEqual([['configuration', true]]);
    expect(a.componentInstance.collaboration().document() === session).toBe(
      true,
    );
    expect((hub.endpoints[0] as MemoryTransport).documentId).toBe('doc-1');
    expect((hub.endpoints[1] as MemoryTransport).subscribeCount).toBe(0);
  });
});
