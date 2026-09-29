import { Editor, type Extensions, type JSONContent } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { AttrStep } from '@tiptap/pm/transform';
import { afterEach, describe, expect, it } from 'vitest';
import {
  mlvEditorDefaultExtensions,
  type MlvEditorDefaultExtensionOptions,
} from '../editor-extensions';
import type { MlvEditorBlockIdOptions } from './editor-block-id';

const editors: Editor[] = [];

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

/** Deterministic generator so specs can assert exact IDs. */
const sequentialIds = (): (() => string) => {
  let next = 0;
  return () => `id${++next}`;
};

const presetWith = (
  blockIds: Partial<MlvEditorBlockIdOptions> | boolean,
  extra: MlvEditorDefaultExtensionOptions = {},
): Extensions =>
  mlvEditorDefaultExtensions({
    ...extra,
    blockIds:
      typeof blockIds === 'boolean'
        ? blockIds
        : { generateId: sequentialIds(), ...blockIds },
  } as MlvEditorDefaultExtensionOptions);

const createEditor = (
  blockIds: Partial<MlvEditorBlockIdOptions> | boolean = {},
  extra: MlvEditorDefaultExtensionOptions = {},
): Editor => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: presetWith(blockIds, extra),
  });
  editors.push(editor);
  return editor;
};

/** Loads content the way `MlvEditor` does: one transaction, outside history. */
const load = (editor: Editor, content: string | JSONContent): void => {
  editor
    .chain()
    .setMeta('addToHistory', false)
    .setContent(content, { emitUpdate: false })
    .run();
};

/** `[label, blockId]` for every node carrying the attribute, in document order. */
const ids = (editor: Editor): Array<[string, string | null]> => {
  const out: Array<[string, string | null]> = [];
  editor.state.doc.descendants((node) => {
    if (node.type.spec.attrs && 'blockId' in node.type.spec.attrs) {
      out.push([
        node.isTextblock
          ? `${node.type.name}:${node.textContent}`
          : node.type.name,
        (node.attrs['blockId'] as string | null) ?? null,
      ]);
    }
    return !node.isTextblock;
  });
  return out;
};

/** Captures the appended transactions of every dispatch. */
const captureAppended = (editor: Editor): Transaction[][] => {
  const seen: Transaction[][] = [];
  editor.on('transaction', ({ appendedTransactions }) => {
    seen.push([...appendedTransactions]);
  });
  return seen;
};

