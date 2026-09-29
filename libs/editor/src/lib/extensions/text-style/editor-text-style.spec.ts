import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import {
  mlvEditorDefaultExtensions,
  mlvEditorFormattingExtensions,
} from '../editor-extensions';
import { paintsBackground } from './editor-text-style-parsing';

/** Editors created by one spec, destroyed after it. */
const editors: Editor[] = [];

const create = (
  content?: JSONContent | string,
  format: 'html' | 'markdown' = 'html',
): Editor => {
  const editor = new Editor({
    ...(content === undefined ? {} : { content }),
    extensions: mlvEditorDefaultExtensions({ format }),
  });
  editors.push(editor);
  return editor;
};

const reparseMarkdown = (markdown: string): Editor => {
  const editor = create(undefined, 'markdown');
  editor.commands.setContent(markdown, {
    contentType: 'markdown',
    errorOnInvalidContent: true,
  });
  return editor;
};

const text = (value: string, marks: JSONContent['marks'] = []): JSONContent =>
  marks.length
    ? { type: 'text', text: value, marks }
    : { type: 'text', text: value };

const paragraph = (
  content: JSONContent[],
  attrs?: Record<string, unknown>,
): JSONContent =>
  attrs
    ? { type: 'paragraph', attrs, content }
    : { type: 'paragraph', content };

const doc = (...content: JSONContent[]): JSONContent => ({
  type: 'doc',
  content,
});

/** First text node's marks of the first block. */
const firstMarks = (editor: Editor): JSONContent['marks'] =>
  editor.getJSON().content?.[0]?.content?.[0]?.marks;

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

describe('text styles in the formatting preset (#514)', () => {
  it('registers font family, font size, block line height and the script marks', () => {
    const names = mlvEditorFormattingExtensions().map(({ name }) => name);
    expect(names).toEqual(
      expect.arrayContaining([
        'fontFamily',
        'fontSize',
        'blockLineHeight',
        'subscript',
        'superscript',
        'resetFormatting',
      ]),
    );
    expect(names).not.toContain('backgroundColor');
    expect(names).not.toContain('lineHeight');
  });

  it('sets and unsets font family and size on one textStyle span', () => {
    const editor = create('<p>Styled</p>');
    editor.commands.selectAll();
    editor.commands.setFontFamily('ui-serif, Georgia, serif');
    editor.commands.setFontSize('18px');

    expect(editor.getHTML()).toBe(
      '<p><span style="font-family: ui-serif, Georgia, serif; font-size: 18px;">Styled</span></p>',
    );

    editor.commands.selectAll();
    editor.commands.unsetFontFamily();
    editor.commands.unsetFontSize();
    expect(editor.getHTML()).toBe('<p>Styled</p>');
  });

  it('parses Docs/Word-like inline font family, size and colour', () => {
    const editor = create(
      '<p><span style="font-family: Georgia; font-size: 18px; color: #ff0000">Pasted</span></p>',
    );
    expect(firstMarks(editor)).toEqual([
      {
        type: 'textStyle',
        attrs: { color: '#ff0000', fontFamily: 'Georgia', fontSize: '18px' },
      },
    ]);
  });

  it('keeps both marks on a span carrying colour and background colour', () => {
    const editor = create(
      '<p><span style="color: #ff0000; background-color: #ffff00">Both</span></p>',
    );
    const marks = firstMarks(editor) ?? [];
    expect(marks).toContainEqual({
      type: 'highlight',
      attrs: { color: '#ffff00' },
    });
    expect(marks).toContainEqual({
      type: 'textStyle',
      attrs: { color: '#ff0000', fontFamily: null, fontSize: null },
    });
  });

  it('parses a background-only span as a highlight, not as an empty text style', () => {
    const editor = create(
      '<p><span style="background-color: rgb(255, 255, 0)">Marked</span></p>',
    );
    expect(firstMarks(editor)).toEqual([
      { type: 'highlight', attrs: { color: 'rgb(255, 255, 0)' } },
    ]);
  });
});

