// @vitest-environment node
import { mlvEditorDefaultExtensions } from '@malva-ui/editor';
import { getSchema } from '@tiptap/core';
import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import { createMlvEditorCollaborationSeed } from './collaboration-seed';

/*
 * U3: a server seeds with no DOM. This file runs in Vitest's `node`
 * environment, so a `document` reference anywhere on the path would throw.
 */
describe('createMlvEditorCollaborationSeed on a server (U3)', () => {
  it('builds the schema and the seed without a DOM', () => {
    expect(typeof document).toBe('undefined');
    const schema = getSchema(
      mlvEditorDefaultExtensions({ format: 'markdown', blockIds: true }),
    );
    const seed = createMlvEditorCollaborationSeed(
      {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
        ],
      },
      { schema },
    );
    const doc = new Y.Doc();
    Y.applyUpdate(doc, seed);
    const json = yXmlFragmentToProsemirrorJSON(
      doc.getXmlFragment('default'),
    ) as {
      content: { type: string; attrs?: Record<string, unknown> }[];
    };
    expect(json.content.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
    ]);
    expect(json.content[0].attrs?.['blockId']).toMatch(/^[0-9a-z]{10}$/);
    doc.destroy();
  });
});