describe('MlvEditorBlockId: opt-in and serialization', () => {
  it('leaves the default preset byte-identical when block IDs are off', () => {
    const plain = new Editor({ extensions: mlvEditorDefaultExtensions() });
    const off = new Editor({ extensions: presetWith(false) });
    editors.push(plain, off);
    const html = '<h2>Title</h2><p>Body</p><ul><li><p>Item</p></li></ul>';
    load(plain, html);
    load(off, html);
    expect(off.getHTML()).toBe(plain.getHTML());
    expect(off.getHTML()).not.toContain('data-block-id');
    expect(JSON.stringify(off.getJSON())).not.toContain('blockId');
    expect(
      Object.values(off.schema.nodes).some(
        (type) => type.spec.attrs && 'blockId' in type.spec.attrs,
      ),
    ).toBe(false);
  });

  it("resolves `'blocks'` to every block type except the doc and table internals", () => {
    const editor = createEditor();
    const configured = Object.values(editor.schema.nodes)
      .filter((type) => type.spec.attrs && 'blockId' in type.spec.attrs)
      .map((type) => type.name)
      .sort();
    expect(configured).toEqual([
      'blockquote',
      'bulletList',
      'codeBlock',
      'heading',
      'horizontalRule',
      'image',
      'listItem',
      'orderedList',
      'paragraph',
      'table',
      'taskItem',
      'taskList',
    ]);
  });

  it('honours an explicit type list', () => {
    const editor = createEditor({ types: ['heading'] });
    load(editor, '<h2>Title</h2><p>Body</p>');
    expect(ids(editor)).toEqual([['heading:Title', 'id1']]);
    expect(editor.getHTML()).toBe(
      '<h2 data-block-id="id1">Title</h2><p>Body</p>',
    );
  });

  it('assigns a missing ID to every configured block on load', () => {
    const editor = createEditor();
    load(
      editor,
      '<h2>Title</h2><p>Body</p><blockquote><p>Quote</p></blockquote>' +
        '<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>',
    );
    expect(ids(editor)).toEqual([
      ['heading:Title', 'id1'],
      ['paragraph:Body', 'id2'],
      ['blockquote', 'id3'],
      ['paragraph:Quote', 'id4'],
      ['table', 'id5'],
      ['paragraph:Cell', 'id6'],
      // StarterKit's trailingNode paragraph after the table.
      ['paragraph:', 'id7'],
    ]);
  });

  it('writes `data-block-id` into HTML and reads it back', () => {
    const editor = createEditor();
    load(editor, '<p data-block-id="keep">Body</p><p>New</p>');
    expect(editor.getHTML()).toBe(
      '<p data-block-id="keep">Body</p><p data-block-id="id1">New</p>',
    );
    const reloaded = createEditor();
    load(reloaded, editor.getHTML());
    expect(ids(reloaded)).toEqual([
      ['paragraph:Body', 'keep'],
      ['paragraph:New', 'id1'],
    ]);
  });

  it('round-trips `attrs.blockId` through JSON', () => {
    const editor = createEditor();
    load(
      editor,
      '<p data-block-id="a">One</p><h3>Two</h3><p data-block-id="t">Tail</p>',
    );
    const json = editor.getJSON();
    expect(json.content?.map((node) => node.attrs?.['blockId'])).toEqual([
      'a',
      'id1',
      't',
    ]);
    const reloaded = createEditor();
    load(reloaded, json);
    expect(ids(reloaded)).toEqual([
      ['paragraph:One', 'a'],
      ['heading:Two', 'id1'],
      ['paragraph:Tail', 't'],
    ]);
  });

  it('drops IDs from Markdown, aligned blocks included, and regenerates on load', () => {
    const editor = createEditor({}, { format: 'markdown' });
    load(
      editor,
      '<p data-block-id="a">Plain</p><p data-block-id="b" style="text-align: center">Centred</p>',
    );
    const markdown = editor.getMarkdown();
    expect(markdown).not.toContain('data-block-id');
    expect(markdown).toContain('text-align: center');
    const reloaded = createEditor({}, { format: 'markdown' });
    reloaded
      .chain()
      .setMeta('addToHistory', false)
      .setContent(markdown, { emitUpdate: false, contentType: 'markdown' })
      .run();
    expect(ids(reloaded)).toEqual([
      ['paragraph:Plain', 'id1'],
      ['paragraph:Centred', 'id2'],
    ]);
  });
});

describe('MlvEditorBlockId: duplicates', () => {
  it('gives a pasted copy a fresh ID and keeps the original', () => {
    const editor = createEditor();
    load(editor, '<p data-block-id="a">One</p><p data-block-id="b">Two</p>');
    editor.commands.insertContentAt(editor.state.doc.content.size, {
      type: 'paragraph',
      attrs: { blockId: 'a' },
      content: [{ type: 'text', text: 'Copy' }],
    });
    expect(ids(editor)).toEqual([
      ['paragraph:One', 'a'],
      ['paragraph:Two', 'b'],
      ['paragraph:Copy', 'id1'],
    ]);
  });

  it('keeps the ID of a block that was cut and pasted back', () => {
    const editor = createEditor();
    load(editor, '<p data-block-id="a">One</p><p data-block-id="b">Two</p>');
    const moved = editor.state.doc.firstChild?.toJSON() as JSONContent;
    editor.commands.deleteRange({ from: 0, to: 5 });
    editor.commands.insertContentAt(editor.state.doc.content.size, moved);
    expect(ids(editor)).toEqual([
      ['paragraph:Two', 'b'],
      ['paragraph:One', 'a'],
    ]);
  });

  it('keeps the first holder in document order when every holder changed', () => {
    const editor = createEditor();
    load(editor, '<p data-block-id="a">One</p>');
    editor.commands.insertContentAt(editor.state.doc.content.size, [
      {
        type: 'paragraph',
        attrs: { blockId: 'x' },
        content: [{ type: 'text', text: 'First' }],
      },
      {
        type: 'paragraph',
        attrs: { blockId: 'x' },
        content: [{ type: 'text', text: 'Second' }],
      },
    ]);
    expect(ids(editor)).toEqual([
      ['paragraph:One', 'a'],
      ['paragraph:First', 'x'],
      ['paragraph:Second', 'id1'],
    ]);
  });

  it('dedupes a loaded document by first-in-order', () => {
    const editor = createEditor();
    load(
      editor,
      '<p data-block-id="d">1</p><p data-block-id="d">2</p><p data-block-id="e">3</p>',
    );
    expect(ids(editor)).toEqual([
      ['paragraph:1', 'd'],
      ['paragraph:2', 'id1'],
      ['paragraph:3', 'e'],
    ]);
  });

  it('leaves untouched duplicates in place until a local edit reaches one holder', () => {
    const editor = createEditor({
      filterTransaction: (tr) => !tr.getMeta('remote'),
    });
    load(editor, '<p data-block-id="d">1</p><p data-block-id="e">3</p>');
    // A merge-born duplicate: a skipped (remote) transaction inserts a second `d`.
    const remote = editor.state.tr
      .insert(
        editor.state.doc.content.size,
        editor.schema.nodes['paragraph'].create(
          { blockId: 'd' },
          editor.schema.text('2'),
        ),
      )
      .setMeta('remote', true);
    editor.view.dispatch(remote);
    expect(ids(editor)).toEqual([
      ['paragraph:1', 'd'],
      ['paragraph:3', 'e'],
      ['paragraph:2', 'd'],
    ]);
    // A local edit elsewhere does not re-mint either holder.
    editor.chain().setTextSelection(5).insertContent('!').run();
    expect(ids(editor).map(([, id]) => id)).toEqual(['d', 'e', 'd']);
    // A local edit inside the second holder re-mints that holder only.
    editor
      .chain()
      .setTextSelection(editor.state.doc.content.size - 1)
      .insertContent('?')
      .run();
    expect(ids(editor)).toEqual([
      ['paragraph:1', 'd'],
      ['paragraph:3!', 'e'],
      ['paragraph:2?', 'id1'],
    ]);
  });
});