describe('MlvEditorBlockLineHeight (#514)', () => {
  it('sets and unsets the line height on every selected paragraph and heading', () => {
    const editor = create(
      '<h2>Title</h2><pre><code>code</code></pre><p>Body</p>',
    );
    editor.commands.selectAll();
    expect(editor.commands.setBlockLineHeight('1.5')).toBe(true);

    expect(editor.getHTML()).toBe(
      '<h2 style="line-height: 1.5;">Title</h2><pre><code>code</code></pre><p style="line-height: 1.5;">Body</p>',
    );

    editor.commands.selectAll();
    expect(editor.commands.unsetBlockLineHeight()).toBe(true);
    expect(editor.getHTML()).toBe(
      '<h2>Title</h2><pre><code>code</code></pre><p>Body</p>',
    );
  });

  it('parses a block line height and ignores it on an unconfigured type', () => {
    const editor = create(
      '<p style="line-height: 2">Loose</p><blockquote style="line-height: 3"><p>Quote</p></blockquote>',
    );
    const json = editor.getJSON();
    expect(json.content?.[0]?.attrs?.['lineHeight']).toBe('2');
    expect(json.content?.[1]?.attrs?.['lineHeight']).toBeUndefined();
  });

  it('fails outside a configured textblock', () => {
    const editor = create('<pre><code>code</code></pre><p>after</p>');
    editor.commands.setTextSelection({ from: 2, to: 4 });
    expect(editor.can().setBlockLineHeight('2')).toBe(false);
  });

  it('honours configured lineHeightTypes', () => {
    const editor = new Editor({
      content: '<h2>Title</h2><p>Body</p>',
      extensions: mlvEditorFormattingExtensions({
        lineHeightTypes: ['heading'],
      }),
    });
    editors.push(editor);
    editor.commands.selectAll();
    editor.commands.setBlockLineHeight('2');
    expect(editor.getHTML()).toBe(
      '<h2 style="line-height: 2;">Title</h2><p>Body</p>',
    );
  });
});

describe('text styles in Markdown (#514)', () => {
  it('writes colour, font family and font size into one span in a fixed order', () => {
    const editor = create(
      doc(
        paragraph([
          text('Styled', [
            {
              type: 'textStyle',
              attrs: {
                fontSize: '18px',
                fontFamily: "ui-serif, Georgia, 'Times New Roman', serif",
                color: '#123456',
              },
            },
          ]),
        ]),
      ),
      'markdown',
    );

    const markdown = editor.getMarkdown();
    expect(markdown).toBe(
      '<span style="color: #123456; font-family: ui-serif, Georgia, &#39;Times New Roman&#39;, serif; font-size: 18px">Styled</span>',
    );
    expect(reparseMarkdown(markdown).getJSON()).toEqual(editor.getJSON());
  });

  it('round-trips each style on its own', () => {
    for (const attrs of [
      { color: null, fontFamily: 'Georgia', fontSize: null },
      { color: null, fontFamily: null, fontSize: '12px' },
    ]) {
      const editor = create(
        doc(paragraph([text('One', [{ type: 'textStyle', attrs }])])),
        'markdown',
      );
      const markdown = editor.getMarkdown();
      expect(markdown.startsWith('<span style="font-')).toBe(true);
      expect(reparseMarkdown(markdown).getJSON()).toEqual(editor.getJSON());
    }
  });

  it('falls back to whole-node HTML for a block with a line height, keeping the attribute', () => {
    const editor = create(
      doc(
        paragraph([text('Loose', [{ type: 'bold' }])], { lineHeight: '2' }),
        {
          type: 'heading',
          attrs: { level: 2, lineHeight: '1.15' },
          content: [text('Tight')],
        },
        paragraph([text('Plain')]),
      ),
      'markdown',
    );

    const markdown = editor.getMarkdown();
    expect(markdown).toContain('<p style="line-height: 2;">');
    expect(markdown).toContain('<h2 style="line-height: 1.15;">');
    expect(markdown).toContain('\n\nPlain');
    expect(reparseMarkdown(markdown).getJSON()).toEqual(editor.getJSON());
  });
});

