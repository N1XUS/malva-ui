import { Editor, type JSONContent } from '@tiptap/core';
import { AttrStep } from '@tiptap/pm/transform';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mlvEditorDefaultExtensions,
  type MlvEditorDefaultExtensionOptions,
} from '../editor-extensions';
import type {
  MlvEditorHeadingAnchorOptions,
  MlvEditorHeadingAnchorStorage,
} from './editor-heading-anchors';
import {
  memoizeSlug,
  planHeadingAnchors,
  slugifyHeading,
} from './editor-heading-anchors-derive';

const editors: Editor[] = [];

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  document.body.replaceChildren();
});

const createEditor = (
  headingAnchors: Partial<MlvEditorHeadingAnchorOptions> | boolean = true,
  extra: MlvEditorDefaultExtensionOptions & { content?: string } = {},
): Editor => {
  const { content, ...preset } = extra;
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    content,
    extensions: mlvEditorDefaultExtensions({
      ...preset,
      headingAnchors,
    } as MlvEditorDefaultExtensionOptions),
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

/** Every heading's derived anchor, in document order. */
const anchors = (editor: Editor): Array<string | null> => {
  const out: Array<string | null> = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'heading') {
      out.push((node.attrs['anchor'] as string | null) ?? null);
    }
    return !node.isTextblock;
  });
  return out;
};

/** The widget buttons currently rendered in the editor. */
const widgets = (editor: Editor): HTMLButtonElement[] => [
  ...editor.view.dom.querySelectorAll<HTMLButtonElement>(
    '.mlv-editor__heading-link',
  ),
];

/** Wires the storage callbacks the way `MlvEditor` does, then re-renders. */
const wire = (
  editor: Editor,
  overrides: Partial<MlvEditorHeadingAnchorStorage> = {},
): MlvEditorHeadingAnchorStorage => {
  const storage = editor.storage.headingAnchors;
  storage.copy = vi.fn(() => true);
  storage.announce = vi.fn();
  storage.label = () => 'Copy link to heading';
  storage.disabled = () => false;
  Object.assign(storage, overrides);
  editor.view.updateState(editor.state);
  return storage;
};

describe('MlvEditorHeadingAnchors: opt-in and slugs', () => {
  it('leaves the default preset byte-identical when anchors are off', () => {
    const plain = new Editor({ extensions: mlvEditorDefaultExtensions() });
    const off = new Editor({
      extensions: mlvEditorDefaultExtensions({ headingAnchors: false }),
    });
    editors.push(plain, off);
    load(plain, '<h2>Intro</h2><p>Body</p>');
    load(off, '<h2>Intro</h2><p>Body</p>');
    expect(off.getHTML()).toBe(plain.getHTML());
    expect(off.getHTML()).not.toContain('id=');
    expect(off.schema.nodes['heading'].spec.attrs).not.toHaveProperty('anchor');
  });

  it.each([
    ['Getting started', 'getting-started'],
    ['Hello, World!', 'hello-world'],
    ['  Spaces   around  ', 'spaces-around'],
    ['a -- b', 'a-b'],
    ['--Edge--', 'edge'],
    ['Привет мир', 'привет-мир'],
    ['日本語の見出し', '日本語の見出し'],
    ['🚀 Launch plan', 'launch-plan'],
    ['Ｆｕｌｌｗｉｄｔｈ ①', 'fullwidth-1'],
    ['Café au lait', 'café-au-lait'],
    ['İstanbul', 'i̇stanbul'],
    ['snake_case', 'snakecase'],
  ])('slugs %j as %j', (text, slug) => {
    const editor = createEditor();
    load(editor, `<h2>${text}</h2><p>Body</p>`);
    expect(anchors(editor)).toEqual([slug]);
    expect(editor.getHTML()).toContain(`<h2 id="${slug}">`);
  });

  it.each([['!!!'], ['🚀'], ['']])('gives %j no anchor and no id', (text) => {
    const editor = createEditor();
    load(editor, `<h2>${text}</h2><p>Body</p>`);
    expect(anchors(editor)).toEqual([null]);
    expect(editor.getHTML()).toContain('<h2>');
  });

  it('ignores an incoming id and derives the anchor from the text', () => {
    const editor = createEditor();
    load(editor, '<h2 id="custom">Intro</h2><p>Body</p>');
    expect(anchors(editor)).toEqual(['intro']);
    expect(editor.getHTML()).toBe('<h2 id="intro">Intro</h2><p>Body</p>');
  });

  it('writes the prefixed id into the DOM, the HTML and not the anchor', () => {
    const editor = createEditor({ idPrefix: 'doc-' });
    load(editor, '<h2>Intro</h2><p>Body</p>');
    expect(anchors(editor)).toEqual(['intro']);
    expect(editor.view.dom.querySelector('h2')?.id).toBe('doc-intro');
    expect(editor.getHTML()).toBe('<h2 id="doc-intro">Intro</h2><p>Body</p>');
  });

  it('accepts a custom slugify', () => {
    const editor = createEditor({ slugify: (text) => `s-${text.length}` });
    load(editor, '<h2>Intro</h2><p>Body</p>');
    expect(anchors(editor)).toEqual(['s-5']);
  });

  it('carries the derived anchor in JSON and re-derives a stale one', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><p>Body</p>');
    expect(editor.getJSON().content?.[0].attrs?.['anchor']).toBe('intro');
    load(editor, {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2, anchor: 'stale' },
          content: [{ type: 'text', text: 'Fresh' }],
        },
        { type: 'paragraph' },
      ],
    });
    expect(anchors(editor)).toEqual(['fresh']);
  });

  it('keeps Markdown free of anchors and re-derives them identically', () => {
    const editor = createEditor(true, { format: 'markdown' });
    load(
      editor,
      '<h2>Intro</h2><h2 style="text-align: center">Centred</h2><p>Body</p>',
    );
    const markdown = editor.getMarkdown();
    expect(markdown).not.toContain('id=');
    expect(markdown).toContain('text-align: center');
    const reloaded = createEditor(true, { format: 'markdown' });
    reloaded
      .chain()
      .setMeta('addToHistory', false)
      .setContent(markdown, { emitUpdate: false, contentType: 'markdown' })
      .run();
    expect(anchors(reloaded)).toEqual(anchors(editor));
    expect(anchors(reloaded)).toEqual(['intro', 'centred']);
  });
});

