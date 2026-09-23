import {
  Editor,
  Extension,
  getExtensionField,
  mergeAttributes,
  Node,
  type MarkdownTokenizer,
} from '@tiptap/core';
import type { Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { mlvEditorDefaultExtensions } from './editor-extensions';

/*
 * Behaviour the default preset inherits from Tiptap and ProseMirror, pinned at
 * the version the workspace resolves (Tiptap 3.31.3, prosemirror-view 1.42.5,
 * one prosemirror-model 1.25.12).
 *
 * #291 raised every `@tiptap/*` peer from 3.29 to 3.31 and added the
 * `prosemirror-view` ^1.42.5 / `prosemirror-model` ^1.25.12 floor peers, for
 * three security advisories. Each case below is something that changed between
 * Tiptap 3.29.2 (prosemirror-view 1.42.2) and 3.31.3 (prosemirror-view 1.42.5)
 * and reaches an editor built from `mlvEditorDefaultExtensions()`, and each was
 * run against 3.29.2 before the bump and failed there — except the guards that
 * hold on both versions and say so in their names (the Markdown tokenizer
 * allowlist, once per format, and Tab falling through outside a list). When a
 * later upgrade moves one, the failure
 * is the prompt to read that release's changelog and write the migration note
 * — not to edit the expectation until it passes. See
 * docs/migrations/2026-09-editor-tiptap-3-31.md.
 */

/** Editors created by a test, destroyed after it. */
const editors: Editor[] = [];

/** DOM hosts a test appended to `document.body`, removed after it. */
const hosts: HTMLElement[] = [];

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  hosts.splice(0).forEach((host) => host.remove());
});

/**
 * Mounts an editor on the default preset into a live element, for cases that
 * read node-view DOM. The element is removed in `afterEach` whether or not the
 * test passed, so a failing case cannot leak a node view into later ones.
 */
function mountEditor(content: string): {
  editor: Editor;
  element: HTMLElement;
} {
  const element = document.createElement('div');
  document.body.appendChild(element);
  hosts.push(element);
  const editor = new Editor({
    element,
    content,
    extensions: mlvEditorDefaultExtensions(),
  });
  editors.push(editor);
  return { editor, element };
}

/** Mounts a headless editor on the default preset, as `MlvEditor` would build it. */
function createEditor(
  content: string,
  format: 'html' | 'markdown' = 'html',
  extra: ReturnType<typeof mlvEditorDefaultExtensions> = [],
): Editor {
  const editor = new Editor({
    content,
    extensions: [...mlvEditorDefaultExtensions({ format }), ...extra],
  });
  editors.push(editor);
  return editor;
}

/** Document position of the first occurrence of `text`. */
function positionOf(editor: Editor, text: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.isText && node.text?.includes(text)) {
      found = pos + node.text.indexOf(text);
      return false;
    }
    return true;
  });
  if (found < 0) throw new Error(`"${text}" is not in the document.`);
  return found;
}

/**
 * Runs the editor's keymaps for one key, the way ProseMirror's own keydown
 * listener does, and reports whether a keymap consumed it. A key no keymap
 * handles falls through to the browser — for Tab, that moves focus on.
 */
function pressKey(editor: Editor, key: string): boolean {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  return (
    editor.view.someProp('handleKeyDown', (handler) =>
      handler(editor.view, event),
    ) ?? false
  );
}

/** Node type names from the selection head up to (not including) the doc. */
function selectionAncestors(editor: Editor): string[] {
  const { $from } = editor.state.selection;
  const names: string[] = [];
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    names.push($from.node(depth).type.name);
  }
  return names;
}

