import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { mlvEditorDefaultExtensions } from '../editor-extensions';

/** Editors created by one spec, destroyed after it. */
const editors: Editor[] = [];

const create = (content: string): Editor => {
  const editor = new Editor({
    content,
    extensions: mlvEditorDefaultExtensions(),
  });
  editors.push(editor);
  return editor;
};

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

describe('resetFormatting() (#514)', () => {
  it('removes every mark except link and keeps block type, alignment and line height', () => {
    const editor = create(
      '<h2 style="text-align: center; line-height: 2">' +
        '<a href="https://example.com"><strong><em>Link</em></strong></a>' +
        '<span style="color: #ff0000; font-family: Georgia; font-size: 18px">Styled</span>' +
        '<mark data-color="#ffff00">Marked</mark><sub>2</sub><code>c</code><u>u</u><s>s</s>' +
        '</h2><p><strong>tail</strong></p>',
    );
    editor.commands.selectAll();
    expect(editor.commands.resetFormatting()).toBe(true);

    expect(editor.getHTML()).toBe(
      '<h2 style="text-align: center; line-height: 2;">' +
        '<a href="https://example.com">Link</a>StyledMarked2cus</h2><p>tail</p>',
    );
  });

  it('only touches the selection', () => {
    const editor = create('<p><strong>one</strong> <strong>two</strong></p>');
    editor.commands.setTextSelection({ from: 1, to: 4 });
    editor.commands.resetFormatting();
    expect(editor.getHTML()).toBe('<p>one <strong>two</strong></p>');
  });

  it('clears stored marks at a bare caret, keeping a stored link', () => {
    const editor = create('<p>text</p>');
    const { schema } = editor;
    editor.view.dispatch(
      editor.state.tr
        .setSelection(TextSelection.create(editor.state.doc, 3))
        .setStoredMarks([
          schema.marks['bold'].create(),
          schema.marks['link'].create({ href: 'https://example.com' }),
          schema.marks['subscript'].create(),
        ]),
    );

    expect(editor.commands.resetFormatting()).toBe(true);
    expect(editor.state.storedMarks?.map(({ type }) => type.name)).toEqual([
      'link',
    ]);
  });

  it('clears the marks the caret would inherit when none are stored', () => {
    const editor = create('<p><strong>bold</strong></p>');
    editor.commands.setTextSelection(3);
    editor.commands.resetFormatting();
    editor.commands.insertContent('x');
    expect(editor.getHTML()).toBe(
      '<p><strong>bo</strong>x<strong>ld</strong></p>',
    );
  });
});