describe('MlvEditorHeadingAnchors: dedupe and recompute', () => {
  it("dedupes in document order, in github-slugger's suffix order", () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><h2>Intro</h2><h2>Intro 1</h2><p>Body</p>');
    // The second "Intro" takes `intro-1` first, so the later "Intro 1" is
    // the one suffixed — github-slugger's suffix order for the same text.
    expect(anchors(editor)).toEqual(['intro', 'intro-1', 'intro-1-1']);
  });

  it('never renames an earlier heading when one is added below it', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><h2>Intro</h2><p>Body</p>');
    expect(anchors(editor)).toEqual(['intro', 'intro-1']);
    editor.commands.insertContentAt(
      editor.state.doc.content.size,
      '<h2>Intro 1</h2>',
    );
    expect(anchors(editor)).toEqual(['intro', 'intro-1', 'intro-1-1']);
  });

  it('keeps a literal "Intro 1" slug wherever it sits', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro 1</h2><h2>Intro</h2><h2>Intro</h2><p>Body</p>');
    expect(anchors(editor)).toEqual(['intro-1', 'intro', 'intro-2']);
  });

  it('numbers plain repeats in document order', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><h3>Intro</h3><h2>Intro</h2><p>Body</p>');
    expect(anchors(editor)).toEqual(['intro', 'intro-1', 'intro-2']);
  });

  it('recomputes the anchor as the heading text changes', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><p>Body</p>');
    editor.chain().setTextSelection(6).insertContent(' text').run();
    expect(anchors(editor)).toEqual(['intro-text']);
    expect(editor.view.dom.querySelector('h2')?.id).toBe('intro-text');
  });

  it('shifts suffixes when a duplicate is inserted before or removed', () => {
    const editor = createEditor();
    load(editor, '<h2>Setup</h2><p>Body</p>');
    editor.commands.insertContentAt(0, '<h2>Setup</h2>');
    expect(anchors(editor)).toEqual(['setup', 'setup-1']);
    editor.commands.deleteRange({ from: 0, to: 7 });
    expect(anchors(editor)).toEqual(['setup']);
  });

  it('writes only AttrSteps that undo with the edit', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><p>Body</p>');
    const appended: AttrStep[][] = [];
    editor.on('transaction', ({ appendedTransactions }) => {
      appended.push(
        appendedTransactions.flatMap((tr) => tr.steps) as AttrStep[],
      );
    });
    editor.chain().setTextSelection(6).insertContent('s').run();
    const steps = appended.flat();
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((step) => step instanceof AttrStep)).toBe(true);
    expect(anchors(editor)).toEqual(['intros']);
    editor.commands.undo();
    expect(anchors(editor)).toEqual(['intro']);
    expect(editor.can().undo()).toBe(false);
  });

  it('skips a transaction `filterTransaction` rejects until a local edit', () => {
    const editor = createEditor({
      filterTransaction: (tr) => !tr.getMeta('remote'),
    });
    load(editor, '<h2>Intro</h2><p>Body</p>');
    editor.view.dispatch(
      editor.state.tr.insertText('duction', 6).setMeta('remote', true),
    );
    expect(anchors(editor)).toEqual(['intro']);
    editor.chain().setTextSelection(15).insertContent('!').run();
    expect(anchors(editor)).toEqual(['introduction']);
  });

  it('`ensureHeadingAnchors()` derives every anchor outside history', () => {
    const editor = new Editor({
      extensions: mlvEditorDefaultExtensions({ headingAnchors: true }),
      content: '<h2>Intro</h2><h2>Intro</h2><p>Body</p>',
    });
    editors.push(editor);
    // Headless: no `onCreate`, so nothing derived the initial document yet.
    expect(anchors(editor)).toEqual([null, null]);
    expect(editor.commands.ensureHeadingAnchors()).toBe(true);
    expect(anchors(editor)).toEqual(['intro', 'intro-1']);
    expect(editor.can().undo()).toBe(false);
  });

  it('derives the initial document of a mounted editor on create', async () => {
    const editor = createEditor(true, { content: '<h2>Intro</h2><p>Body</p>' });
    expect(anchors(editor)).toEqual([null]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(anchors(editor)).toEqual(['intro']);
    expect(editor.can().undo()).toBe(false);
  });
});

