import type { Editor } from '@tiptap/core';
// The tracker is internal to the primary entry; specs may reach it directly.
import { trackMlvEditorPosition } from '../../../src/lib/extensions/editor-position-tracker';
import {
  CollaborationRig,
  configureCollaborationTestBed,
  tiptap,
} from './testing/collaboration-harness';

/*
 * D-F8: a tracked position is lost on a remote edit exactly when the same
 * edit applied locally loses it. The local path is ProseMirror's
 * `mapResult(pos, -1).deleted` (the token on the left of the position was
 * removed); the remote path resolves the Yjs anchor, which y-tiptap always
 * creates left-associated.
 */

const CONTENT =
  '<p>Alpha beta</p><ul><li><p>Gamma</p></li><li><p>Delta</p></li></ul><p>Omega</p><p>Sigma</p>';

/** The position where `text` starts. Throws when it is not in the document. */
function textStart(editor: Editor, text: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0 || !node.isText) return found < 0;
    const index = node.text?.indexOf(text) ?? -1;
    if (index >= 0) found = pos + index;
    return false;
  });
  if (found < 0) throw new Error(`"${text}" is not in the document`);
  return found;
}

/** Deletes the ancestor at `depth` of `pos`. */
function deleteAncestor(editor: Editor, pos: number, depth: number): void {
  const $pos = editor.state.doc.resolve(pos);
  editor.view.dispatch(
    editor.state.tr.delete($pos.before(depth), $pos.after(depth)),
  );
}

interface ParityRow {
  readonly name: string;
  /** Where the tracked position sits. */
  readonly anchor: (editor: Editor) => number;
  /** The edit, applied either by the tracking editor or by its peer. */
  readonly edit: (editor: Editor, anchor: number) => void;
}

const afterAlpha = (editor: Editor): number =>
  textStart(editor, 'Alpha') + 'Alpha'.length;
const del = (editor: Editor, from: number, to: number): void =>
  editor.view.dispatch(editor.state.tr.delete(from, to));
const insert = (editor: Editor, pos: number, text: string): void =>
  editor.view.dispatch(editor.state.tr.insertText(text, pos));

/** Rows where the local and the remote path must agree. */
const ROWS: readonly ParityRow[] = [
  {
    name: 'delete the left character',
    anchor: afterAlpha,
    edit: (e, a) => del(e, a - 1, a),
  },
  {
    name: 'delete a range containing the anchor',
    anchor: afterAlpha,
    edit: (e, a) => del(e, a - 2, a + 2),
  },
  {
    name: 'delete the right character',
    anchor: afterAlpha,
    edit: (e, a) => del(e, a, a + 1),
  },
  {
    name: 'insert at the anchor',
    anchor: afterAlpha,
    edit: (e, a) => insert(e, a, 'XY'),
  },
  {
    name: 'delete the host block',
    anchor: afterAlpha,
    edit: (e, a) => deleteAncestor(e, a, 1),
  },
  {
    name: 'delete an ancestor list item',
    anchor: (e) => textStart(e, 'Gamma') + 3,
    edit: (e, a) => deleteAncestor(e, a, 2),
  },
  {
    name: 'anchor at the start of a block: insert there',
    anchor: (e) => textStart(e, 'Omega'),
    edit: (e, a) => insert(e, a, 'XY'),
  },
  {
    name: 'anchor at the start of a block: delete the block',
    anchor: (e) => textStart(e, 'Omega'),
    edit: (e, a) => deleteAncestor(e, a, 1),
  },
  {
    name: 'anchor at the start of a block: join it into the previous block',
    anchor: (e) => textStart(e, 'Sigma'),
    edit: (e, a) =>
      e.view.dispatch(e.state.tr.join(e.state.doc.resolve(a).before(1))),
  },
  {
    name: 'anchor between blocks: delete the next block',
    anchor: (e) => e.state.doc.resolve(afterAlpha(e)).after(1),
    edit: (e, a) => del(e, a, e.state.doc.resolve(a + 1).after(1)),
  },
];

