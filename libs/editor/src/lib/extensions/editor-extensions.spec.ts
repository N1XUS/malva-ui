import { Editor, flattenExtensions, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it, vi } from 'vitest';
import {
  countMlvEditorWords,
  MlvEditorFileHandler,
  mlvEditorDefaultExtensions,
  mlvEditorFormattingExtensions,
  mlvEditorImageExtensions,
  mlvEditorListExtensions,
  mlvEditorMarkdownExtensions,
  mlvEditorTableExtensions,
  mlvEditorUtilityExtensions,
  normalizeMlvEditorCharacterLimit,
} from './editor-extensions';

const editorExtensionFactories = [
  mlvEditorFormattingExtensions,
  mlvEditorListExtensions,
  mlvEditorTableExtensions,
  mlvEditorImageExtensions,
  mlvEditorUtilityExtensions,
  mlvEditorMarkdownExtensions,
  mlvEditorDefaultExtensions,
];

const extensionNames = (
  extensions: ReturnType<typeof mlvEditorDefaultExtensions>,
) =>
  extensions.flatMap((extension) => [
    extension.name,
    ...(extension.extensions ?? []).map(({ name }) => name),
  ]);

const createMarkdownEditor = (content?: JSONContent | string) =>
  new Editor({
    ...(content === undefined ? {} : { content }),
    extensions: mlvEditorDefaultExtensions({ format: 'markdown' }),
  });

const reparseMarkdown = (markdown: string) => {
  const editor = createMarkdownEditor();
  editor.commands.setContent(markdown, {
    contentType: 'markdown',
    errorOnInvalidContent: true,
  });
  return editor;
};

