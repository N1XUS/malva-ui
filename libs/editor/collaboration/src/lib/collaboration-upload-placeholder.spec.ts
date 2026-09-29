import type {
  MlvEditorImageUploader,
  MlvEditorImageUploadResult,
  MlvEditorUploadPlaceholderStorage,
} from '@malva-ui/editor';
import type { Editor } from '@tiptap/core';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';

/*
 * F-D13: an upload placeholder is a local widget decoration. A peer's
 * keystroke is a change-origin transaction that replaces the whole
 * document, and ProseMirror mapping drops every widget across it — so,
 * without tracking, any remote edit silently discarded every in-flight
 * upload. Placeholders follow tracked positions instead; one whose host
 * block a peer deleted settles through the "no placeholder" path.
 */

describe('Upload placeholders under collaboration (F-D13)', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  const CONTENT = '<p>Alpha</p><p>Bravo</p><p>Charlie</p>';

  /** The placeholders an editor currently renders. */
  const placeholders = (editor: Editor) =>
    (
      editor.storage as unknown as {
        mlvEditorUploadPlaceholder: MlvEditorUploadPlaceholderStorage;
      }
    ).mlvEditorUploadPlaceholder.placeholders;

  /** Position right after the text `after`, which must occur once. */
  const endOf = (editor: Editor, after: string): number => {
    let found = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === after) found = pos + after.length;
    });
    if (found < 0) throw new Error(`no text "${after}"`);
    return found;
  };

  /** The start position of the top-level block holding `text`. */
  const blockOf = (
    editor: Editor,
    text: string,
  ): { from: number; to: number } => {
    let range = { from: -1, to: -1 };
    editor.state.doc.forEach((node, offset) => {
      if (node.textContent === text)
        range = { from: offset, to: offset + node.nodeSize };
    });
    return range;
  };

  async function pair(uploader?: MlvEditorImageUploader) {
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      initialContent: CONTENT,
      ...(uploader ? { imageUploader: uploader } : {}),
    });
    const b = await rig.mount({
      transport: hub.endpoint(),
      initialContent: CONTENT,
    });
    await rig.sync(hub);
    return { hub, a, editorA: tiptap(a), editorB: tiptap(b) };
  }

  it('keeps a placeholder, at its place, across a peer keystroke', async () => {
    const { hub, editorA, editorB } = await pair();
    const at = endOf(editorA, 'Bravo');
    expect(
      editorA.commands.insertUploadPlaceholder({ id: 'u1', position: at }),
    ).toBe(true);

    // The peer types before the placeholder, in an earlier block.
    editorB.view.dispatch(editorB.state.tr.insertText('Oh ', 1));
    await rig.sync(hub);

    const [placeholder] = placeholders(editorA);
    expect(placeholder?.id).toBe('u1');
    expect(placeholder?.position).toBe(endOf(editorA, 'Bravo'));

    expect(
      editorA.commands.replaceUploadPlaceholder({
        id: 'u1',
        attributes: { src: 'https://images.example.com/u1.png' },
      }),
    ).toBe(true);
    await rig.sync(hub);
    // The image lands where the upload started, on both peers.
    const order = (editor: Editor): string[] => {
      const out: string[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'image') out.push('[image]');
        else if (node.isText) out.push(node.text ?? '');
      });
      return out;
    };
    expect(order(editorA)).toEqual(['Oh Alpha', 'Bravo', '[image]', 'Charlie']);
    expect(order(editorB)).toEqual(order(editorA));
    expect(placeholders(editorA)).toEqual([]);
  });

  it('keeps a placeholder across a remote insert right at its position', async () => {
    const { hub, editorA, editorB } = await pair();
    const at = endOf(editorA, 'Bravo');
    editorA.commands.insertUploadPlaceholder({ id: 'u1', position: at });
    editorB.view.dispatch(
      editorB.state.tr.insertText('!', endOf(editorB, 'Bravo')),
    );
    await rig.sync(hub);
    // Remote anchors associate to the left: the text lands after it.
    expect(placeholders(editorA).map((item) => item.position)).toEqual([at]);
  });

  it('drops a placeholder whose host block a peer deleted', async () => {
    const { hub, editorA, editorB } = await pair();
    editorA.commands.insertUploadPlaceholder({
      id: 'u1',
      position: endOf(editorA, 'Bravo'),
    });
    const { from, to } = blockOf(editorB, 'Bravo');
    editorB.view.dispatch(editorB.state.tr.delete(from, to));
    await rig.sync(hub);

    expect(placeholders(editorA)).toEqual([]);
    expect(
      editorA.commands.replaceUploadPlaceholder({
        id: 'u1',
        attributes: { src: 'https://images.example.com/u1.png' },
      }),
    ).toBe(false);
  });

  it('settles an upload whose placeholder a peer deleted as upload-result', async () => {
    let resolveUpload: (result: MlvEditorImageUploadResult) => void = () =>
      undefined;
    const uploader: MlvEditorImageUploader = {
      upload: () =>
        new Promise<MlvEditorImageUploadResult>((resolve) => {
          resolveUpload = resolve;
        }),
    };
    const { hub, a, editorA, editorB } = await pair(uploader);
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const ids = a.componentInstance
      .editor()
      .imageUpload.start([file], 'paste', {
        position: endOf(editorA, 'Bravo'),
      });
    expect(ids).toHaveLength(1);
    await rig.settle();
    expect(placeholders(editorA)).toHaveLength(1);

    const { from, to } = blockOf(editorB, 'Bravo');
    editorB.view.dispatch(editorB.state.tr.delete(from, to));
    await rig.sync(hub);
    expect(placeholders(editorA)).toEqual([]);

    resolveUpload({ src: 'https://images.example.com/photo.png' });
    await rig.settle();
    const codes = a.componentInstance.uploadFailures.map(
      (failure) => failure.error.code,
    );
    expect(codes).toEqual(['upload-result']);
    let images = 0;
    editorA.state.doc.descendants((node) => {
      if (node.type.name === 'image') images++;
    });
    expect(images).toBe(0);
  });

  it('keeps local mapping unchanged: a local edit before the placeholder moves it', async () => {
    const { editorA } = await pair();
    const at = endOf(editorA, 'Bravo');
    editorA.commands.insertUploadPlaceholder({ id: 'u1', position: at });
    editorA.view.dispatch(editorA.state.tr.insertText('12', 1));
    expect(placeholders(editorA).map((item) => item.position)).toEqual([
      at + 2,
    ]);
  });
});
