import { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';
// Direct module import: the value import must not pull the whole Angular
// barrel into this suite.
import { mlvEditorDefaultExtensions } from '../extensions/editor-extensions';
import { applyMlvEditorAiSuggestions } from './editor-ai-suggestions';
import { runMlvEditorAiStream } from './editor-ai-stream';

/**
 * Block IDs and heading anchors are written as AttrSteps, whose step map is
 * empty. The review engine drops a suggestion whose range a foreign step map
 * touches, and the stream engine abandons on a foreign document change it
 * does not own — these specs pin that neither happens.
 */
const sequentialIds = () => {
  let next = 0;
  return () => `id${++next}`;
};

const createEditor = (content: string) =>
  new Editor({
    content,
    extensions: mlvEditorDefaultExtensions({
      format: 'markdown',
      blockIds: { generateId: sequentialIds() },
      headingAnchors: true,
    }),
  });

/** Every block's ID, in document order. */
const blockIds = (editor: Editor): unknown[] => {
  const ids: unknown[] = [];
  editor.state.doc.descendants((node: ProseMirrorNode) => {
    if (!node.isBlock) return false;
    if ('blockId' in node.attrs) ids.push(node.attrs['blockId']);
    return !node.isTextblock;
  });
  return ids;
};

const expectEveryBlockIdentified = (editor: Editor): void => {
  const ids = blockIds(editor);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(typeof id).toBe('string');
  expect(new Set(ids).size).toBe(ids.length);
};

const headingIds = (editor: Editor): string[] =>
  [...editor.view.dom.querySelectorAll('h1, h2, h3')].map((h) => h.id);

describe('AI interplay with block IDs and heading anchors', () => {
  it('keeps a block-region review open while its inserted blocks get IDs', () => {
    const editor = createEditor('<p>Keep</p><p>One</p><p>Two</p>');
    try {
      editor.commands.ensureBlockIds();
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 7,
        to: editor.state.doc.content.size,
        replacementMarkdown: 'Alpha\n\nBeta\n\nGamma',
      });
      if (!session) throw new Error('Expected a review session.');
      expect(session.suggestions()).toHaveLength(1);
      expect(editor.state.doc.textContent).toContain('Gamma');
      expectEveryBlockIdentified(editor);

      // A block inserted elsewhere gets an ID; the review survives it.
      editor.commands.insertContentAt(0, '<p>Elsewhere</p>');
      expectEveryBlockIdentified(editor);
      expect(session.suggestions()).toHaveLength(1);

      expect(session.reject(session.suggestions()[0].id)).toBe(true);
      expect(editor.state.doc.textContent).toBe('ElsewhereKeepOneTwo');
      expectEveryBlockIdentified(editor);
    } finally {
      editor.destroy();
    }
  });

  it('ends a block-inserting stream with every block identified once', async () => {
    const editor = createEditor('<p>Saved</p>');
    try {
      editor.commands.ensureBlockIds();
      editor.commands.setTextSelection({ from: 1, to: 6 });
      const frames: (() => void)[] = [];
      const chunks = ['- Key point one\n', '- Key point two\n\nClosing line'];
      const handle = runMlvEditorAiStream(editor, {
        chunks: (async function* () {
          for (const chunk of chunks) {
            yield chunk;
            frames.splice(0).forEach((flush) => flush());
          }
        })(),
        output: 'replace-selection',
        scheduler: (flush) => {
          frames.push(flush);
          return () => frames.splice(frames.indexOf(flush) >>> 0, 1);
        },
      });
      const result = await handle.done;
      expect(result.status).toBe('committed');
      expect(editor.getHTML()).toContain('<ul');
      expectEveryBlockIdentified(editor);
    } finally {
      editor.destroy();
    }
  });

  it('recomputes a heading anchor when a review rewrites it, and on reject', () => {
    const editor = createEditor('<h2>Getting started</h2><p>Body</p>');
    try {
      editor.commands.ensureHeadingAnchors();
      expect(headingIds(editor)).toEqual(['getting-started']);
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 16,
        replacementMarkdown: 'Getting going',
      });
      if (!session) throw new Error('Expected a review session.');
      const pending = session.suggestions().length;
      expect(pending).toBeGreaterThan(0);
      expect(headingIds(editor)).toEqual(['getting-going']);

      expect(session.acceptAll()).toBe(true);
      expect(headingIds(editor)).toEqual(['getting-going']);
      expect(editor.getJSON().content?.[0]?.attrs?.['anchor']).toBe(
        'getting-going',
      );
    } finally {
      editor.destroy();
    }
  });

  it('restores the original anchor when the heading rewrite is rejected', () => {
    const editor = createEditor('<h2>Getting started</h2><p>Body</p>');
    try {
      editor.commands.ensureHeadingAnchors();
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 16,
        replacementMarkdown: 'Getting going',
      });
      if (!session) throw new Error('Expected a review session.');
      expect(session.rejectAll()).toBe(true);
      expect(headingIds(editor)).toEqual(['getting-started']);
    } finally {
      editor.destroy();
    }
  });
});