/**
 * Loads HTML the way `MlvEditor` does — `enableContentCheck` plus
 * `errorOnInvalidContent` — and reports whether Tiptap accepted it.
 */
const loadStrict = (
  html: string,
  extensions = mlvEditorDefaultExtensions({}),
): { editor: Editor; accepted: boolean } => {
  const editor = new Editor({ extensions, enableContentCheck: true });
  editors.push(editor);
  let accepted = true;
  try {
    editor.commands.setContent(html, {
      emitUpdate: false,
      errorOnInvalidContent: true,
    });
  } catch {
    // Tiptap throws "Invalid HTML content"; `MlvEditor` turns it into `parse`.
    accepted = false;
  }
  return { editor, accepted };
};

describe('strict HTML load of text-style spans (#514)', () => {
  it('loads the span the editor writes for colour, font and size', () => {
    const { editor, accepted } = loadStrict(
      '<p><span style="color: rgb(18, 52, 86); font-family: serif; font-size: 20px">Styled</span></p>',
    );
    expect(accepted).toBe(true);
    expect(firstMarks(editor)).toEqual([
      {
        type: 'textStyle',
        attrs: expect.objectContaining({
          color: 'rgb(18, 52, 86)',
          fontFamily: 'serif',
          fontSize: '20px',
        }),
      },
    ]);
    expect(editor.getHTML()).toBe(
      '<p><span style="color: rgb(18, 52, 86); font-family: serif; font-size: 20px;">Styled</span></p>',
    );
  });

  it('keeps a highlight and a colour pasted on one span', () => {
    const { editor, accepted } = loadStrict(
      '<p><span style="background-color: #ffee00; color: #123456">Both</span></p>',
    );
    expect(accepted).toBe(true);
    expect(
      firstMarks(editor)
        ?.map(({ type }) => type)
        .sort(),
    ).toEqual(['highlight', 'textStyle']);
  });

  it('loads a span another mark fully owns with no empty text style', () => {
    const highlighted = loadStrict(
      '<p><span style="background-color: #ffee00">Marked</span></p>',
    );
    expect(highlighted.accepted).toBe(true);
    expect(firstMarks(highlighted.editor)?.map(({ type }) => type)).toEqual([
      'highlight',
    ]);

    const lowered = loadStrict(
      '<p>H<span style="vertical-align: sub">2</span>O</p>',
    );
    expect(lowered.accepted).toBe(true);
    expect(lowered.editor.getHTML()).toBe('<p>H<sub>2</sub>O</p>');
  });

  it('still rejects a span whose style no registered extension stores', () => {
    expect(
      loadStrict(
        '<p><span style="color: red; letter-spacing: 2px">x</span></p>',
      ).accepted,
    ).toBe(false);
    expect(
      loadStrict('<p><span class="note" style="color: red">x</span></p>')
        .accepted,
    ).toBe(false);
    const withoutFonts = mlvEditorDefaultExtensions({}).filter(
      ({ name }) => name !== 'fontFamily',
    );
    expect(
      loadStrict(
        '<p><span style="font-family: serif">x</span></p>',
        withoutFonts,
      ).accepted,
    ).toBe(false);
  });
});

