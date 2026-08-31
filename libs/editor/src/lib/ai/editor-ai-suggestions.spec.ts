import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';
// Direct module import: the value import must not pull the whole Angular
// barrel into this suite.
import { mlvEditorDefaultExtensions } from '../extensions/editor-extensions';
import {
  MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS,
  MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS,
  MLV_EDITOR_AI_SUGGESTION_INSERT_CLASS,
  applyMlvEditorAiSuggestions,
  mlvEditorAiWordDiff,
} from './editor-ai-suggestions';

const createEditor = (content: string) =>
  new Editor({ content, extensions: [StarterKit.configure({})] });

const createMarkdownEditor = (content: string) =>
  new Editor({
    content,
    extensions: mlvEditorDefaultExtensions({ format: 'markdown' }),
  });

const listenerCounts = (editor: Editor) => {
  const callbacks = (
    editor as unknown as { callbacks: Record<string, unknown[] | undefined> }
  ).callbacks;
  return {
    transaction: callbacks['transaction']?.length ?? 0,
    destroy: callbacks['destroy']?.length ?? 0,
  };
};

const insertSpans = (editor: Editor) =>
  [
    ...editor.view.dom.querySelectorAll(
      `.${MLV_EDITOR_AI_SUGGESTION_INSERT_CLASS}`,
    ),
  ] as HTMLElement[];

const deleteWidgets = (editor: Editor) =>
  [
    ...editor.view.dom.querySelectorAll(
      `.${MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS}`,
    ),
  ] as HTMLElement[];

const currentElements = (editor: Editor) =>
  [
    ...editor.view.dom.querySelectorAll(
      `.${MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS}`,
    ),
  ] as HTMLElement[];

describe('mlvEditorAiWordDiff', () => {
  it('returns no runs for identical texts', () => {
    expect(mlvEditorAiWordDiff('same text', 'same text')).toEqual([]);
    expect(mlvEditorAiWordDiff('', '')).toEqual([]);
  });

  it('reports a swapped word as one replace run with exact offsets', () => {
    expect(
      mlvEditorAiWordDiff('The quick brown fox', 'The slow brown fox'),
    ).toEqual([
      {
        kind: 'replace',
        oldFrom: 4,
        oldTo: 9,
        oldText: 'quick',
        newText: 'slow',
      },
    ]);
  });

  it('reports an added word as one insert run whose tokens include whitespace', () => {
    expect(mlvEditorAiWordDiff('Alpha beta', 'Alpha shiny beta')).toEqual([
      {
        kind: 'insert',
        oldFrom: 6,
        oldTo: 6,
        oldText: '',
        newText: 'shiny ',
      },
    ]);
  });

  it('reports a removed word as one delete run covering its whitespace', () => {
    expect(mlvEditorAiWordDiff('Alpha shiny beta', 'Alpha beta')).toEqual([
      {
        kind: 'delete',
        oldFrom: 6,
        oldTo: 12,
        oldText: 'shiny ',
        newText: '',
      },
    ]);
  });

  it('reports separated changes as separate runs', () => {
    expect(
      mlvEditorAiWordDiff('One two three four', 'One TWO three FOUR'),
    ).toEqual([
      { kind: 'replace', oldFrom: 4, oldTo: 7, oldText: 'two', newText: 'TWO' },
      {
        kind: 'replace',
        oldFrom: 14,
        oldTo: 18,
        oldText: 'four',
        newText: 'FOUR',
      },
    ]);
  });

  it('diffs whitespace-only changes like words', () => {
    expect(mlvEditorAiWordDiff('a  b', 'a b')).toEqual([
      { kind: 'replace', oldFrom: 1, oldTo: 3, oldText: '  ', newText: ' ' },
    ]);
  });

  it('degrades to a single run against an empty side', () => {
    expect(mlvEditorAiWordDiff('', 'New text')).toEqual([
      {
        kind: 'insert',
        oldFrom: 0,
        oldTo: 0,
        oldText: '',
        newText: 'New text',
      },
    ]);
    expect(mlvEditorAiWordDiff('Old text', '')).toEqual([
      {
        kind: 'delete',
        oldFrom: 0,
        oldTo: 8,
        oldText: 'Old text',
        newText: '',
      },
    ]);
  });

  it('merges interleaved deletions and insertions into one replace run', () => {
    expect(
      mlvEditorAiWordDiff('Alpha old ending', 'Alpha brand new ending'),
    ).toEqual([
      {
        kind: 'replace',
        oldFrom: 6,
        oldTo: 9,
        oldText: 'old',
        newText: 'brand new',
      },
    ]);
  });
});