describe('MlvEditorBlockId: split, move and history', () => {
  it('keeps the ID on the upper half for Enter in the middle', () => {
    const editor = createEditor();
    load(editor, '<p data-block-id="a">hello</p>');
    editor.chain().setTextSelection(3).splitBlock().run();
    expect(ids(editor)).toEqual([
      ['paragraph:he', 'a'],
      ['paragraph:llo', 'id1'],
    ]);
  });

  it('keeps the ID on the upper half for Enter at the end', () => {
    const editor = createEditor();
    load(editor, '<p data-block-id="a">hello</p>');
    editor.chain().setTextSelection(6).splitBlock().run();
    expect(ids(editor)).toEqual([
      ['paragraph:hello', 'a'],
      ['paragraph:', 'id1'],
    ]);
  });

  it('keeps the ID on the upper half for Enter in an empty block', () => {
    const editor = createEditor();
    load(editor, '<p data-block-id="a"></p>');
    editor.chain().setTextSelection(1).splitBlock().run();
    expect(ids(editor)).toEqual([
      ['paragraph:', 'a'],
      ['paragraph:', 'id1'],
    ]);
  });

  it('moves the ID to the content half for Enter at the start of a non-empty block', () => {
    const editor = createEditor();
    load(editor, '<p data-block-id="a">hello</p>');
    editor.chain().setTextSelection(1).splitBlock().run();
    expect(ids(editor)).toEqual([
      ['paragraph:', 'id1'],
      ['paragraph:hello', 'a'],
    ]);
  });

  it('keeps a heading ID on the heading when Enter at its start inserts a paragraph above', () => {
    const editor = createEditor();
    load(
      editor,
      '<h2 data-block-id="h">Title</h2><p data-block-id="t">Tail</p>',
    );
    editor.chain().setTextSelection(1).splitBlock().run();
    expect(ids(editor)).toEqual([
      ['paragraph:', 'id1'],
      ['heading:Title', 'h'],
      ['paragraph:Tail', 't'],
    ]);
  });

  it('moves list-item and paragraph IDs to the content half for Enter at an item start', () => {
    const editor = createEditor();
    load(
      editor,
      '<ul data-block-id="u"><li data-block-id="l"><p data-block-id="p">item</p></li></ul>' +
        '<p data-block-id="t">Tail</p>',
    );
    editor.chain().setTextSelection(3).splitListItem('listItem').run();
    expect(ids(editor)).toEqual([
      ['bulletList', 'u'],
      ['listItem', 'id1'],
      ['paragraph:', 'id2'],
      ['listItem', 'l'],
      ['paragraph:item', 'p'],
      ['paragraph:Tail', 't'],
    ]);
  });

  it('keeps list-item and paragraph IDs upstairs for Enter mid-item', () => {
    const editor = createEditor();
    load(
      editor,
      '<ul data-block-id="u"><li data-block-id="l"><p data-block-id="p">item</p></li></ul>' +
        '<p data-block-id="t">Tail</p>',
    );
    editor.chain().setTextSelection(5).splitListItem('listItem').run();
    expect(ids(editor)).toEqual([
      ['bulletList', 'u'],
      ['listItem', 'l'],
      ['paragraph:it', 'p'],
      ['listItem', 'id1'],
      ['paragraph:em', 'id2'],
      ['paragraph:Tail', 't'],
    ]);
  });

  it('writes only AttrSteps and pins stored marks', () => {
    const editor = createEditor();
    load(editor, '<p data-block-id="a"><strong>ab</strong></p>');
    const appended = captureAppended(editor);
    editor.chain().setTextSelection(3).splitBlock().run();
    const steps = appended.flat().flatMap((tr) => tr.steps);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((step) => step instanceof AttrStep)).toBe(true);
    expect(editor.state.storedMarks?.map((mark) => mark.type.name)).toEqual([
      'bold',
    ]);
  });

  it('keeps IDs through a block move and appends nothing', () => {
    const editor = createEditor(
      {},
      { blockHandle: { enabled: () => true, announceMove: () => undefined } },
    );
    load(editor, '<p data-block-id="a">A</p><p data-block-id="b">B</p>');
    const appended = captureAppended(editor);
    editor.chain().setTextSelection(1).moveBlockDown().run();
    expect(ids(editor)).toEqual([
      ['paragraph:B', 'b'],
      ['paragraph:A', 'a'],
    ]);
    expect(appended.flat()).toEqual([]);
  });

  it('joins the root history event so one undo removes the edit and its IDs', () => {
    const editor = createEditor();
    load(editor, '<p data-block-id="a">hello</p>');
    editor.chain().setTextSelection(6).splitBlock().run();
    expect(ids(editor)).toEqual([
      ['paragraph:hello', 'a'],
      ['paragraph:', 'id1'],
    ]);
    editor.commands.undo();
    expect(ids(editor)).toEqual([['paragraph:hello', 'a']]);
    editor.commands.redo();
    expect(ids(editor)).toEqual([
      ['paragraph:hello', 'a'],
      ['paragraph:', 'id1'],
    ]);
    editor.commands.undo();
    expect(editor.can().undo()).toBe(false);
  });
});

