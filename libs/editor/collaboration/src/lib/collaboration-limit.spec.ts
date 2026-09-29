import type { Editor } from '@tiptap/core';
import { CharacterCount } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';
import type { MemoryTransport } from './testing/memory-relay';

describe('MlvEditorCollaboration — characterLimit (F-D11)', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  const type = (editor: Editor, pos: number, text: string): void =>
    editor.view.dispatch(editor.state.tr.insertText(text, pos));

  async function pair(limit: number) {
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      characterLimit: limit,
    });
    const b = await rig.mount({ transport: hub.endpoint() });
    await rig.sync(hub);
    return { hub, a, b, editorA: tiptap(a), editorB: tiptap(b) };
  }

  it('counts through CharacterCount without an upstream limit', async () => {
    const { editorA } = await pair(10);
    const names = editorA.extensionManager.extensions.map(
      (extension) => extension.name,
    );
    expect(names).toContain('mlvEditorCollaborationCharacterLimit');
    const characterCount = editorA.extensionManager.extensions.find(
      (extension) => extension.name === 'characterCount',
    );
    expect((characterCount?.options as { limit?: unknown }).limit).toBeNull();
  });

  it('accepts a remote transaction over the limit, then blocks local growth and allows shrinking', async () => {
    const { hub, editorA, editorB } = await pair(10);
    type(editorB, 1, 'This is far more than ten characters');
    await rig.sync(hub);
    expect(editorA.getText()).toBe('This is far more than ten characters');
    expect(JSON.stringify(editorA.getJSON())).toBe(
      JSON.stringify(editorB.getJSON()),
    );

    type(editorA, 1, 'more ');
    expect(editorA.getText()).toBe('This is far more than ten characters');

    editorA.view.dispatch(editorA.state.tr.delete(1, 6));
    expect(editorA.getText()).toBe('is far more than ten characters');
    await rig.sync(hub);
    expect(editorB.getText()).toBe('is far more than ten characters');
  });

  it('trims a local paste to the limit', async () => {
    const { hub, editorA, editorB } = await pair(10);
    editorA.view.dispatch(
      editorA.state.tr.insertText('abcdefghijklmnop', 1).setMeta('paste', true),
    );
    expect(editorA.getText()).toBe('abcdefghij');
    await rig.sync(hub);
    expect(editorB.getText()).toBe('abcdefghij');
  });

  it('fails closed on a consumer set with a limited CharacterCount', async () => {
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        CharacterCount.configure({ limit: 5 }),
      ],
    });
    await rig.settle();
    expect(a.componentInstance.editor().editor()).toBeNull();
    expect(
      a.componentInstance.errors.map((error) => [
        error.code,
        error.recoverable,
      ]),
    ).toEqual([['configuration', false]]);
    expect(a.componentInstance.errors[0].message).toContain('CharacterCount');
    expect((hub.endpoints[0] as MemoryTransport).subscribeCount).toBe(0);
  });
});
