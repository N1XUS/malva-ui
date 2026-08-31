import { Editor, type JSONContent } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';
import {
  editorValuesAreEquivalent,
  normalizeEditorValue,
  parseEditorJsonDocument,
  serializeEditorValue,
} from './editor-serialization';

type MlvEditorSerializationTestEditor = Pick<
  Editor,
  'getHTML' | 'getMarkdown' | 'getJSON' | 'isEmpty'
>;

const exampleDocument: JSONContent = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Example content' }] },
  ],
};

const createEditor = (
  overrides: Partial<MlvEditorSerializationTestEditor> = {},
): MlvEditorSerializationTestEditor => ({
  isEmpty: false,
  getHTML: () => '<p>Example content</p>',
  getMarkdown: () => 'Example content',
  getJSON: () => exampleDocument,
  ...overrides,
});

describe('normalizeEditorValue', () => {
  it.each([null, '', ' \n\t '])('normalizes %j to null', (value) => {
    expect(normalizeEditorValue(value)).toBeNull();
  });

  it.each([
    '<p></p>',
    '<p><br></p>',
    '<span style="color: red">Text</span>',
    '{"type":"doc","content":[]}',
    '{\n  "type": "doc"\n}',
  ])('preserves structural content for Tiptap parsing: %s', (value) => {
    expect(normalizeEditorValue(value)).toBe(value);
  });
});

describe('parseEditorJsonDocument', () => {
  it('accepts a document node for the active top node', () => {
    const result = parseEditorJsonDocument(
      '{"type":"doc","content":[{"type":"paragraph"}]}',
      'doc',
    );

    expect(result).toEqual({
      ok: true,
      document: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
  });

  it('rejects malformed JSON with the originating cause', () => {
    const result = parseEditorJsonDocument('{"type":"doc",', 'doc');

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.cause).toBeInstanceOf(SyntaxError);
  });

  it.each([
    ['an array', '[{"type":"doc"}]'],
    ['a number', '42'],
    ['a string', '"doc"'],
    ['null', 'null'],
    ['an object without a type', '{"content":[]}'],
    ['a node that is not the top node', '{"type":"paragraph"}'],
  ])('rejects %s as a document node', (_label, value) => {
    const result = parseEditorJsonDocument(value, 'doc');

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.cause).toBeInstanceOf(TypeError);
  });
});

describe('editorValuesAreEquivalent', () => {
  it('treats reordered and reflowed JSON as the same document', () => {
    const canonical = '{"type":"doc","content":[{"type":"paragraph"}]}';
    const reordered =
      '{\n  "content": [{ "type": "paragraph" }],\n  "type": "doc"\n}';

    expect(editorValuesAreEquivalent(canonical, reordered, 'json')).toBe(true);
  });

  it('treats different JSON documents as different values', () => {
    expect(
      editorValuesAreEquivalent(
        '{"type":"doc","content":[{"type":"paragraph"}]}',
        '{"type":"doc","content":[]}',
        'json',
      ),
    ).toBe(false);
  });

  it('never matches an untracked value', () => {
    expect(editorValuesAreEquivalent(null, undefined, 'json')).toBe(false);
    expect(editorValuesAreEquivalent(null, null, 'json')).toBe(true);
  });

  it.each(['html', 'markdown'] as const)(
    'keeps exact string identity for %s',
    (format) => {
      expect(editorValuesAreEquivalent('<p>A</p>', '<p>A</p>', format)).toBe(
        true,
      );
      expect(editorValuesAreEquivalent('{"a":1}', '{ "a": 1 }', format)).toBe(
        false,
      );
    },
  );

  it('falls back to string identity when JSON cannot be parsed', () => {
    expect(editorValuesAreEquivalent('<p>A</p>', '<p>B</p>', 'json')).toBe(
      false,
    );
  });
});

describe('serializeEditorValue', () => {
  it('returns null for an empty parsed Tiptap document', () => {
    const result = serializeEditorValue(
      createEditor({ isEmpty: true }),
      'html',
    );

    expect(result).toEqual({ ok: true, value: null });
  });

  it('serializes a nonempty document with Tiptap HTML', () => {
    const result = serializeEditorValue(
      createEditor({ getHTML: () => '<p>Rich text</p>' }),
      'html',
    );

    expect(result).toEqual({ ok: true, value: '<p>Rich text</p>' });
  });

  it('serializes a nonempty document with the Markdown manager', () => {
    const result = serializeEditorValue(
      createEditor({ getMarkdown: () => '**Rich text**' }),
      'markdown',
    );

    expect(result).toEqual({ ok: true, value: '**Rich text**' });
  });

  it('serializes a nonempty document as the stringified Tiptap document', () => {
    const result = serializeEditorValue(createEditor(), 'json');

    expect(result).toEqual({
      ok: true,
      value: JSON.stringify(exampleDocument),
    });
  });

  it('returns null for an empty parsed document in JSON, like every other format', () => {
    const result = serializeEditorValue(
      createEditor({ isEmpty: true }),
      'json',
    );

    expect(result).toEqual({ ok: true, value: null });
  });

  it('rejects blank Markdown from a nonempty whitespace Tiptap document', () => {
    const whitespaceDocument: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: ' ' }],
        },
      ],
    };
    const editor = new Editor({
      content: whitespaceDocument,
      extensions: [StarterKit, Markdown],
    });

    try {
      expect(editor.isEmpty).toBe(false);
      expect(editor.getMarkdown()).toBe('');

      const result = serializeEditorValue(editor, 'markdown');

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'serialize',
          recoverable: true,
        },
      });
      expect('value' in result).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it.each([
    ['html', 'getHTML'],
    ['markdown', 'getMarkdown'],
    ['json', 'getJSON'],
  ] as const)(
    'returns a recoverable serialize error when %s serialization fails',
    (format, serializer) => {
      const cause = new Error(`${format} serialization failed`);
      const result = serializeEditorValue(
        createEditor({
          [serializer]: () => {
            throw cause;
          },
        }),
        format,
      );

      expect(result).toEqual({
        ok: false,
        error: {
          code: 'serialize',
          message: 'Unable to serialize editor content.',
          recoverable: true,
          cause,
        },
      });
      expect('value' in result).toBe(false);
    },
  );
});