describe('Malva editor extension factories', () => {
  it('normalizes utility limits and counts words using Unicode whitespace', () => {
    expect(normalizeMlvEditorCharacterLimit(12)).toBe(12);
    expect(normalizeMlvEditorCharacterLimit(12.4)).toBeNull();
    expect(normalizeMlvEditorCharacterLimit(-1)).toBeNull();
    expect(normalizeMlvEditorCharacterLimit(Number.NaN)).toBeNull();
    expect(countMlvEditorWords('one\u00a0two\u2003three')).toBe(3);
  });

  it('configures CharacterCount with the normalized limit and shared word counter', () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure({}),
        ...mlvEditorUtilityExtensions({ characterLimit: 5 }),
      ],
    });
    try {
      expect(editor.commands.setContent('<p>12345</p>')).toBe(true);
      editor.commands.insertContent('6');
      expect(editor.getText()).toBe('12345');
      expect(editor.storage.characterCount.words()).toBe(1);
    } finally {
      editor.destroy();
    }
  });
  it('returns fresh arrays and configured extension instances from every factory', () => {
    editorExtensionFactories.forEach((factory) => {
      const first = factory();
      const second = factory();

      expect(first).not.toBe(second);
      expect(first).toHaveLength(second.length);
      first.forEach((extension, index) => {
        expect(extension).not.toBe(second[index]);
      });
    });
  });

  it('includes the supported formatting, list, table, image, and utility extensions', () => {
    expect(extensionNames(mlvEditorFormattingExtensions())).toEqual(
      expect.arrayContaining([
        'starterKit',
        'textStyle',
        'color',
        'highlight',
        'textAlign',
      ]),
    );
    expect(extensionNames(mlvEditorListExtensions())).toEqual(
      expect.arrayContaining(['taskList', 'taskItem']),
    );
    expect(extensionNames(mlvEditorTableExtensions())).toContain('tableKit');
    expect(extensionNames(mlvEditorImageExtensions())).toEqual(
      expect.arrayContaining(['image', 'fileHandler']),
    );
    expect(extensionNames(mlvEditorUtilityExtensions())).toEqual(
      expect.arrayContaining(['placeholder', 'characterCount']),
    );
  });

  it('configures multicolour highlights, table resizing, image resizing, and file callbacks', () => {
    const formatting = mlvEditorFormattingExtensions();
    const table = mlvEditorTableExtensions({ resizable: true });
    const onFiles = vi.fn();
    const image = mlvEditorImageExtensions({
      resizable: true,
      allowedMimeTypes: ['image/png'],
      onFiles,
    });

    expect(
      formatting.find(({ name }) => name === 'highlight')?.options.multicolor,
    ).toBe(true);
    expect(table[0]?.options.table).toMatchObject({ resizable: true });
    expect(
      image.find(({ name }) => name === 'image')?.options.resize,
    ).toMatchObject({ enabled: true });
    expect(
      image.find(({ name }) => name === 'fileHandler')?.options
        .allowedMimeTypes,
    ).toEqual(['image/png']);
  });

  it('gives image resizing finite minimum dimensions', () => {
    const resize = mlvEditorImageExtensions().find(
      ({ name }) => name === 'image',
    )?.options.resize as { minWidth?: number; minHeight?: number } | undefined;

    // Not cosmetic. Tiptap's Image extension always forwards
    // `min: { width: minWidth, height: minHeight }` to `ResizableNodeView`,
    // and that object is truthy even when both members are undefined, so the
    // node view spreads them over its own `{ width: 8, height: 8 }` defaults
    // and erases them. Every drag then computes `Math.max(undefined, n)` ===
    // NaN, and `style.width = 'NaNpx'` is rejected by the CSSOM without an
    // error, so the image never resizes while the commit on mouseup still
    // writes back its unchanged size — a completely silent no-op.
    expect(Number.isFinite(resize?.minWidth)).toBe(true);
    expect(Number.isFinite(resize?.minHeight)).toBe(true);
  });

  it('leaves file handling inactive without an upload callback and consumes it with one', () => {
    const inactive = mlvEditorImageExtensions().find(
      ({ name }) => name === 'fileHandler',
    );
    const onFiles = vi.fn();
    const active = mlvEditorImageExtensions({ onFiles }).find(
      ({ name }) => name === 'fileHandler',
    );

    expect(inactive?.options.onPaste).toBeUndefined();
    expect(inactive?.options.onDrop).toBeUndefined();
    expect(inactive?.options.consumePasteEvent).toBe(false);
    expect(active?.options.consumePasteEvent).toBe(false);
  });

  it('does not duplicate plain text when the public file handler has no paste callback', () => {
    const editor = new Editor({
      content: '',
      extensions: mlvEditorDefaultExtensions(),
    });
    const file = new File(['text'], 'notes.txt', { type: 'text/plain' });
    const event = new Event('paste', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        files: [file],
        types: ['Files', 'text/plain'],
        getData: (type: string) => (type === 'text/plain' ? 'keep me' : ''),
      },
    });

    try {
      editor.view.dom.dispatchEvent(event);

      expect(editor.getText()).toBe('keep me');
    } finally {
      editor.destroy();
    }
  });

  it('does not consume an external file drop when the public file handler has no drop callback', () => {
    const editor = new Editor({
      content: '<p>AB</p>',
      extensions: [StarterKit, MlvEditorFileHandler.configure()],
    });
    const position = vi
      .spyOn(editor.view, 'posAtCoords')
      .mockReturnValue({ pos: 2, inside: -1 });
    const file = new File(['text'], 'notes.txt', { type: 'text/plain' });
    const event = new Event('drop', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        files: [file],
        types: ['Files'],
        getData: () => '',
      },
    });

    try {
      const dispatched = editor.view.dom.dispatchEvent(event);

      expect(dispatched).toBe(true);
      expect(event.defaultPrevented).toBe(false);
      expect(editor.getText()).toBe('AB');
    } finally {
      position.mockRestore();
      editor.destroy();
    }
  });

  it('passes typed paste and drop file events to an active image handler', () => {
    const onFiles = vi.fn();
    const editor = new Editor({ extensions: mlvEditorDefaultExtensions() });
    const file = new File(['image'], 'image.png', { type: 'image/png' });

    try {
      const fileHandler = mlvEditorImageExtensions({ onFiles }).find(
        ({ name }) => name === 'fileHandler',
      );
      fileHandler?.options.onPaste?.(editor, [file], '<img>');
      fileHandler?.options.onDrop?.(editor, [file], 1);

      expect(onFiles).toHaveBeenNthCalledWith(1, {
        editor,
        files: [file],
        source: 'paste',
        pasteContent: '<img>',
      });
      expect(onFiles).toHaveBeenNthCalledWith(2, {
        editor,
        files: [file],
        source: 'drop',
        position: 1,
      });
    } finally {
      editor.destroy();
    }
  });

  it('only includes Markdown in a Markdown default preset', () => {
    expect(extensionNames(mlvEditorDefaultExtensions())).not.toContain(
      'markdown',
    );
    expect(
      extensionNames(mlvEditorDefaultExtensions({ format: 'markdown' })),
    ).toContain('markdown');
    expect(extensionNames(mlvEditorMarkdownExtensions())).toEqual(['markdown']);
  });

  it('combines unique extensions into a real editor without duplicate warnings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const extensions = mlvEditorDefaultExtensions({ format: 'markdown' });
    const names = extensionNames(extensions);
    const editor = new Editor({ extensions });

    try {
      expect(new Set(names).size).toBe(names.length);
      expect(editor.schema.nodes).toMatchObject({
        doc: expect.anything(),
        text: expect.anything(),
        paragraph: expect.anything(),
        heading: expect.anything(),
        bulletList: expect.anything(),
        orderedList: expect.anything(),
        listItem: expect.anything(),
        taskList: expect.anything(),
        taskItem: expect.anything(),
      });
      expect(editor.schema.marks).toMatchObject({
        bold: expect.anything(),
        italic: expect.anything(),
        strike: expect.anything(),
        underline: expect.anything(),
        link: expect.anything(),
        textStyle: expect.anything(),
        highlight: expect.anything(),
      });
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Duplicate extension names'),
      );
    } finally {
      editor.destroy();
      warn.mockRestore();
    }
  });

  it('keeps fully flattened default preset extension names unique', () => {
    const names = flattenExtensions(
      mlvEditorDefaultExtensions({ format: 'markdown' }),
    ).map(({ name }) => name);

    expect(new Set(names).size).toBe(names.length);
  });

  it('round-trips nested bold, italic, and text color through Markdown', () => {
    const editor = createMarkdownEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Nested',
              marks: [
                { type: 'bold' },
                { type: 'italic' },
                { type: 'textStyle', attrs: { color: '#123456' } },
              ],
            },
          ],
        },
      ],
    });

    try {
      const markdown = editor.getMarkdown();
      const reparsed = reparseMarkdown(markdown);
      try {
        expect(markdown).toContain('<span style="color: #123456">');
        expect(markdown.indexOf('<span')).toBeGreaterThan(
          markdown.indexOf('***'),
        );
        expect(reparsed.getJSON()).toEqual(editor.getJSON());
      } finally {
        reparsed.destroy();
      }
    } finally {
      editor.destroy();
    }
  });

  it('round-trips underline with a colored highlight through Markdown', () => {
    const editor = createMarkdownEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Marked',
              marks: [
                { type: 'underline' },
                { type: 'highlight', attrs: { color: '#ffee00' } },
              ],
            },
          ],
        },
      ],
    });

    try {
      const markdown = editor.getMarkdown();
      const reparsed = reparseMarkdown(markdown);
      try {
        expect(markdown).toContain(
          '<mark data-color="#ffee00" style="background-color: #ffee00; color: inherit">',
        );
        expect(reparsed.getJSON()).toEqual(editor.getJSON());
      } finally {
        reparsed.destroy();
      }
    } finally {
      editor.destroy();
    }
  });

  it('keeps uncolored highlights in native Markdown syntax', () => {
    const editor = createMarkdownEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Native',
              marks: [{ type: 'highlight', attrs: { color: null } }],
            },
          ],
        },
      ],
    });

    try {
      const markdown = editor.getMarkdown();
      expect(markdown).toBe('==Native==');
      expect(markdown).not.toContain('<mark');
    } finally {
      editor.destroy();
    }
  });

  it('round-trips aligned blocks with nested native marks through HTML fallback', () => {
    const editor = createMarkdownEditor({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'center' },
          content: [
            {
              type: 'text',
              text: 'Heading',
              marks: [{ type: 'bold' }],
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [
            {
              type: 'text',
              text: 'Paragraph',
              marks: [{ type: 'italic' }],
            },
          ],
        },
      ],
    });

    try {
      const markdown = editor.getMarkdown();
      const reparsed = reparseMarkdown(markdown);
      try {
        expect(markdown).toContain('<h2 style="text-align: center;');
        expect(markdown).toContain('<p style="text-align: right;');
        expect(reparsed.getJSON()).toEqual(editor.getJSON());
      } finally {
        reparsed.destroy();
      }
    } finally {
      editor.destroy();
    }
  });

  it('keeps a lossless simple table in native GFM Markdown', () => {
    const editor = createMarkdownEditor({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    colwidth: null,
                    align: 'left',
                  },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Name' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    colwidth: null,
                    align: 'right',
                  },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Value' }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    colwidth: null,
                    align: 'left',
                  },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'One' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    colwidth: null,
                    align: 'right',
                  },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '1' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    try {
      const markdown = editor.getMarkdown();
      expect(markdown).not.toContain('<table');
      expect(markdown).toContain('| Name');
      expect(markdown).toContain('| :');
    } finally {
      editor.destroy();
    }
  });

  it('round-trips a merged table with spans and nested rich marks through HTML fallback', () => {
    const editor = createMarkdownEditor(
      '<table><colgroup><col style="width: 120px"><col style="width: 140px"></colgroup><tbody><tr><th colspan="2" colwidth="120,140"><p><strong><span style="color: #123456">Merged</span></strong></p></th></tr><tr><td><p>A</p></td><td><p>B</p></td></tr></tbody></table>',
    );

    try {
      const markdown = editor.getMarkdown();
      const reparsed = reparseMarkdown(markdown);
      try {
        expect(markdown).toContain('<table');
        expect(markdown).toContain('colspan="2"');
        expect(markdown).toContain('colwidth="120,140"');
        const table = reparsed.getJSON().content?.[0];
        const mergedCell = table?.content?.[0]?.content?.[0];
        const markedText = mergedCell?.content?.[0]?.content?.[0];
        expect(table?.type).toBe('table');
        expect(mergedCell?.attrs).toMatchObject({
          colspan: 2,
          rowspan: 1,
          colwidth: [120, 140],
        });
        expect(markedText).toMatchObject({
          type: 'text',
          text: 'Merged',
          marks: [
            { type: 'bold' },
            {
              type: 'textStyle',
              attrs: { color: 'rgb(18, 52, 86)' },
            },
          ],
        });
        expect(table?.content?.[1]?.content?.map((cell) => cell.attrs)).toEqual(
          [
            expect.objectContaining({ colwidth: [120] }),
            expect.objectContaining({ colwidth: [140] }),
          ],
        );
      } finally {
        reparsed.destroy();
      }
    } finally {
      editor.destroy();
    }
  });

  it.each([
    [
      'body-only',
      [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    ],
    [
      'mixed first row',
      [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              content: [{ type: 'paragraph' }],
            },
            {
              type: 'tableCell',
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    ],
    [
      'colwidth',
      [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              attrs: { colwidth: [100] },
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    ],
    [
      'divergent column alignment',
      [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              attrs: { align: 'left' },
              content: [{ type: 'paragraph' }],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { align: 'right' },
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    ],
    [
      'multiple paragraphs',
      [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              content: [{ type: 'paragraph' }, { type: 'paragraph' }],
            },
          ],
        },
      ],
    ],
    [
      'aligned cell paragraph',
      [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              content: [
                {
                  type: 'paragraph',
                  attrs: { textAlign: 'center' },
                },
              ],
            },
          ],
        },
      ],
    ],
  ])('uses HTML fallback for a %s table', (_name, rows) => {
    const editor = createMarkdownEditor({
      type: 'doc',
      content: [{ type: 'table', content: rows as JSONContent[] }],
    });

    try {
      expect(editor.getMarkdown()).toContain('<table');
    } finally {
      editor.destroy();
    }
  });

  it('escapes hostile mark attribute values without creating extra markup', () => {
    const hostile = `red"; data-broken="yes&<>'`;
    const editor = createMarkdownEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Safe',
              marks: [
                { type: 'textStyle', attrs: { color: hostile } },
                { type: 'highlight', attrs: { color: hostile } },
              ],
            },
          ],
        },
      ],
    });

    try {
      const markdown = editor.getMarkdown();
      expect(markdown).not.toContain('data-broken="yes');
      expect(markdown).toContain('&quot;');
      expect(markdown).toContain('&amp;');
      expect(markdown).toContain('&lt;');
      expect(markdown).toContain('&gt;');
      expect(markdown).toContain('&#39;');
    } finally {
      editor.destroy();
    }
  });

  it('uses neutral non-opening default links without rewriting literal custom Link options', () => {
    const defaultEditor = new Editor({
      extensions: mlvEditorDefaultExtensions(),
    });
    const customStarterKit = StarterKit.configure({
      link: {
        openOnClick: true,
        protocols: ['custom'],
        HTMLAttributes: { target: '_self', rel: 'author' },
      },
    });
    const customEditor = new Editor({ extensions: [customStarterKit] });

    try {
      const defaultLink = defaultEditor.extensionManager.extensions.find(
        ({ name }) => name === 'link',
      );
      const customLink = customEditor.extensionManager.extensions.find(
        ({ name }) => name === 'link',
      );

      expect(defaultLink?.options.openOnClick).toBe(false);
      expect(defaultLink?.options.HTMLAttributes).toMatchObject({
        target: null,
        rel: null,
      });
      expect(customEditor.extensionManager.extensions).toContain(
        customStarterKit,
      );
      expect(customLink?.options.openOnClick).toBe(true);
      expect(customLink?.options.protocols).toEqual(['custom']);
      expect(customLink?.options.HTMLAttributes).toMatchObject({
        target: '_self',
        rel: 'author',
      });
    } finally {
      defaultEditor.destroy();
      customEditor.destroy();
    }
  });
});

