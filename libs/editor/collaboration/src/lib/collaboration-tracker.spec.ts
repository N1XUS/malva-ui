import type { MlvEditorTransactionEvent } from '@malva-ui/editor';
import type { Editor } from '@tiptap/core';
import {
  createMappablePosition,
  getUpdatedPosition,
  type CollaborationMappablePosition,
} from '@tiptap/extension-collaboration';
// The tracker is internal to the primary entry; specs may reach it directly.
import { trackMlvEditorPosition } from '../../../src/lib/extensions/editor-position-tracker';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';

describe('MlvEditorPositionTracker under collaboration (F-D12)', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  const type = (editor: Editor, pos: number, text: string): void =>
    editor.view.dispatch(editor.state.tr.insertText(text, pos));

  /** Two synced editors over `<p>Hello world</p><p>Second block</p>`. */
  async function pair() {
    const hub = rig.hub('server');
    const content = '<p>Hello world</p><p>Second block</p>';
    const a = await rig.mount({
      transport: hub.endpoint(),
      initialContent: content,
    });
    const b = await rig.mount({
      transport: hub.endpoint(),
      initialContent: content,
    });
    await rig.sync(hub);
    return { hub, a, editorA: tiptap(a), editorB: tiptap(b) };
  }

  const before = (
    editor: Editor,
    pos: number | null,
    length: number,
  ): string =>
    pos === null ? '<lost>' : editor.state.doc.textBetween(pos - length, pos);

  it('recaptures anchors after the sync plugin pushed a local change (U1)', async () => {
    const { hub, editorA, editorB } = await pair();
    const tracked = trackMlvEditorPosition(editorA, 6);
    // A local insert before the position: a capture against the Yjs state
    // from before the push would point two characters too far.
    type(editorA, 1, 'XX');
    expect(tracked.pos).toBe(8);
    await rig.sync(hub);
    type(editorB, 1, 'YYY');
    await rig.sync(hub);
    expect(tracked.pos).toBe(11);
    expect(before(editorA, tracked.pos, 10)).toBe('YYYXXHello');
  });

  it('follows remote edits before, after and exactly at the position', async () => {
    const { hub, editorA, editorB } = await pair();
    const tracked = trackMlvEditorPosition(editorA, 6);
    type(editorB, 1, 'Oh ');
    await rig.sync(hub);
    expect(before(editorA, tracked.pos, 8)).toBe('Oh Hello');

    type(editorB, editorB.state.doc.content.size - 1, ' tail');
    await rig.sync(hub);
    expect(before(editorA, tracked.pos, 8)).toBe('Oh Hello');

    // Remote anchors associate to the left: text inserted exactly at the
    // position lands after it.
    const at = tracked.pos ?? 0;
    type(editorB, at, '++');
    await rig.sync(hub);
    expect(tracked.pos).toBe(at);
    expect(editorA.state.doc.textBetween(at, at + 2)).toBe('++');
  });

  it('is null when a peer deletes the block, where the upstream helper reports a live position', async () => {
    const { hub, a, editorA, editorB } = await pair();
    // Inside "Second block", after "Second".
    const second = 'Hello world'.length + 2 + 1 + 'Second'.length;
    expect(before(editorA, second, 6)).toBe('Second');
    const tracked = trackMlvEditorPosition(editorA, second);
    let upstream: CollaborationMappablePosition = createMappablePosition(
      second,
      editorA.state,
    );
    const subscription = a.componentInstance
      .editor()
      .transaction.subscribe((event: MlvEditorTransactionEvent) => {
        if (event.origin !== 'remote') return;
        upstream = getUpdatedPosition(
          upstream,
          event.transaction,
          event.editor.state,
        ).position as CollaborationMappablePosition;
      });

    const start = 'Hello world'.length + 2;
    editorB.view.dispatch(
      editorB.state.tr.delete(start, editorB.state.doc.content.size),
    );
    await rig.sync(hub);
    subscription.unsubscribe();
    expect(editorA.getText()).toBe('Hello world');
    expect(tracked.pos).toBeNull();
    // The hazard the tracker avoids: upstream resolves a lost anchor to the
    // place the block used to be, a live position (here the document end).
    expect(upstream.position).toBe(editorA.state.doc.content.size);
  });
});
