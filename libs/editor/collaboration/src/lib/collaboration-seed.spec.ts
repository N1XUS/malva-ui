import { mlvEditorDefaultExtensions } from '@malva-ui/editor';
import { getSchema, type JSONContent } from '@tiptap/core';
import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import {
  MLV_EDITOR_COLLABORATION_META,
  MLV_EDITOR_COLLABORATION_SEEDED,
} from './collaboration-meta';
import { createMlvEditorCollaborationSeed } from './collaboration-seed';

describe('createMlvEditorCollaborationSeed', () => {
  const schema = getSchema(mlvEditorDefaultExtensions({ format: 'html' }));
  const idSchema = getSchema(
    mlvEditorDefaultExtensions({ format: 'html', blockIds: true }),
  );

  const paragraphs = (...texts: string[]): JSONContent => ({
    type: 'doc',
    content: texts.map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })),
  });

  const textOf = (doc: Y.Doc): string[] =>
    (
      (
        yXmlFragmentToProsemirrorJSON(
          doc.getXmlFragment('default'),
        ) as JSONContent
      ).content ?? []
    ).map((block) =>
      (block.content ?? []).map((node) => node.text ?? '').join(''),
    );

  /** Two documents exchanging their full state, as one sync round does. */
  const exchange = (a: Y.Doc, b: Y.Doc): void => {
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
  };

  it('is byte-identical for the same content, whatever the key order', () => {
    const first = createMlvEditorCollaborationSeed(paragraphs('Hello'), {
      schema,
    });
    const reordered: JSONContent = {
      content: [
        { content: [{ text: 'Hello', type: 'text' }], type: 'paragraph' },
      ],
      type: 'doc',
    };
    expect(
      Array.from(createMlvEditorCollaborationSeed(reordered, { schema })),
    ).toEqual(Array.from(first));
    expect(
      Array.from(
        createMlvEditorCollaborationSeed(paragraphs('Hello'), {
          schema,
          field: 'other',
        }),
      ),
    ).not.toEqual(Array.from(first));
  });

  it('lands once when two clients seed the same content concurrently (U2)', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    Y.applyUpdate(
      a,
      createMlvEditorCollaborationSeed(paragraphs('Same'), { schema }),
    );
    Y.applyUpdate(
      b,
      createMlvEditorCollaborationSeed(paragraphs('Same'), { schema }),
    );
    exchange(a, b);
    expect(textOf(a)).toEqual(['Same']);
    expect(textOf(b)).toEqual(['Same']);
    expect(Y.encodeStateVector(a)).toEqual(Y.encodeStateVector(b));
    expect(
      a
        .getMap(MLV_EDITOR_COLLABORATION_META)
        .get(MLV_EDITOR_COLLABORATION_SEEDED),
    ).toBe(true);
  });

  it('keeps both contents, never diverging, when two clients seed different content (U2)', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    Y.applyUpdate(
      a,
      createMlvEditorCollaborationSeed(paragraphs('From A'), { schema }),
    );
    Y.applyUpdate(
      b,
      createMlvEditorCollaborationSeed(paragraphs('From B'), { schema }),
    );
    exchange(a, b);
    expect(textOf(a)).toEqual(textOf(b));
    expect([...textOf(a)].sort()).toEqual(['From A', 'From B']);
    expect(Y.encodeStateVector(a)).toEqual(Y.encodeStateVector(b));
  });

  it('is idempotent when a server seed races a client fallback', () => {
    const server = new Y.Doc();
    Y.applyUpdate(
      server,
      createMlvEditorCollaborationSeed(paragraphs('Doc'), { schema }),
    );
    const client = new Y.Doc();
    Y.applyUpdate(
      client,
      createMlvEditorCollaborationSeed(paragraphs('Doc'), { schema }),
    );
    Y.applyUpdate(client, Y.encodeStateAsUpdate(server));
    expect(textOf(client)).toEqual(['Doc']);
  });

  it('gives blocks without an ID deterministic block IDs, keeping existing ones', () => {
    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { blockId: 'keepthis01' },
          content: [{ type: 'text', text: 'Kept' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Minted' }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Minted too' }] },
      ],
    };
    const ids = (seed: Uint8Array): unknown[] => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, seed);
      return (
        (
          yXmlFragmentToProsemirrorJSON(
            doc.getXmlFragment('default'),
          ) as JSONContent
        ).content ?? []
      ).map((block) => block.attrs?.['blockId']);
    };
    const first = ids(
      createMlvEditorCollaborationSeed(content, { schema: idSchema }),
    );
    expect(first[0]).toBe('keepthis01');
    expect(first[1]).toMatch(/^[0-9a-z]{10}$/);
    expect(first[2]).toMatch(/^[0-9a-z]{10}$/);
    expect(new Set(first).size).toBe(3);
    expect(
      ids(createMlvEditorCollaborationSeed(content, { schema: idSchema })),
    ).toEqual(first);
    // Without the attribute in the schema, nothing is minted.
    expect(
      ids(createMlvEditorCollaborationSeed(paragraphs('No ids'), { schema })),
    ).toEqual([undefined]);
  });

  it('throws on content that does not fit the schema, writing nothing', () => {
    expect(() =>
      createMlvEditorCollaborationSeed(
        { type: 'doc', content: [{ type: 'nope' }] },
        { schema },
      ),
    ).toThrow();
  });
});