describe('MlvEditorBlockId: deferral hooks', () => {
  it('skips a transaction `filterTransaction` rejects, root and appended alike', () => {
    const seen: Transaction[] = [];
    const editor = createEditor({
      filterTransaction: (tr) => {
        seen.push(tr);
        return !tr.getMeta('remote');
      },
    });
    load(editor, '<p data-block-id="a">One</p>');
    editor.view.dispatch(
      editor.state.tr
        .insert(
          editor.state.doc.content.size,
          editor.schema.nodes['paragraph'].create(
            null,
            editor.schema.text('Two'),
          ),
        )
        .setMeta('remote', true),
    );
    expect(ids(editor)).toEqual([
      ['paragraph:One', 'a'],
      ['paragraph:Two', null],
    ]);
    expect(seen.some((tr) => tr.getMeta('remote'))).toBe(true);
    // The next local edit fills the gap.
    editor.chain().setTextSelection(4).insertContent('!').run();
    expect(ids(editor)).toEqual([
      ['paragraph:One!', 'a'],
      ['paragraph:Two', 'id1'],
    ]);
  });

  it('with `assignOnCreate: false` assigns nothing until `ensureBlockIds()`', () => {
    const editor = createEditor({ assignOnCreate: false });
    load(
      editor,
      '<p>One</p><p data-block-id="z">Two</p><p data-block-id="z">Three</p>',
    );
    editor.chain().setTextSelection(4).insertContent('!').run();
    expect(ids(editor).map(([, id]) => id)).toEqual([null, 'z', 'z']);

    expect(editor.commands.ensureBlockIds()).toBe(true);
    expect(ids(editor)).toEqual([
      ['paragraph:One!', 'id1'],
      ['paragraph:Two', 'z'],
      ['paragraph:Three', 'id2'],
    ]);
    // Normalization is not an undoable user step.
    expect(editor.can().undo()).toBe(true);
    editor.commands.undo();
    expect(ids(editor).map(([, id]) => id)).toEqual(['id1', 'z', 'id2']);

    // Armed from here on: later edits assign as usual.
    editor.commands.insertContentAt(
      editor.state.doc.content.size,
      '<p>Four</p>',
    );
    expect(ids(editor).at(-1)).toEqual(['paragraph:Four', 'id3']);
  });

  it('`ensureBlockIds()` also repairs a document the plugin has seen', () => {
    const editor = createEditor({
      filterTransaction: (tr) => !tr.getMeta('remote'),
    });
    load(editor, '<p data-block-id="a">One</p>');
    editor.view.dispatch(
      editor.state.tr
        .insert(
          editor.state.doc.content.size,
          editor.schema.nodes['paragraph'].create(
            { blockId: 'a' },
            editor.schema.text('Two'),
          ),
        )
        .setMeta('remote', true),
    );
    editor.commands.ensureBlockIds();
    expect(ids(editor)).toEqual([
      ['paragraph:One', 'a'],
      ['paragraph:Two', 'id1'],
    ]);
  });

  it('assigns the initial document of a mounted editor on create', async () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: presetWith({}),
      content: '<p>One</p><p>Two</p>',
    });
    editors.push(editor);
    expect(ids(editor).map(([, id]) => id)).toEqual([null, null]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ids(editor).map(([, id]) => id)).toEqual(['id1', 'id2']);
    expect(editor.can().undo()).toBe(false);
  });

  it('assigns a block another plugin appends in reaction to the create pass', async () => {
    // The create pass is the document's first transaction, so StarterKit's
    // trailing-node plugin appends its paragraph after a closing heading onto
    // it; that paragraph is a new block like any other.
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: presetWith({}),
      content: '<p>One</p><h2>Two</h2>',
    });
    editors.push(editor);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ids(editor)).toEqual([
      ['paragraph:One', 'id1'],
      ['heading:Two', 'id2'],
      ['paragraph:', 'id3'],
    ]);
  });

  it('does not assign the initial document on create with `assignOnCreate: false`', async () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: presetWith({ assignOnCreate: false }),
      content: '<p>One</p>',
    });
    editors.push(editor);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ids(editor).map(([, id]) => id)).toEqual([null]);
  });

  it('uses 10-character `[0-9a-z]` IDs by default', () => {
    const editor = createEditor(true);
    load(editor, '<p>One</p><p>Two</p>');
    const [first, second] = ids(editor).map(([, id]) => id);
    expect(first).toMatch(/^[0-9a-z]{10}$/);
    expect(second).toMatch(/^[0-9a-z]{10}$/);
    expect(first).not.toBe(second);
  });
});

