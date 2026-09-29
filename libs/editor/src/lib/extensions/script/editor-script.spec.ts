import { Editor, getExtensionField, type AnyExtension } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mlvEditorDefaultExtensions } from '../editor-extensions';

/** Editors created by one spec, destroyed after it. */
const editors: Editor[] = [];

const create = (
  content?: string,
  format: 'html' | 'markdown' = 'html',
): Editor => {
  const editor = new Editor({
    ...(content === undefined ? {} : { content }),
    extensions: mlvEditorDefaultExtensions({ format }),
  });
  editors.push(editor);
  return editor;
};

/** Mark names on the first text node of the first block. */
const markNames = (editor: Editor): string[] =>
  (editor.getJSON().content?.[0]?.content?.[0]?.marks ?? []).map(
    ({ type }) => type,
  );

/** Presses a key chord through ProseMirror's own keydown dispatch. */
const press = (editor: Editor, key: string): boolean => {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: true,
    metaKey: false,
    bubbles: true,
    cancelable: true,
  });
  return (
    editor.view.someProp('handleKeyDown', (handler) =>
      handler(editor.view, event),
    ) === true
  );
};

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  vi.restoreAllMocks();
});

describe('MlvEditorSubscript / MlvEditorSuperscript (#514)', () => {
  it('parses and renders <sub> and <sup>', () => {
    const editor = create('<p><sub>2</sub><sup>n</sup></p>');
    expect(editor.getHTML()).toBe('<p><sub>2</sub><sup>n</sup></p>');
    expect(editor.getJSON().content?.[0]?.content).toEqual([
      { type: 'text', text: '2', marks: [{ type: 'subscript' }] },
      { type: 'text', text: 'n', marks: [{ type: 'superscript' }] },
    ]);
  });

  it('parses Docs-style vertical-align spans', () => {
    const editor = create(
      '<p><span style="vertical-align: sub">low</span><span style="vertical-align: super">high</span></p>',
    );
    expect(editor.getHTML()).toBe('<p><sub>low</sub><sup>high</sup></p>');
  });

  it('toggles, sets and unsets, each excluding the other', () => {
    const editor = create('<p>x</p>');
    editor.commands.selectAll();

    editor.commands.toggleSubscript();
    expect(markNames(editor)).toEqual(['subscript']);
    // The excluded mark must not block the other: Tiptap's `setMark` reports
    // failure over a mark that excludes it, which would disable the toolbar
    // button and leave the shortcut unhandled.
    expect(editor.can().toggleSuperscript()).toBe(true);
    expect(editor.can().setSuperscript()).toBe(true);
    expect(editor.commands.toggleSuperscript()).toBe(true);
    expect(markNames(editor)).toEqual(['superscript']);
    expect(editor.can().toggleSubscript()).toBe(true);
    editor.commands.setSubscript();
    expect(markNames(editor)).toEqual(['subscript']);
    editor.commands.unsetSubscript();
    expect(markNames(editor)).toEqual([]);
    editor.commands.setSuperscript();
    editor.commands.unsetSuperscript();
    expect(markNames(editor)).toEqual([]);
  });

  it('is unavailable inside inline code, which excludes every mark', () => {
    const editor = create('<p><code>code</code></p>');
    editor.commands.selectAll();
    expect(editor.can().toggleSubscript()).toBe(false);
    expect(editor.can().setSuperscript()).toBe(false);
  });

  it('swaps the stored mark at a bare caret', () => {
    const editor = create('<p>x</p>');
    editor.commands.setTextSelection(2);
    editor.commands.toggleSubscript();
    expect(editor.state.storedMarks?.map(({ type }) => type.name)).toEqual([
      'subscript',
    ]);
    expect(editor.commands.toggleSuperscript()).toBe(true);
    expect(editor.state.storedMarks?.map(({ type }) => type.name)).toEqual([
      'superscript',
    ]);
  });

  it('binds Mod-, and Mod-. with no other extension claiming either chord', () => {
    const editor = create('<p>x</p>');
    const owners = new Map<string, string[]>();
    for (const extension of editor.extensionManager.extensions) {
      const shortcuts = getExtensionField<() => Record<string, unknown>>(
        extension as AnyExtension,
        'addKeyboardShortcuts',
        {
          name: extension.name,
          options: extension.options,
          storage: extension.storage,
          editor,
          type: null,
        },
      );
      for (const chord of Object.keys(shortcuts?.() ?? {})) {
        owners.set(chord, [...(owners.get(chord) ?? []), extension.name]);
      }
    }
    expect(owners.get('Mod-,')).toEqual(['subscript']);
    expect(owners.get('Mod-.')).toEqual(['superscript']);

    editor.commands.selectAll();
    expect(press(editor, ',')).toBe(true);
    expect(markNames(editor)).toEqual(['subscript']);
    expect(press(editor, '.')).toBe(true);
    expect(markNames(editor)).toEqual(['superscript']);
  });

  it('round-trips both marks through Markdown as inline HTML', () => {
    const editor = create(
      '<p>H<sub>2</sub>O and x<sup>2</sup></p>',
      'markdown',
    );
    const markdown = editor.getMarkdown();
    expect(markdown).toBe('H<sub>2</sub>O and x<sup>2</sup>');

    const reparsed = create(undefined, 'markdown');
    reparsed.commands.setContent(markdown, {
      contentType: 'markdown',
      errorOnInvalidContent: true,
    });
    expect(reparsed.getJSON()).toEqual(editor.getJSON());
  });

  it('loads HTML with <sub> / <sup> under enableContentCheck without a content error', () => {
    const onContentError = vi.fn();
    const editor = new Editor({
      content: '<p>H<sub>2</sub>O</p>',
      enableContentCheck: true,
      onContentError,
      extensions: mlvEditorDefaultExtensions(),
    });
    editors.push(editor);
    expect(onContentError).not.toHaveBeenCalled();
    expect(editor.getHTML()).toBe('<p>H<sub>2</sub>O</p>');
  });
});