// The published floors (`@tiptap/core` ^3.31.0, `prosemirror-view` ^1.42.5,
// `prosemirror-model` ^1.25.12) admit only releases carrying these fixes; the
// cases run against the versions the workspace resolves. The view floor is
// 1.42.5, not the advisory’s 1.42.3: 1.42.3 and 1.42.4 call `create()` outside
// their paste `try`, and model 1.25.12 validates inside `create()`, so that
// pairing throws out of the paste handler instead of dropping the wrapper. A second, older
// `prosemirror-model` copy in a consumer's tree still disables the c8x8 case,
// which no peer range can prevent.
describe('security fixes the published peer floors require (#291)', () => {
  it('keeps an own __proto__ key from re-parenting the object mergeAttributes returns (GHSA-cp6q-959q-f8rh)', () => {
    // Every Tiptap `renderHTML` in the preset funnels its attribute objects
    // through `mergeAttributes`, and ProseMirror's DOM serializer enumerates
    // the result with `for…in` — inherited keys included. Before 3.30.4 an own
    // `__proto__` key from parsed JSON invoked the legacy prototype setter, so
    // `onerror` arrived as an inherited, invisible, executable attribute.
    const untrusted = JSON.parse(
      '{"__proto__": {"onerror": "alert(1)", "src": "x-invalid:"}}',
    ) as Record<string, unknown>;

    const merged = mergeAttributes({ class: 'mlv-probe' }, untrusted);

    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect('onerror' in merged).toBe(false);
    expect('src' in merged).toBe(false);
    expect(merged['class']).toBe('mlv-probe');
  });

  it('validates the attributes a pasted slice context supplies (GHSA-c8x8-7fp4-3x9w)', () => {
    // prosemirror-view rebuilds the pasted slice's wrapping nodes from the
    // clipboard's `data-pm-slice` JSON. Before 1.42.3 it built them with
    // whatever attributes that JSON named, skipping the schema's validators.
    // No attribute in Malva's default preset declares a validator, so the fix
    // bites on a consumer extension that does — this node stands in for one.
    const Frame = Node.create({
      name: 'mlvProbeFrame',
      group: 'block',
      content: 'block+',
      addAttributes() {
        return {
          tone: {
            default: 'neutral',
            validate: (value: unknown) => {
              if (value !== 'neutral' && value !== 'info') {
                throw new RangeError(`Rejected tone ${String(value)}`);
              }
            },
          },
        };
      },
      parseHTML: () => [{ tag: 'div[data-mlv-probe-frame]' }],
      renderHTML: ({ HTMLAttributes }) => [
        'div',
        mergeAttributes(HTMLAttributes, { 'data-mlv-probe-frame': '' }),
        0,
      ],
    });
    const pasted: Slice[] = [];
    const Capture = Extension.create({
      name: 'mlvProbePasteCapture',
      addProseMirrorPlugins: () => [
        new Plugin({
          key: new PluginKey('mlvProbePasteCapture'),
          props: {
            transformPasted: (slice) => {
              pasted.push(slice);
              return slice;
            },
          },
        }),
      ],
    });
    const editor = createEditor('<p>target</p>', 'html', [Frame, Capture]);
    const paste = (tone: string) =>
      editor.view.pasteHTML(
        `<p data-pm-slice='1 1 ["mlvProbeFrame",{"tone":"${tone}"}]'>pasted</p>`,
        // jsdom has no ClipboardEvent; every paste handler in the preset reads
        // `clipboardData` defensively, and there is none here.
        new Event('paste') as ClipboardEvent,
      );

    paste('info');
    paste('javascript:alert(1)');

    // The accepted value proves the context path is live, so the rejected one
    // is not passing vacuously.
    expect(pasted[0]?.content.firstChild?.type.name).toBe('mlvProbeFrame');
    expect(pasted[0]?.content.firstChild?.attrs['tone']).toBe('info');
    expect(pasted[1]?.content.firstChild?.type.name).toBe('paragraph');
  });

  it.each(['markdown', 'html'] as const)(
    'registers only the audited Markdown tokenizers in the %s preset (GHSA-j95f-988m-3j2f guard)',
    (format) => {
      // The quadratic parsers sit behind `createBlockMarkdownSpec`,
      // `createAtomBlockMarkdownSpec` and `createInlineMarkdownSpec`, and a
      // tokenizer built from one matches only its own node name
      // (`^:::${name}`, `[${name} …]`). So no payload can prove the preset
      // unreachable. What can: the preset registers exactly these five
      // tokenizers, and none of them comes from those helpers. Every
      // tokenizer is keyed by extension and tokenizer name, so an added or
      // replaced tokenizer-bearing extension fails here and has to be checked
      // against the advisory before this list grows.
      const editor = createEditor('', format);

      const tokenizers = editor.extensionManager.extensions.flatMap(
        (extension) => {
          const tokenizer = getExtensionField<MarkdownTokenizer | undefined>(
            extension,
            'markdownTokenizer',
          );
          return tokenizer ? [`${extension.name}:${tokenizer.name}`] : [];
        },
      );

      expect(tokenizers.sort()).toEqual([
        'highlight:highlight',
        'orderedList:orderedList',
        'table:table',
        'taskList:taskList',
        'underline:underline',
      ]);
    },
  );
});

