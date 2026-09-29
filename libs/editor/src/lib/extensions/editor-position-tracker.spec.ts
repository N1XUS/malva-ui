import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  MlvEditorPositionTracker,
  trackMlvEditorPosition,
} from './editor-position-tracker';

describe('MlvEditorPositionTracker without collaboration', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, MlvEditorPositionTracker],
      content: '<p>Hello world</p>',
    });
  });

  afterEach(() => editor.destroy());

  const insert = (pos: number, text: string): void =>
    editor.view.dispatch(editor.state.tr.insertText(text, pos));

  it('maps through local edits exactly as ProseMirror mapping does', () => {
    // Position 6 sits after "Hello".
    const tracked = trackMlvEditorPosition(editor, 6);
    insert(1, 'Oh ');
    expect(tracked.pos).toBe(9);
    insert(editor.state.doc.content.size - 1, '!');
    expect(tracked.pos).toBe(9);
    const tr = editor.state.tr.insertText('XY', 9);
    const expected = tr.mapping.mapResult(9, 1).pos;
    editor.view.dispatch(tr);
    expect(tracked.pos).toBe(expected);
    expect(editor.state.doc.textBetween(1, tracked.pos ?? 0)).toBe(
      'Oh HelloXY',
    );
  });

  it('keeps assoc semantics for an insertion exactly at the position', () => {
    const right = trackMlvEditorPosition(editor, 6, 1);
    const left = trackMlvEditorPosition(editor, 6, -1);
    insert(6, '!!');
    expect(right.pos).toBe(8);
    expect(left.pos).toBe(6);
  });

  it('turns null once the content around the position is deleted, and stops on release', () => {
    const lost = trackMlvEditorPosition(editor, 6);
    const released = trackMlvEditorPosition(editor, 6);
    released.release();
    editor.view.dispatch(editor.state.tr.delete(2, 10));
    expect(lost.pos).toBeNull();
    expect(released.pos).toBe(6);
  });
});