describe('MlvEditorPositionTracker — local / remote loss parity (D-F8)', () => {
  let rig: CollaborationRig;

  beforeEach(async () => {
    await configureCollaborationTestBed();
    rig = new CollaborationRig();
  });

  afterEach(() => rig.destroy());

  async function pair() {
    const hub = rig.hub('server');
    const a = await rig.mount({
      transport: hub.endpoint(),
      initialContent: CONTENT,
    });
    const b = await rig.mount({
      transport: hub.endpoint(),
      initialContent: CONTENT,
    });
    await rig.sync(hub);
    return { hub, editorA: tiptap(a), editorB: tiptap(b) };
  }

  /** The tracked position after the tracking editor applies the edit itself. */
  async function local(row: ParityRow): Promise<number | null> {
    const { editorA } = await pair();
    const anchor = row.anchor(editorA);
    const tracked = trackMlvEditorPosition(editorA, anchor, -1);
    row.edit(editorA, anchor);
    return tracked.pos;
  }

  /** The tracked position after the peer applies the same edit. */
  async function remote(row: ParityRow): Promise<number | null> {
    const { hub, editorA, editorB } = await pair();
    const anchor = row.anchor(editorA);
    expect(row.anchor(editorB)).toBe(anchor);
    const tracked = trackMlvEditorPosition(editorA, anchor, -1);
    row.edit(editorB, anchor);
    await rig.sync(hub);
    expect(editorA.getText()).toBe(editorB.getText());
    return tracked.pos;
  }

  it.each(ROWS.map((row) => [row.name, row] as const))(
    '%s',
    async (_name, row) => {
      const expected = await local(row);
      expect(await remote(row)).toBe(expected);
    },
  );

  // Measured edges where the two paths cannot agree, pinned so a change in
  // y-tiptap (or in how anchors are created) is visible. Reported as
  // deviations from D-F8.
  it('pins the edges where parity is out of reach', async () => {
    const rows: readonly ParityRow[] = [
      {
        // y-tiptap anchors a block boundary on the block to its RIGHT
        // (`assoc` 0): deleting the block on its left removes the local left
        // token, while the remote anchor's own block is untouched.
        name: 'between blocks: delete the previous block',
        anchor: (e) => e.state.doc.resolve(afterAlpha(e)).after(1),
        edit: (e, a) => del(e, 0, a),
      },
      {
        // ProseMirror keeps the content through `setBlockType`; y-prosemirror
        // replaces the element, so the text the anchor names is deleted in Yjs.
        name: 'change the host block type',
        anchor: afterAlpha,
        edit: (e, a) => {
          const $a = e.state.doc.resolve(a);
          e.view.dispatch(
            e.state.tr.setBlockType(
              $a.before(1),
              $a.after(1),
              e.schema.nodes['heading'],
              { level: 2 },
            ),
          );
        },
      },
      {
        // Both sides delete and re-create a moved block: agreed.
        name: 'move the host block to the end',
        anchor: afterAlpha,
        edit: (e, a) => {
          const $a = e.state.doc.resolve(a);
          const node = $a.node(1);
          e.view.dispatch(
            e.state.tr
              .insert(e.state.doc.content.size, node.copy(node.content))
              .delete($a.before(1), $a.after(1)),
          );
        },
      },
    ];
    const results: string[] = [];
    for (const row of rows)
      results.push(
        `${row.name}: local=${await local(row)} remote=${await remote(row)}`,
      );
    expect(results).toEqual([
      'between blocks: delete the previous block: local=null remote=0',
      'change the host block type: local=6 remote=null',
      'move the host block to the end: local=null remote=null',
    ]);
  });

  it('pins which rows lose the position', async () => {
    const lost: string[] = [];
    for (const row of ROWS)
      if ((await local(row)) === null) lost.push(row.name);
    expect(lost).toEqual([
      'delete the left character',
      'delete a range containing the anchor',
      'delete the host block',
      'delete an ancestor list item',
      'anchor at the start of a block: delete the block',
      'anchor at the start of a block: join it into the previous block',
    ]);
  });
});