describe('editing behaviour inherited from Tiptap 3.31', () => {
  it.each([
    [
      'blockquote',
      '<blockquote><p><span style="color: #ff0000">red</span> and <span style="color: #0000ff">blue</span></p></blockquote>',
    ],
    [
      'bullet list',
      '<ul><li><p><span style="color: #ff0000">red</span> and <span style="color: #0000ff">blue</span></p></li></ul>',
    ],
    [
      'table cell',
      '<table><tbody><tr><td><p><span style="color: #ff0000">red</span> and <span style="color: #0000ff">blue</span></p></td></tr></tbody></table>',
    ],
  ])(
    'keeps the colour of text outside the selection when unsetting colour inside a %s (3.30.3)',
    (_container, html) => {
      // `unsetColor` ends in `removeEmptyTextStyle`, which used to skip only
      // textblocks: a blockquote, list item or table cell fell through to the
      // mark check and had `removeMark` applied across its whole range, so the
      // toolbar's "remove colour" on one word cleared every colour in the
      // container.
      const editor = createEditor(html);
      const from = positionOf(editor, 'red');

      editor
        .chain()
        .setTextSelection({ from, to: from + 3 })
        .unsetColor()
        .run();

      const result = editor.getHTML();
      expect(result).not.toContain('rgb(255, 0, 0)');
      expect(result).toContain(
        '<span style="color: rgb(0, 0, 255);">blue</span>',
      );
    },
  );

  it.each([
    ['bullet list', '<ul><li><p>item</p></li></ul><p>after</p>', 'listItem'],
    ['ordered list', '<ol><li><p>item</p></li></ol><p>after</p>', 'listItem'],
    [
      'task list',
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>item</p></li></ul><p>after</p>',
      'taskItem',
    ],
  ])(
    'consumes Tab at the start of a paragraph after a %s, sinking it into the last item (3.30.0)',
    (_list, html, itemType) => {
      // A keyboard change inside the content textbox: this one position no
      // longer lets Tab move focus out of the editor. Everywhere else Tab still
      // falls through (see the next case).
      const editor = createEditor(html);
      editor.commands.setTextSelection(positionOf(editor, 'after'));

      expect(pressKey(editor, 'Tab')).toBe(true);
      expect(selectionAncestors(editor)).toEqual(
        expect.arrayContaining(['paragraph', itemType]),
      );
      expect(editor.state.doc.childCount).toBe(2); // the list + trailing node
    },
  );

  it('still lets Tab fall through where no list precedes the caret', () => {
    const editor = createEditor('<p>before</p><p>after</p>');
    editor.commands.setTextSelection(positionOf(editor, 'after'));

    expect(pressKey(editor, 'Tab')).toBe(false);

    editor.commands.setTextSelection(positionOf(editor, 'fter'));
    expect(pressKey(editor, 'Tab')).toBe(false);
  });

  it('joins, rather than lifts, on Backspace at the start of a list item’s second paragraph (3.30.0)', () => {
    // 3.29 lifted the whole item out of its list from any child's start; the
    // list keymap now intercepts only at the start of the item's first child.
    const editor = createEditor('<ul><li><p>first</p><p>second</p></li></ul>');
    editor.commands.setTextSelection(positionOf(editor, 'second'));

    expect(pressKey(editor, 'Backspace')).toBe(true);
    expect(editor.getHTML()).toContain('<ul><li><p>firstsecond</p></li></ul>');
  });

  it('places the caret after the merged text when Backspace merges a paragraph into a blockquote (3.30.0)', () => {
    // Deliberate upstream: the fix for Backspace freezing after this merge
    // (tiptap 4ec64c7cb, #7984) sets the selection to `targetPos +
    // content.size`, and its e2e "backspace after merge" expects `AB` →
    // Backspace → `A`. 3.29 left the caret at the join point. If upstream
    // moves it again, this fails and the migration note changes.
    const editor = createEditor(
      '<blockquote><p>Alpha</p></blockquote><p>Beta</p>',
    );
    editor.commands.setTextSelection(positionOf(editor, 'Beta'));

    expect(pressKey(editor, 'Backspace')).toBe(true);

    expect(editor.getHTML()).toContain(
      '<blockquote><p>AlphaBeta</p></blockquote>',
    );
    const { $from } = editor.state.selection;
    expect($from.parent.textContent).toBe('AlphaBeta');
    expect($from.parentOffset).toBe('AlphaBeta'.length);
  });

  it.each([
    [
      'deleteRow',
      '<table><tbody><tr><th><p>h</p></th></tr><tr><td><p>target</p></td></tr></tbody></table><p>below</p>',
    ],
    [
      'deleteColumn',
      '<table><tbody><tr><th><p>h1</p></th><th><p>h2</p></th></tr><tr><td><p>a</p></td><td><p>target</p></td></tr></tbody></table><p>below</p>',
    ],
  ] as const)(
    'keeps the selection inside the table after %s removes the last one (3.30.0)',
    (command, html) => {
      // Both the toolbar table menu and the in-canvas grips run these
      // commands; 3.29 left the caret in the paragraph below the table.
      const editor = createEditor(html);
      editor.commands.setTextSelection(positionOf(editor, 'target'));

      expect(editor.commands[command]()).toBe(true);

      expect(selectionAncestors(editor)).toContain('table');
    },
  );

  it('reveals a resizable image whose source fails to load (3.30.2)', () => {
    // The resize node view starts hidden and waited for `load` alone, so a
    // broken or already-cached source left an invisible, unclickable node.
    const { element } = mountEditor(
      '<p><img src="https://example.invalid/missing.png"></p>',
    );
    const image = element.querySelector('img');
    const container = image?.closest<HTMLElement>('[data-resize-container]');
    if (!image || !container) {
      throw new Error('Expected a resizable image node view.');
    }
    expect(container.style.visibility).toBe('hidden');

    image.dispatchEvent(new Event('error'));

    expect(container.style.visibility).toBe('');
    expect(container.style.pointerEvents).toBe('');
  });

  it('names a task item checkbox by attribute and by its label text (3.30.0)', () => {
    // 3.29 assigned the name through the `ariaLabel` IDL property only, which
    // does not reflect in every engine; the label element around the checkbox
    // was empty. The label text is visually hidden by an inline style, so the
    // editor stylesheet has nothing to hide — every declaration that does the
    // hiding is asserted, because the label is `inline-flex` in Malva's
    // stylesheet and would show the text if any one of them were dropped.
    const { element } = mountEditor(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Buy milk</p></li></ul>',
    );
    const checkbox = element.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    const labelText = checkbox?.closest('label')?.querySelector('span');

    expect(checkbox?.getAttribute('aria-label')).toBe(
      'Task item checkbox for Buy milk',
    );
    expect(labelText?.textContent).toBe('Task item checkbox for Buy milk');
    expect({
      position: labelText?.style.position,
      width: labelText?.style.width,
      height: labelText?.style.height,
      overflow: labelText?.style.overflow,
      clip: labelText?.style.clip,
      whiteSpace: labelText?.style.whiteSpace,
    }).toEqual({
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: expect.stringMatching(
        /^rect\(0(px)?,\s*0(px)?,\s*0(px)?,\s*0(px)?\)$/,
      ),
      whiteSpace: 'nowrap',
    });
  });
});