describe('applyMlvEditorAiSuggestions', () => {
  it('word-diffs a single-paragraph replacement into tracked suggestions with decorated classes', () => {
    const editor = createMarkdownEditor('<p>The quick brown fox</p>');
    try {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 20,
        replacementMarkdown: 'The slow brown fox',
      });
      if (!session) throw new Error('Expected a review session.');

      // The inserted text is in the document immediately; the removed text is
      // gone from it.
      expect(editor.state.doc.textContent).toBe('The slow brown fox');

      const suggestions = session.suggestions();
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toMatchObject({
        kind: 'replace',
        range: { from: 5, to: 9 },
        oldText: 'quick',
        newText: 'slow',
      });

      // Inserted text carries the inline decoration class...
      const inserts = insertSpans(editor);
      expect(inserts).toHaveLength(1);
      expect(inserts[0].textContent).toBe('slow');
      // ...and the removed text lives only in the aria-hidden widget.
      const widgets = deleteWidgets(editor);
      expect(widgets).toHaveLength(1);
      expect(widgets[0].textContent).toBe('quick');
      expect(widgets[0].getAttribute('aria-hidden')).toBe('true');
    } finally {
      editor.destroy();
    }
  });

  it('word-diffs without a Markdown manager, treating the replacement as plain text', () => {
    const editor = createEditor('<p>The quick brown fox</p>');
    try {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 20,
        replacementMarkdown: 'The slow brown fox',
      });
      if (!session) throw new Error('Expected a review session.');

      expect(editor.state.doc.textContent).toBe('The slow brown fox');
      expect(session.suggestions()).toHaveLength(1);
      expect(session.suggestions()[0].oldText).toBe('quick');
    } finally {
      editor.destroy();
    }
  });

  it('produces separate insert and delete suggestions with widget anchors', () => {
    const editor = createMarkdownEditor('<p>Alpha shiny beta</p>');
    try {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 17,
        replacementMarkdown: 'Alpha beta gamma',
      });
      if (!session) throw new Error('Expected a review session.');

      expect(editor.state.doc.textContent).toBe('Alpha beta gamma');
      const suggestions = session.suggestions();
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]).toMatchObject({
        kind: 'delete',
        range: { from: 7, to: 7 },
        oldText: 'shiny ',
        newText: '',
      });
      expect(suggestions[1]).toMatchObject({
        kind: 'insert',
        range: { from: 11, to: 17 },
        oldText: '',
        newText: ' gamma',
      });

      expect(insertSpans(editor)).toHaveLength(1);
      expect(insertSpans(editor)[0].textContent).toBe(' gamma');
      expect(deleteWidgets(editor)).toHaveLength(1);
      expect(deleteWidgets(editor)[0].textContent).toBe('shiny ');
    } finally {
      editor.destroy();
    }
  });

  it('falls back to one whole-region replace suggestion for structural replacements', () => {
    const editor = createMarkdownEditor('<p>Alpha beta</p>');
    try {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 11,
        replacementMarkdown: '- one\n- two',
      });
      if (!session) throw new Error('Expected a review session.');

      // The document carries the parsed structure, not literal Markdown.
      const html = editor.getHTML();
      expect(html).toContain('<ul');
      expect(html).toContain('<li');
      expect(editor.state.doc.textContent).not.toContain('- one');

      const suggestions = session.suggestions();
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].kind).toBe('replace');
      expect(suggestions[0].oldText).toBe('Alpha beta');
      expect(suggestions[0].newText).toContain('one');
      expect(deleteWidgets(editor)[0].textContent).toBe('Alpha beta');

      // Rejecting the whole-region suggestion restores the original block.
      // The trailing empty paragraph is not the engine's: the preset's
      // `trailingNode` appended it while the suggested list was the last
      // block, and reject restores the reviewed region, not the editor's own
      // schema-maintenance reactions — the same residue an ordinary user
      // edit inserting and deleting a trailing list leaves behind.
      expect(session.reject(suggestions[0].id)).toBe(true);
      expect(editor.getHTML()).toBe('<p>Alpha beta</p><p></p>');
      expect(session.suggestions()).toEqual([]);
    } finally {
      editor.destroy();
    }
  });

  it('falls back to one replace suggestion when the region spans multiple blocks', () => {
    const editor = createMarkdownEditor('<p>One</p><p>Two</p>');
    try {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 9,
        replacementMarkdown: 'Single',
      });
      if (!session) throw new Error('Expected a review session.');

      expect(session.suggestions()).toHaveLength(1);
      expect(session.suggestions()[0].kind).toBe('replace');
      expect(editor.state.doc.textContent).toBe('Single');

      expect(session.reject(session.suggestions()[0].id)).toBe(true);
      expect(editor.getHTML()).toBe('<p>One</p><p>Two</p>');
    } finally {
      editor.destroy();
    }
  });

  it('applies the whole change set as exactly one undo step, and undoing it drops the session', () => {
    const editor = createMarkdownEditor('<p>Alpha shiny beta</p>');
    try {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 17,
        replacementMarkdown: 'Alpha beta gamma',
      });
      if (!session) throw new Error('Expected a review session.');
      expect(editor.state.doc.textContent).toBe('Alpha beta gamma');

      expect(editor.commands.undo()).toBe(true);
      expect(editor.getHTML()).toBe('<p>Alpha shiny beta</p>');
      // One step held the whole application: nothing remains to undo...
      expect(editor.can().undo()).toBe(false);
      // ...and the session dropped with it.
      expect(session.suggestions()).toEqual([]);
      expect(insertSpans(editor)).toHaveLength(0);
      expect(deleteWidgets(editor)).toHaveLength(0);
    } finally {
      editor.destroy();
    }
  });

  it('accept keeps the applied text, drops decorations, and creates no history entry', () => {
    const editor = createMarkdownEditor('<p>The quick brown fox</p>');
    try {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 20,
        replacementMarkdown: 'The slow brown fox',
      });
      if (!session) throw new Error('Expected a review session.');
      const [suggestion] = session.suggestions();

      expect(session.accept(suggestion.id)).toBe(true);
      expect(editor.state.doc.textContent).toBe('The slow brown fox');
      expect(session.suggestions()).toEqual([]);
      expect(insertSpans(editor)).toHaveLength(0);
      expect(deleteWidgets(editor)).toHaveLength(0);

      // Accept added no history entry: one undo reaches the pre-application
      // document, and nothing is left after it.
      expect(editor.commands.undo()).toBe(true);
      expect(editor.getHTML()).toBe('<p>The quick brown fox</p>');
      expect(editor.can().undo()).toBe(false);

      // The settled session stays inert.
      expect(session.accept(suggestion.id)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('reject restores the original text per suggestion, one history step each', () => {
    const editor = createMarkdownEditor('<p>Alpha shiny beta</p>');
    try {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 17,
        replacementMarkdown: 'Alpha beta gamma',
      });
      if (!session) throw new Error('Expected a review session.');
      const [deletion, insertion] = session.suggestions();

      // Rejecting the insert removes the inserted text; the delete suggestion
      // survives, keeping its widget.
      expect(session.reject(insertion.id)).toBe(true);
      expect(editor.state.doc.textContent).toBe('Alpha beta');
      expect(session.suggestions()).toHaveLength(1);
      expect(deleteWidgets(editor)).toHaveLength(1);

      // Rejecting the delete restores the removed text and ends the session.
      expect(session.reject(deletion.id)).toBe(true);
      expect(editor.state.doc.textContent).toBe('Alpha shiny beta');
      expect(session.suggestions()).toEqual([]);
      expect(deleteWidgets(editor)).toHaveLength(0);

      // Each reject was exactly one step: three undos walk back through both
      // rejects and the application.
      expect(editor.commands.undo()).toBe(true);
      expect(editor.state.doc.textContent).toBe('Alpha beta');
      expect(editor.commands.undo()).toBe(true);
      expect(editor.state.doc.textContent).toBe('Alpha beta gamma');
      expect(editor.commands.undo()).toBe(true);
      expect(editor.state.doc.textContent).toBe('Alpha shiny beta');
    } finally {
      editor.destroy();
    }
  });

  it('acceptAll resolves everything in place without any history entry', () => {
    const editor = createMarkdownEditor('<p>Alpha shiny beta</p>');
    try {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 17,
        replacementMarkdown: 'Alpha beta gamma',
      });
      if (!session) throw new Error('Expected a review session.');

      expect(session.acceptAll()).toBe(true);
      expect(editor.state.doc.textContent).toBe('Alpha beta gamma');
      expect(session.suggestions()).toEqual([]);
      expect(insertSpans(editor)).toHaveLength(0);
      expect(deleteWidgets(editor)).toHaveLength(0);

      expect(editor.commands.undo()).toBe(true);
      expect(editor.getHTML()).toBe('<p>Alpha shiny beta</p>');
      expect(editor.can().undo()).toBe(false);

      expect(session.acceptAll()).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('rejectAll restores the original region as exactly one history step', () => {
    const editor = createMarkdownEditor('<p>Alpha shiny beta</p>');
    try {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 17,
        replacementMarkdown: 'Alpha beta gamma',
      });
      if (!session) throw new Error('Expected a review session.');

      expect(session.rejectAll()).toBe(true);
      expect(editor.getHTML()).toBe('<p>Alpha shiny beta</p>');
      expect(session.suggestions()).toEqual([]);

      // One step total: a single undo returns to the fully suggested state.
      expect(editor.commands.undo()).toBe(true);
      expect(editor.state.doc.textContent).toBe('Alpha beta gamma');
      // And one more removes the application itself.
      expect(editor.commands.undo()).toBe(true);
      expect(editor.state.doc.textContent).toBe('Alpha shiny beta');
    } finally {
      editor.destroy();
    }
  });

  it('remaps suggestion ranges through a preceding user edit', () => {
    const editor = createMarkdownEditor(
      '<p>Intro</p><p>The quick brown fox</p>',
    );
    try {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 8,
        to: 27,
        replacementMarkdown: 'The slow brown fox',
      });
      if (!session) throw new Error('Expected a review session.');
      expect(session.suggestions()[0].range).toEqual({ from: 12, to: 16 });

      // A user edit before the suggestion shifts, but keeps, it.
      expect(editor.commands.insertContentAt(1, 'XX')).toBe(true);
      const [suggestion] = session.suggestions();
      expect(suggestion.range).toEqual({ from: 14, to: 18 });
      expect(insertSpans(editor)[0].textContent).toBe('slow');

      // The remapped range is what reject targets.
      expect(session.reject(suggestion.id)).toBe(true);
      expect(editor.getHTML()).toBe('<p>XXIntro</p><p>The quick brown fox</p>');
    } finally {
      editor.destroy();
    }
  });

  describe('concurrent-edit boundary policy', () => {
    // 'Alpha shiny beta' -> 'Alpha beta gamma' yields a collapsed delete
    // ('shiny ' at anchor 7) and an insert (' gamma' at [11, 17]).
    const startSession = (editor: Editor) => {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 17,
        replacementMarkdown: 'Alpha beta gamma',
      });
      if (!session) throw new Error('Expected a review session.');
      return session;
    };

    it('keeps a suggestion when text is inserted exactly at its range start', () => {
      const editor = createMarkdownEditor('<p>Alpha shiny beta</p>');
      try {
        const session = startSession(editor);

        expect(editor.commands.insertContentAt(11, 'X')).toBe(true);

        // The insertion only meets the boundary: the suggestion survives with
        // its range shifted past the inserted text (start association excludes
        // boundary insertions), and its decoration still covers exactly the
        // suggested text.
        const remaining = session.suggestions();
        expect(remaining).toHaveLength(2);
        expect(remaining[1]).toMatchObject({
          kind: 'insert',
          range: { from: 12, to: 18 },
          newText: ' gamma',
        });
        expect(insertSpans(editor)).toHaveLength(1);
        expect(insertSpans(editor)[0].textContent).toBe(' gamma');
      } finally {
        editor.destroy();
      }
    });

    it('keeps a suggestion when text is inserted exactly at its range end', () => {
      const editor = createMarkdownEditor('<p>Alpha shiny beta</p>');
      try {
        const session = startSession(editor);

        expect(editor.commands.insertContentAt(17, 'X')).toBe(true);

        // End association excludes boundary insertions: the range is
        // unchanged and the decoration does not swallow the user's text.
        const remaining = session.suggestions();
        expect(remaining).toHaveLength(2);
        expect(remaining[1]).toMatchObject({
          kind: 'insert',
          range: { from: 11, to: 17 },
          newText: ' gamma',
        });
        expect(insertSpans(editor)[0].textContent).toBe(' gamma');
      } finally {
        editor.destroy();
      }
    });

    it('keeps a suggestion when a deletion ends exactly at its range start', () => {
      const editor = createMarkdownEditor('<p>Alpha shiny beta</p>');
      try {
        const session = startSession(editor);

        // Deletes 'ta' of 'beta' — the range [9, 11] ends exactly at the
        // insert suggestion's start and must not drop it.
        expect(editor.commands.deleteRange({ from: 9, to: 11 })).toBe(true);

        const remaining = session.suggestions();
        expect(remaining).toHaveLength(2);
        expect(remaining[1]).toMatchObject({
          kind: 'insert',
          range: { from: 9, to: 15 },
          newText: ' gamma',
        });
        expect(insertSpans(editor)[0].textContent).toBe(' gamma');
      } finally {
        editor.destroy();
      }
    });

    it('keeps a collapsed delete when text is inserted beside its anchor, drops it only at the anchor', () => {
      const editor = createMarkdownEditor('<p>Alpha shiny beta</p>');
      try {
        const session = startSession(editor);
        expect(session.suggestions()[0]).toMatchObject({
          kind: 'delete',
          range: { from: 7, to: 7 },
        });

        // One position before the anchor: the widget survives, shifted past
        // the insertion with its side: -1 association.
        expect(editor.commands.insertContentAt(6, 'x')).toBe(true);
        expect(session.suggestions()[0]).toMatchObject({
          kind: 'delete',
          range: { from: 8, to: 8 },
          oldText: 'shiny ',
        });
        expect(deleteWidgets(editor)).toHaveLength(1);
        expect(deleteWidgets(editor)[0].textContent).toBe('shiny ');

        // Exactly at the anchor: the insertion touches the collapsed entry
        // and drops just that suggestion.
        expect(editor.commands.insertContentAt(8, 'y')).toBe(true);
        const remaining = session.suggestions();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].kind).toBe('insert');
        expect(deleteWidgets(editor)).toHaveLength(0);
      } finally {
        editor.destroy();
      }
    });
  });

  describe('edge regions', () => {
    it('reviews a collapsed mid-paragraph region as a token-path insert suggestion', () => {
      const editor = createMarkdownEditor('<p>Alpha beta</p>');
      try {
        const session = applyMlvEditorAiSuggestions(editor, {
          from: 6,
          to: 6,
          replacementMarkdown: 'X',
        });
        if (!session) throw new Error('Expected a review session.');

        expect(editor.state.doc.textContent).toBe('AlphaX beta');
        const suggestions = session.suggestions();
        expect(suggestions).toHaveLength(1);
        expect(suggestions[0]).toMatchObject({
          kind: 'insert',
          range: { from: 6, to: 7 },
          oldText: '',
          newText: 'X',
        });
        expect(insertSpans(editor)).toHaveLength(1);
        expect(insertSpans(editor)[0].textContent).toBe('X');
        expect(deleteWidgets(editor)).toHaveLength(0);

        // Reject removes the insertion exactly.
        expect(session.reject(suggestions[0].id)).toBe(true);
        expect(editor.getHTML()).toBe('<p>Alpha beta</p>');
      } finally {
        editor.destroy();
      }
    });

    it('reviews a collapsed region with a structural replacement as a replace whose reject deletes', () => {
      const editor = createMarkdownEditor('<p>Alpha beta</p>');
      try {
        const session = applyMlvEditorAiSuggestions(editor, {
          from: 6,
          to: 6,
          replacementMarkdown: '- one\n- two',
        });
        if (!session) throw new Error('Expected a review session.');

        // The fallback builds one replace entry with nothing removed: no
        // widget renders and the inverted slice is empty, so reject must
        // delete the insertion rather than replace anything.
        const suggestions = session.suggestions();
        expect(suggestions).toHaveLength(1);
        expect(suggestions[0].kind).toBe('replace');
        expect(suggestions[0].oldText).toBe('');
        expect(suggestions[0].newText).toContain('one');
        expect(editor.getHTML()).toContain('<ul');
        expect(deleteWidgets(editor)).toHaveLength(0);

        expect(session.reject(suggestions[0].id)).toBe(true);
        expect(editor.state.doc.textContent).toBe('Alpha beta');
        expect(editor.getHTML()).not.toContain('<ul');
        expect(session.suggestions()).toEqual([]);
      } finally {
        editor.destroy();
      }
    });

    it('reviews a collapsed region at position 0 through the whole-region fallback', () => {
      const editor = createMarkdownEditor('<p>Alpha beta</p>');
      try {
        // Position 0 is a block boundary: `regionIsPlainInline` refuses it,
        // so even a plain replacement routes through the fallback.
        const session = applyMlvEditorAiSuggestions(editor, {
          from: 0,
          to: 0,
          replacementMarkdown: 'Intro',
        });
        if (!session) throw new Error('Expected a review session.');

        expect(editor.state.doc.textContent).toContain('Intro');
        expect(editor.state.doc.textContent).toContain('Alpha beta');
        const suggestions = session.suggestions();
        expect(suggestions).toHaveLength(1);
        expect(suggestions[0].kind).toBe('replace');
        expect(suggestions[0].oldText).toBe('');
        expect(suggestions[0].newText).toContain('Intro');

        // Reject removes exactly what the application inserted.
        expect(session.reject(suggestions[0].id)).toBe(true);
        expect(editor.getHTML()).toBe('<p>Alpha beta</p>');
        expect(session.suggestions()).toEqual([]);
      } finally {
        editor.destroy();
      }
    });

    it('word-diffs non-BMP content onto correct document positions', () => {
      // An emoji is two UTF-16 code units; the token path's character-offset
      // arithmetic must line up with ProseMirror's code-unit positions.
      const editor = createMarkdownEditor('<p>Alpha 😀 beta</p>');
      try {
        const session = applyMlvEditorAiSuggestions(editor, {
          from: 1,
          to: 14,
          replacementMarkdown: 'Alpha 🎉 beta',
        });
        if (!session) throw new Error('Expected a review session.');

        expect(editor.state.doc.textContent).toBe('Alpha 🎉 beta');
        const suggestions = session.suggestions();
        expect(suggestions).toHaveLength(1);
        expect(suggestions[0]).toMatchObject({
          kind: 'replace',
          range: { from: 7, to: 9 },
          oldText: '😀',
          newText: '🎉',
        });
        expect(insertSpans(editor)).toHaveLength(1);
        expect(insertSpans(editor)[0].textContent).toBe('🎉');
        expect(deleteWidgets(editor)[0].textContent).toBe('😀');

        expect(session.reject(suggestions[0].id)).toBe(true);
        expect(editor.getHTML()).toBe('<p>Alpha 😀 beta</p>');
      } finally {
        editor.destroy();
      }
    });
  });

  it('drops only the intersected suggestion when a user edit lands inside it, without restoring', () => {
    const editor = createMarkdownEditor('<p>Alpha shiny beta</p>');
    try {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 17,
        replacementMarkdown: 'Alpha beta gamma',
      });
      if (!session) throw new Error('Expected a review session.');
      expect(session.suggestions()).toHaveLength(2);

      // Typing inside the insert suggestion's range drops that suggestion;
      // the document keeps both the user's text and the suggested text.
      expect(editor.commands.insertContentAt(13, 'Z')).toBe(true);
      expect(editor.state.doc.textContent).toBe('Alpha beta gZamma');

      const remaining = session.suggestions();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].kind).toBe('delete');
      expect(insertSpans(editor)).toHaveLength(0);
      expect(deleteWidgets(editor)).toHaveLength(1);
    } finally {
      editor.destroy();
    }
  });

  it('serializes the accepted-by-default document in all three formats during review', () => {
    const editor = createMarkdownEditor('<p>The quick brown fox</p>');
    try {
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 20,
        replacementMarkdown: 'The slow brown fox',
      });
      if (!session) throw new Error('Expected a review session.');
      // Decorations are visible in the view...
      expect(insertSpans(editor)).toHaveLength(1);
      expect(deleteWidgets(editor)).toHaveLength(1);

      // ...but every serialization is the document as-is: inserted text
      // present, removed text and decoration classes absent.
      expect(editor.getHTML()).toBe('<p>The slow brown fox</p>');
      expect(editor.getMarkdown()).toBe('The slow brown fox');
      const json = JSON.stringify(editor.getJSON());
      expect(json).toContain('The slow brown fox');
      expect(json).not.toContain('quick');
      expect(json).not.toContain(MLV_EDITOR_AI_SUGGESTION_INSERT_CLASS);
      expect(json).not.toContain(MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS);
    } finally {
      editor.destroy();
    }
  });

  it('returns null for invalid regions, unusable replacements, and no-op replacements', () => {
    const editor = createMarkdownEditor('<p>Stable</p>');
    try {
      const basePlugins = editor.state.plugins.length;
      const html = editor.getHTML();

      expect(
        applyMlvEditorAiSuggestions(editor, {
          from: -1,
          to: 4,
          replacementMarkdown: 'New',
        }),
      ).toBeNull();
      expect(
        applyMlvEditorAiSuggestions(editor, {
          from: 1,
          to: 999,
          replacementMarkdown: 'New',
        }),
      ).toBeNull();
      expect(
        applyMlvEditorAiSuggestions(editor, {
          from: 1,
          to: 7,
          replacementMarkdown: '   \n ',
        }),
      ).toBeNull();
      // A replacement identical to the region changes nothing.
      expect(
        applyMlvEditorAiSuggestions(editor, {
          from: 1,
          to: 7,
          replacementMarkdown: 'Stable',
        }),
      ).toBeNull();

      expect(editor.getHTML()).toBe(html);
      expect(editor.state.plugins.length).toBe(basePlugins);
      expect(editor.can().undo()).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('returns null when a formatted-region replacement reproduces the document', () => {
    // A bold word routes the application through the whole-region fallback —
    // the word diff refuses marked content — so the identical-output check
    // must run there too, not only on the token path.
    const editor = createMarkdownEditor('<p>He<strong>llo</strong> world</p>');
    try {
      const basePlugins = editor.state.plugins.length;
      const before = listenerCounts(editor);
      const html = editor.getHTML();

      expect(
        applyMlvEditorAiSuggestions(editor, {
          from: 1,
          to: 12,
          replacementMarkdown: 'He**llo** world',
        }),
      ).toBeNull();

      expect(editor.getHTML()).toBe(html);
      expect(editor.state.plugins.length).toBe(basePlugins);
      expect(listenerCounts(editor)).toEqual(before);
      expect(insertSpans(editor)).toHaveLength(0);
      expect(deleteWidgets(editor)).toHaveLength(0);
      expect(editor.can().undo()).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('returns null when a structural replacement reproduces the document', () => {
    const editor = createMarkdownEditor('<h1>Title</h1><p>Body</p>');
    try {
      const basePlugins = editor.state.plugins.length;
      const html = editor.getHTML();

      // The heading region falls back to the whole-region path (the parsed
      // replacement is a heading, not a paragraph) and reproduces the block.
      expect(
        applyMlvEditorAiSuggestions(editor, {
          from: 1,
          to: 6,
          replacementMarkdown: '# Title',
        }),
      ).toBeNull();

      expect(editor.getHTML()).toBe(html);
      expect(editor.state.plugins.length).toBe(basePlugins);
      expect(editor.can().undo()).toBe(false);

      // A later, genuinely changing session still starts normally.
      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 6,
        replacementMarkdown: '# Better title',
      });
      expect(session).not.toBeNull();
      session?.acceptAll();
    } finally {
      editor.destroy();
    }
  });

  it('leaves no dangling listeners or plugins after the session resolves', () => {
    const editor = createMarkdownEditor('<p>The quick brown fox</p>');
    try {
      const before = listenerCounts(editor);
      const basePlugins = editor.state.plugins.length;

      const session = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 20,
        replacementMarkdown: 'The slow brown fox',
      });
      if (!session) throw new Error('Expected a review session.');
      expect(session.acceptAll()).toBe(true);

      expect(listenerCounts(editor)).toEqual(before);
      expect(editor.state.plugins.length).toBe(basePlugins);
    } finally {
      editor.destroy();
    }
  });

  it('is inert after the editor is destroyed mid-review', () => {
    const editor = createMarkdownEditor('<p>The quick brown fox</p>');
    const session = applyMlvEditorAiSuggestions(editor, {
      from: 1,
      to: 20,
      replacementMarkdown: 'The slow brown fox',
    });
    if (!session) throw new Error('Expected a review session.');
    const [suggestion] = session.suggestions();

    editor.destroy();

    expect(session.suggestions()).toEqual([]);
    expect(session.accept(suggestion.id)).toBe(false);
    expect(session.reject(suggestion.id)).toBe(false);
    expect(session.acceptAll()).toBe(false);
    expect(session.rejectAll()).toBe(false);
  });

  it('starting a new session resolves the previous one as accepted', () => {
    const editor = createMarkdownEditor('<p>One two</p><p>Three four</p>');
    try {
      const first = applyMlvEditorAiSuggestions(editor, {
        from: 1,
        to: 8,
        replacementMarkdown: 'One TWO',
      });
      if (!first) throw new Error('Expected the first session.');
      const [firstSuggestion] = first.suggestions();

      const second = applyMlvEditorAiSuggestions(editor, {
        from: 10,
        to: 20,
        replacementMarkdown: 'Three FOUR',
      });
      if (!second) throw new Error('Expected the second session.');

      // The first session ended with its change kept (accepted-by-default)
      // and its decorations removed.
      expect(first.suggestions()).toEqual([]);
      expect(first.accept(firstSuggestion.id)).toBe(false);
      expect(editor.state.doc.textContent).toBe('One TWOThree FOUR');
      expect(insertSpans(editor)).toHaveLength(1);
      expect(insertSpans(editor)[0].textContent).toBe('FOUR');

      // The second session reviews normally.
      expect(second.reject(second.suggestions()[0].id)).toBe(true);
      expect(editor.getHTML()).toBe('<p>One TWO</p><p>Three four</p>');
    } finally {
      editor.destroy();
    }
  });

  describe('setCurrent', () => {
    it('outlines exactly the current suggestion and moves the marker with navigation', () => {
      const editor = createMarkdownEditor('<p>Alpha shiny beta</p>');
      try {
        const session = applyMlvEditorAiSuggestions(editor, {
          from: 1,
          to: 17,
          replacementMarkdown: 'Alpha beta gamma',
        });
        if (!session) throw new Error('Expected a review session.');
        const [deletion, insertion] = session.suggestions();
        expect(currentElements(editor)).toHaveLength(0);

        // The delete suggestion's widget carries the current class alone.
        expect(session.setCurrent(deletion.id)).toBe(true);
        let current = currentElements(editor);
        expect(current).toHaveLength(1);
        expect(current[0].className).toContain(
          MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS,
        );
        expect(current[0].textContent).toBe('shiny ');

        // Moving the marker outlines the insert span and clears the widget.
        expect(session.setCurrent(insertion.id)).toBe(true);
        current = currentElements(editor);
        expect(current).toHaveLength(1);
        expect(current[0].className).toContain(
          MLV_EDITOR_AI_SUGGESTION_INSERT_CLASS,
        );
        expect(current[0].textContent).toBe(' gamma');

        // Clearing removes the outline while both suggestions stay pending.
        expect(session.setCurrent(null)).toBe(true);
        expect(currentElements(editor)).toHaveLength(0);
        expect(session.suggestions()).toHaveLength(2);
      } finally {
        editor.destroy();
      }
    });

    it('refuses unknown ids and ended sessions', () => {
      const editor = createMarkdownEditor('<p>The quick brown fox</p>');
      try {
        const session = applyMlvEditorAiSuggestions(editor, {
          from: 1,
          to: 20,
          replacementMarkdown: 'The slow brown fox',
        });
        if (!session) throw new Error('Expected a review session.');
        const [suggestion] = session.suggestions();

        expect(session.setCurrent('mlv-ai-suggestion-unknown')).toBe(false);
        expect(currentElements(editor)).toHaveLength(0);

        expect(session.acceptAll()).toBe(true);
        expect(session.setCurrent(suggestion.id)).toBe(false);
        expect(session.setCurrent(null)).toBe(false);
      } finally {
        editor.destroy();
      }
    });

    it('creates no history entry and drops with a resolved suggestion', () => {
      const editor = createMarkdownEditor('<p>Alpha shiny beta</p>');
      try {
        const session = applyMlvEditorAiSuggestions(editor, {
          from: 1,
          to: 17,
          replacementMarkdown: 'Alpha beta gamma',
        });
        if (!session) throw new Error('Expected a review session.');
        const [deletion, insertion] = session.suggestions();

        // Accepting the current suggestion drops its outline with it.
        expect(session.setCurrent(deletion.id)).toBe(true);
        expect(session.accept(deletion.id)).toBe(true);
        expect(currentElements(editor)).toHaveLength(0);

        // Marking is invisible to history: with the accept also step-free,
        // exactly one undo reverts the whole application and nothing else
        // remains to undo — no setCurrent dispatch entered the history.
        expect(session.setCurrent(insertion.id)).toBe(true);
        expect(session.setCurrent(null)).toBe(true);
        expect(editor.commands.undo()).toBe(true);
        expect(editor.state.doc.textContent).toBe('Alpha shiny beta');
        expect(editor.commands.undo()).toBe(false);
      } finally {
        editor.destroy();
      }
    });

    it('drops the marker when a foreign edit drops the current suggestion', () => {
      const editor = createMarkdownEditor('<p>Alpha shiny beta</p>');
      try {
        const session = applyMlvEditorAiSuggestions(editor, {
          from: 1,
          to: 17,
          replacementMarkdown: 'Alpha beta gamma',
        });
        if (!session) throw new Error('Expected a review session.');
        const [, insertion] = session.suggestions();

        expect(session.setCurrent(insertion.id)).toBe(true);
        expect(currentElements(editor)).toHaveLength(1);

        // An edit strictly inside the current suggestion drops it — and the
        // marker with it — while the other suggestion survives the remap.
        expect(
          editor.commands.insertContentAt(insertion.range.from + 1, 'x'),
        ).toBe(true);
        expect(currentElements(editor)).toHaveLength(0);
        expect(session.suggestions()).toHaveLength(1);
        expect(session.suggestions()[0].kind).toBe('delete');
        expect(deleteWidgets(editor)).toHaveLength(1);
      } finally {
        editor.destroy();
      }
    });
  });
});