describe('MlvEditorHeadingAnchors: copy-link widget', () => {
  it('renders nothing until an `MlvEditor` wires the storage', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><p>Body</p>');
    expect(widgets(editor)).toEqual([]);
  });

  it('renders one named, non-editable button per anchored heading', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><h3>!!!</h3><p>Body</p>');
    wire(editor);
    const [button, ...rest] = widgets(editor);
    expect(rest).toEqual([]);
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Copy link to heading');
    expect(button.getAttribute('contenteditable')).toBe('false');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(button.closest('h2')?.id).toBe('intro');
  });

  it('stays out of the value and the text', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><p>Body</p>');
    wire(editor);
    expect(widgets(editor)).toHaveLength(1);
    expect(editor.getHTML()).toBe('<h2 id="intro">Intro</h2><p>Body</p>');
    expect(editor.getText()).toBe('Intro\n\nBody');
    expect(editor.view.dom.querySelector('h2')?.textContent).toBe('Intro');
  });

  it('is a tab stop only while the editor is not editable', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><p>Body</p>');
    wire(editor);
    expect(widgets(editor)[0].tabIndex).toBe(-1);
    editor.setEditable(false);
    expect(widgets(editor)[0].tabIndex).toBe(0);
    editor.setEditable(true);
    expect(widgets(editor)[0].tabIndex).toBe(-1);
  });

  it('leaves the heading name to its text while editable, not readonly', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><p>Body</p>');
    wire(editor);
    // Editable: the keyboard path is the heading menu's item (N1-D13), so the
    // tabindex -1 button is hidden and the heading reads "Intro" alone.
    expect(widgets(editor)[0].getAttribute('aria-hidden')).toBe('true');
    editor.setEditable(false);
    // Readonly: a named tab stop, so it stays in the accessibility tree.
    expect(widgets(editor)[0].hasAttribute('aria-hidden')).toBe(false);
    editor.setEditable(true);
    expect(widgets(editor)[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('has no axe violations while editable or readonly', async () => {
    const editor = createEditor();
    editor.setOptions({
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Draft',
        },
      },
    });
    load(editor, '<h2>Intro</h2><p>Body</p>');
    wire(editor);
    expect(widgets(editor)).toHaveLength(1);
    await expectNoAxeViolations(editor.view.dom as HTMLElement);
    editor.setEditable(false);
    expect(widgets(editor)[0].tabIndex).toBe(0);
    await expectNoAxeViolations(editor.view.dom as HTMLElement);
  });

  it('is hidden while the host reports disabled', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><p>Body</p>');
    let disabled = false;
    wire(editor, { disabled: () => disabled });
    expect(widgets(editor)).toHaveLength(1);
    disabled = true;
    editor.setEditable(false);
    expect(widgets(editor)).toEqual([]);
    disabled = false;
    editor.view.updateState(editor.state);
    expect(widgets(editor)).toHaveLength(1);
  });

  it('copies the prefixed link and announces on click', () => {
    const editor = createEditor({ idPrefix: 'doc-' });
    load(editor, '<h2>Intro</h2><p>Body</p>');
    const storage = wire(editor);
    widgets(editor)[0].click();
    expect(storage.copy).toHaveBeenCalledExactlyOnceWith({
      anchor: 'intro',
      id: 'doc-intro',
    });
    expect(storage.announce).toHaveBeenCalledOnce();
  });

  it('does not announce when the copy fails', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><p>Body</p>');
    const storage = wire(editor, { copy: vi.fn(() => false) });
    widgets(editor)[0].click();
    expect(storage.copy).toHaveBeenCalledOnce();
    expect(storage.announce).not.toHaveBeenCalled();
  });

  it('keeps its button across unrelated edits and follows a new label', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><p>Body</p>');
    const storage = wire(editor);
    const before = widgets(editor)[0];
    editor.chain().setTextSelection(10).insertContent('x').run();
    expect(widgets(editor)[0]).toBe(before);
    storage.label = () => 'Link kopieren';
    editor.view.updateState(editor.state);
    expect(widgets(editor)[0].getAttribute('aria-label')).toBe('Link kopieren');
  });

  it('gives every heading the base class, and the caret modifier beside it', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><h3></h3><p>Body</p>');
    const classes = (): string[] =>
      [...editor.view.dom.querySelectorAll('h2, h3')].map(
        (heading) => heading.className,
      );
    // Before any host wired the copy: the base class is still there.
    expect(classes()).toEqual(['mlv-editor__heading', 'mlv-editor__heading']);
    wire(editor);
    editor.commands.setTextSelection(3);
    expect(classes()).toEqual([
      'mlv-editor__heading mlv-editor__heading--caret',
      'mlv-editor__heading',
    ]);
  });

  it('marks the heading holding the caret', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><p>Body</p>');
    wire(editor);
    editor.commands.setTextSelection(3);
    const heading = editor.view.dom.querySelector('h2');
    expect(heading?.classList.contains('mlv-editor__heading--caret')).toBe(
      true,
    );
    editor.commands.setTextSelection(10);
    expect(heading?.classList.contains('mlv-editor__heading--caret')).toBe(
      false,
    );
  });
});