describe('Markdown behaviour inherited from Tiptap 3.31', () => {
  it('indents a nested block under an ordered item to the marker width (3.30.6)', () => {
    // `1. ` is three columns wide; 3.29 indented its nested blocks by the
    // configured two spaces, which other CommonMark readers attach to the
    // wrong parent. Bullet items keep two spaces.
    const editor = createEditor(
      '<ol><li><p>one</p><ul><li><p>nested</p></li></ul></li><li><p>two</p><p>more</p></li></ol><ul><li><p>dot</p><ul><li><p>deep</p></li></ul></li></ul>',
      'markdown',
    );

    const markdown = editor.getMarkdown();

    expect(markdown).toContain('1. one\n   - nested\n2. two\n\n   more');
    expect(markdown).toContain('- dot\n  - deep');
  });

  it('serializes whitespace-only marked text without empty delimiters (3.30.6)', () => {
    const editor = createEditor(
      '<p>a<strong> </strong>b</p><p>c<em> </em>d<strong>e</strong></p>',
      'markdown',
    );

    // 3.29 wrote `a**** b` and `c** d**e**`.
    expect(editor.getMarkdown()).toBe('a b\n\nc d**e**');
  });

  it('loads Markdown with an unclosed inline HTML tag, dropping the tag (3.30.0)', () => {
    // The options `MlvEditor` applies to every Markdown value. 3.29 built an
    // invalid document from `<b>` and threw "Invalid JSON content", which the
    // shell reports as a recoverable `parse` error and reverts.
    const editor = createEditor('', 'markdown');

    editor.commands.setContent('Hello <b>world', {
      emitUpdate: false,
      errorOnInvalidContent: true,
      contentType: 'markdown',
    });

    expect(editor.getText()).toBe('Hello world');
    expect(editor.getHTML()).not.toContain('<strong>');
  });

  it('ends an ordered list item at a `$$` line (3.30.0)', () => {
    // No math extension ships in the preset, so the block lands as a plain
    // paragraph after the list; 3.29 folded it into the item's text.
    const editor = createEditor('', 'markdown');

    editor.commands.setContent('1. item\n$$\nx\n$$', {
      contentType: 'markdown',
      errorOnInvalidContent: true,
    });

    const [list, after] = editor.getJSON().content ?? [];
    expect(list?.type).toBe('orderedList');
    expect(editor.state.doc.child(0).textContent).toBe('item');
    expect(after?.type).toBe('paragraph');
    expect(editor.state.doc.child(1).textContent).toBe('$$\nx\n$$');
  });
});