describe('MlvEditorBlockId: performance', () => {
  // The design budget is 1 ms per keystroke at 2,000 blocks; measured alone
  // it is ~0.15 ms. A wall-clock assertion is not stable under the full
  // parallel suite (1.67 ms median measured there), so the guard is
  // relative: the plugin must cost less than ProseMirror applying the same
  // keystroke, which slows down with it under load (~2x headroom alone).
  // A per-keystroke walk that went quadratic would blow the ratio.
  it('costs less per keystroke than applying the keystroke, at 2,000 blocks (median of 5)', () => {
    const editor = createEditor(true);
    const blocks = Array.from({ length: 2000 }, (_, index) =>
      index % 10 === 0
        ? `<h2>Heading ${index}</h2>`
        : `<p>Paragraph number ${index} with some text</p>`,
    ).join('');
    load(editor, blocks);
    const plugin = editor.state.plugins.find((candidate) =>
      String((candidate as unknown as { key: string }).key).startsWith(
        'mlvEditorBlockId',
      ),
    );
    const appendTransaction = plugin?.spec.appendTransaction;
    if (!plugin || !appendTransaction) {
      throw new Error('Expected the block-ID plugin to append transactions.');
    }
    const append = appendTransaction.bind(plugin);

    const appendSamples: number[] = [];
    const applySamples: number[] = [];
    for (let run = 0; run < 5; run++) {
      const iterations = 20;
      let appendTotal = 0;
      let applyTotal = 0;
      for (let keystroke = 0; keystroke < iterations; keystroke++) {
        const oldState = editor.state;
        // Inside the first paragraph (the heading before it spans 0–11).
        const tr = oldState.tr.insertText('x', 15 + (keystroke % 5));
        const applyStarted = performance.now();
        const newState = oldState.apply(tr);
        applyTotal += performance.now() - applyStarted;
        const started = performance.now();
        const appended = append([tr], oldState, newState);
        appendTotal += performance.now() - started;
        expect(appended).toBeFalsy();
      }
      appendSamples.push(appendTotal / iterations);
      applySamples.push(applyTotal / iterations);
    }
    const median = (samples: number[]) =>
      [...samples].sort((a, b) => a - b)[2] ?? Infinity;
    expect(median(appendSamples)).toBeLessThan(median(applySamples));
  });
});