describe('highlight from a pasted background colour (#514 review)', () => {
  /** One run as Google Docs puts it on the clipboard: every run declares a transparent background. */
  const DOCS_RUN =
    '<span style="font-size:11pt;font-family:Arial,sans-serif;color:#000000;background-color:transparent;font-weight:400;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre;white-space:pre-wrap;">Docs text</span>';
  const DOCS_PASTE = `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;">${DOCS_RUN}</p></b>`;

  /** Mark types on every text node of the document. */
  const markTypes = (editor: Editor): string[] =>
    (editor.getJSON().content ?? []).flatMap((block) =>
      (block.content ?? []).flatMap((node) =>
        (node.marks ?? []).map(({ type }) => type),
      ),
    );

  it('stores no highlight for a Google Docs run, in HTML, JSON or Markdown', () => {
    const editor = create(`<p>${DOCS_RUN}</p>`, 'markdown');
    editor.commands.selectAll();

    expect(markTypes(editor)).not.toContain('highlight');
    expect(editor.isActive('highlight')).toBe(false);
    expect(editor.getHTML()).not.toContain('<mark');
    expect(editor.getHTML()).not.toContain('background-color');
    expect(editor.getMarkdown()).not.toContain('<mark');
    expect(editor.getMarkdown()).toContain('Docs text');
  });

  it('pastes a Google Docs paragraph with its colour and fonts, not a highlight', () => {
    const editor = create('<p></p>');
    // jsdom has no ClipboardEvent, which pasteHTML constructs when given none.
    editor.view.pasteHTML(
      DOCS_PASTE,
      Object.assign(new Event('paste'), {
        clipboardData: null,
      }) as ClipboardEvent,
    );

    expect(editor.getText()).toContain('Docs text');
    expect(markTypes(editor)).toEqual(['textStyle']);
    expect(editor.getHTML()).not.toContain('<mark');
  });

  // jsdom drops `initial`, `unset` and CSS Color 4 syntax, and reads
  // `hsla(…, 0)` as opaque black, so those forms are also pinned directly on
  // `paintsBackground` below.
  it.each([
    'transparent',
    'TRANSPARENT',
    'initial',
    'inherit',
    'unset',
    'rgba(0, 0, 0, 0)',
    'rgba(255, 255, 0, 0%)',
    'rgb(255 255 0 / 0)',
    '#ff00',
    '#ffff0000',
  ])('parses no highlight from background-color: %s', (value) => {
    const editor = create(
      `<p><span style="background-color: ${value}">Plain</span></p>`,
    );
    expect(markTypes(editor)).not.toContain('highlight');
    expect(editor.getHTML()).not.toContain('<mark');
    expect(editor.getHTML()).not.toContain('background-color');
  });

  it.each(['#ffff00', 'rgba(255, 255, 0, 0.5)', '#ff08'])(
    'still parses a highlight from background-color: %s',
    (value) => {
      const editor = create(
        `<p><span style="background-color: ${value}">Marked</span></p>`,
      );
      expect(markTypes(editor)).toEqual(['highlight']);
    },
  );
});

describe('paintsBackground (#514 review)', () => {
  // Direct, because jsdom normalizes or drops some of these forms before a
  // parse rule sees them; Chromium keeps CSS Color 4 syntax as `rgba()`.
  it.each([
    ['', false],
    [' Transparent ', false],
    ['revert-layer', false],
    ['#0000', false],
    ['#12345600', false],
    ['rgb(1 2 3 / 0%)', false],
    ['color(srgb 1 1 0 / 0)', false],
    ['oklch(0.9 0.2 100 / none)', false],
    ['rgba(0, 0, 0, 0.0)', false],
    ['hsla(60, 100%, 50%, 0)', false],
    ['initial', false],
    ['unset', false],
    ['#ff0', true],
    ['#1234', true],
    ['#12345601', true],
    ['rgb(255, 255, 0)', true],
    ['rgb(1 2 3 / 0.01)', true],
    ['hsl(60 100% 50%)', true],
    ['currentcolor', true],
    ['rgb(from red r g b / calc(0.5))', true],
    // An alpha inside a nested colour is not the value's alpha: only a `/`
    // or fourth comma argument of the outer function is read.
    ['light-dark(rgb(0 0 0 / 0), red)', true],
    ['color-mix(in srgb, rgb(0 0 0 / 0) 50%, red)', true],
    ['color-mix(in srgb, red, rgb(0 0 0 / 0))', true],
    ['light-dark(rgba(0, 0, 0, 0), red)', true],
    ['rgb(0 0 0 / calc(0.5 * 2))', true],
    ['rgba(0, 0, 0, 0) ', false],
  ])('%j paints: %s', (value, expected) => {
    expect(paintsBackground(value)).toBe(expected);
  });
});