describe('MlvEditorUploadPlaceholder', () => {
  it('inserts, updates, and removes uniquely identified temporary upload placeholders', () => {
    const editor = new Editor({
      extensions: mlvEditorDefaultExtensions(),
    });

    try {
      expect(editor.commands.insertUploadPlaceholder({ id: 'first' })).toBe(
        true,
      );
      expect(editor.commands.insertUploadPlaceholder({ id: 'second' })).toBe(
        true,
      );
      expect(editor.storage.mlvEditorUploadPlaceholder.placeholders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'first', progress: 0 }),
          expect.objectContaining({ id: 'second', progress: 0 }),
        ]),
      );

      expect(
        editor.commands.updateUploadPlaceholder({ id: 'first', progress: 56 }),
      ).toBe(true);
      expect(editor.storage.mlvEditorUploadPlaceholder.placeholders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'first', progress: 56 }),
        ]),
      );

      expect(editor.commands.removeUploadPlaceholder({ id: 'first' })).toBe(
        true,
      );
      expect(
        editor.storage.mlvEditorUploadPlaceholder.placeholders,
      ).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'first' })]),
      );
      expect(editor.getHTML()).not.toContain('first');
    } finally {
      editor.destroy();
    }
  });

  it('keeps placeholders out of HTML, Markdown, and JSON serialization', () => {
    const editor = new Editor({
      content: '<p>Saved content</p>',
      extensions: mlvEditorDefaultExtensions({ format: 'markdown' }),
    });

    try {
      expect(editor.commands.insertUploadPlaceholder({ id: 'temporary' })).toBe(
        true,
      );

      expect(editor.getHTML()).toBe('<p>Saved content</p>');
      expect(editor.getMarkdown()).toBe('Saved content');
      expect(JSON.stringify(editor.getJSON())).not.toContain('temporary');
      expect(JSON.stringify(editor.getJSON())).not.toContain(
        'mlvEditorUploadPlaceholder',
      );
    } finally {
      editor.destroy();
    }
  });

  it('normalizes non-finite progress values to zero', () => {
    const editor = new Editor({ extensions: mlvEditorDefaultExtensions() });

    try {
      expect(
        editor.commands.insertUploadPlaceholder({
          id: 'temporary',
          progress: NaN,
        }),
      ).toBe(true);
      expect(editor.storage.mlvEditorUploadPlaceholder.placeholders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'temporary', progress: 0 }),
        ]),
      );

      expect(
        editor.commands.updateUploadPlaceholder({
          id: 'temporary',
          progress: Infinity,
        }),
      ).toBe(true);
      expect(editor.storage.mlvEditorUploadPlaceholder.placeholders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'temporary', progress: 0 }),
        ]),
      );
    } finally {
      editor.destroy();
    }
  });
});