describe('MlvEditorHeadingAnchors: copyHeadingLink()', () => {
  it('copies the heading at the caret and announces', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><p>Body</p>');
    const storage = wire(editor);
    editor.commands.setTextSelection(3);
    expect(editor.can().copyHeadingLink()).toBe(true);
    expect(storage.copy).not.toHaveBeenCalled();
    expect(editor.commands.copyHeadingLink()).toBe(true);
    expect(storage.copy).toHaveBeenCalledExactlyOnceWith({
      anchor: 'intro',
      id: 'intro',
    });
    expect(storage.announce).toHaveBeenCalledOnce();
  });

  it('is unavailable outside a heading, for an empty slug and unwired', () => {
    const editor = createEditor();
    load(editor, '<h2>Intro</h2><h2>!!!</h2><p>Body</p>');
    editor.commands.setTextSelection(3);
    expect(editor.can().copyHeadingLink()).toBe(false);
    const storage = wire(editor);
    editor.commands.setTextSelection(10);
    expect(editor.can().copyHeadingLink()).toBe(false);
    editor.commands.setTextSelection(16);
    expect(editor.can().copyHeadingLink()).toBe(false);
    expect(storage.copy).not.toHaveBeenCalled();
  });
});

describe('MlvEditorHeadingAnchors: slug memo (#514 review)', () => {
  it('still hits for every heading of a document with more than 512', () => {
    const editor = new Editor({
      extensions: mlvEditorDefaultExtensions(),
      content: Array.from(
        { length: 600 },
        (_, index) => `<h2>Heading ${index}</h2>`,
      ).join(''),
    });
    editors.push(editor);
    const slugify = vi.fn(slugifyHeading);
    const slug = memoizeSlug(slugify);

    planHeadingAnchors(editor.state.doc, slug);
    expect(slugify.mock.calls.length).toBe(600);
    slugify.mockClear();
    planHeadingAnchors(editor.state.doc, slug);
    expect(slugify.mock.calls.length).toBe(0);
  });
});
