import type { Editor } from '@tiptap/core';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';

describe('MlvEditorCollaboration — value mirror', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  /** Inserts plain text as one local transaction. */
  const type = (editor: Editor, pos: number, text: string): void =>
    editor.view.dispatch(editor.state.tr.insertText(text, pos));

  const wait = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  async function pair() {
    const hub = rig.hub('server');
    const a = await rig.mount({ transport: hub.endpoint() });
    const b = await rig.mount({ transport: hub.endpoint() });
    await rig.sync(hub);
    const writes: (string | null)[] = [];
    const subscription = a.componentInstance
      .editor()
      .value.subscribe((value) => writes.push(value));
    return {
      hub,
      a,
      b,
      writes,
      subscription,
      editorA: tiptap(a),
      editorB: tiptap(b),
    };
  }

  it('coalesces remote transactions into one trailing write', async () => {
    const { hub, a, writes, subscription, editorB } = await pair();
    for (const letter of ['a', 'b', 'c', 'd', 'e']) {
      type(editorB, editorB.state.doc.content.size - 1, letter);
      await rig.sync(hub);
    }
    expect(writes).toEqual([]);
    await wait(150);
    await rig.settle();
    expect(writes).toEqual(['<p>abcde</p>']);
    expect(a.componentInstance.value()).toBe('<p>abcde</p>');
    subscription.unsubscribe();
  });

  it('writes a local change synchronously, carrying and cancelling a pending remote write', async () => {
    const { hub, writes, subscription, editorA, editorB } = await pair();
    type(editorB, 1, 'remote');
    await rig.sync(hub);
    expect(writes).toEqual([]);
    type(editorA, editorA.state.doc.content.size - 1, ' local');
    expect(writes).toEqual(['<p>remote local</p>']);
    await wait(150);
    await rig.settle();
    expect(writes).toEqual(['<p>remote local</p>']);
    subscription.unsubscribe();
  });

  it('ignores external writes, restoring the mirror with one error', async () => {
    const { hub, a, editorA, subscription } = await pair();
    type(editorA, 1, 'Shared');
    await rig.sync(hub);
    a.componentInstance.value.set('<p>Hijack</p>');
    await rig.sync(hub);
    expect(editorA.getText()).toBe('Shared');
    expect(a.componentInstance.value()).toBe('<p>Shared</p>');
    a.componentInstance.value.set('<p>Again</p>');
    await rig.sync(hub);
    expect(a.componentInstance.value()).toBe('<p>Shared</p>');
    expect(
      a.componentInstance.errors.map((error) => [
        error.code,
        error.recoverable,
        error.message,
      ]),
    ).toEqual([
      ['collaboration', true, 'value is output-only while collaborating'],
    ]);
    expect(hub.serverDoc?.getXmlFragment('default').toString()).not.toContain(
      'Hijack',
    );
    subscription.unsubscribe();
  });

  it('re-serializes the document on a format switch without an error', async () => {
    const { hub, a, editorA, subscription } = await pair();
    type(editorA, 1, 'Plain');
    await rig.sync(hub);
    a.componentRef.setInput('format', 'json');
    await rig.sync(hub);
    const value = a.componentInstance.value();
    expect(JSON.parse(value ?? 'null')).toMatchObject({ type: 'doc' });
    expect(value).toContain('Plain');
    expect(a.componentInstance.errors).toEqual([]);
    subscription.unsubscribe();
  });
});
