import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it, vi } from 'vitest';
// Direct module import: the value import must not pull the whole Angular
// barrel into this suite.
import { mlvEditorDefaultExtensions } from '../extensions/editor-extensions';
import {
  MLV_EDITOR_AI_CARET_CLASS,
  MLV_EDITOR_AI_STREAMING_CHUNK_CLASS,
  MLV_EDITOR_AI_STREAMING_CLASS,
  runMlvEditorAiStream,
  type MlvEditorAiFrameScheduler,
} from './editor-ai-stream';

interface ManualScheduler {
  readonly scheduler: MlvEditorAiFrameScheduler;
  flushFrame(): void;
  scheduleCount(): number;
}

const createManualScheduler = (): ManualScheduler => {
  const pending: (() => void)[] = [];
  let calls = 0;
  return {
    scheduler: (flush) => {
      calls += 1;
      pending.push(flush);
      return () => {
        const index = pending.indexOf(flush);
        if (index >= 0) pending.splice(index, 1);
      };
    },
    flushFrame: () => {
      pending.splice(0, pending.length).forEach((flush) => flush());
    },
    scheduleCount: () => calls,
  };
};

type StreamSignal =
  | { readonly type: 'chunk'; readonly value: string }
  | { readonly type: 'end' }
  | { readonly type: 'fail'; readonly error: unknown };

interface TestStream {
  readonly iterable: AsyncIterable<string>;
  push(chunk: string): Promise<void>;
  end(): Promise<void>;
  fail(error: unknown): Promise<void>;
  wasClosed(): boolean;
}

const createTestStream = (): TestStream => {
  const queue: StreamSignal[] = [];
  const waiters: ((signal: StreamSignal) => void)[] = [];
  let closed = false;
  const deliver = (signal: StreamSignal) => {
    const waiter = waiters.shift();
    if (waiter) waiter(signal);
    else queue.push(signal);
  };
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  return {
    iterable: {
      [Symbol.asyncIterator]: () => ({
        next: () =>
          new Promise<IteratorResult<string>>((resolve, reject) => {
            const handle = (signal: StreamSignal) => {
              if (signal.type === 'chunk') {
                resolve({ value: signal.value, done: false });
              } else if (signal.type === 'end') {
                resolve({ value: undefined, done: true });
              } else {
                reject(signal.error);
              }
            };
            const queued = queue.shift();
            if (queued) handle(queued);
            else waiters.push(handle);
          }),
        return: () => {
          closed = true;
          return Promise.resolve({ value: undefined, done: true as const });
        },
      }),
    },
    push: async (chunk) => {
      deliver({ type: 'chunk', value: chunk });
      await tick();
    },
    end: async () => {
      deliver({ type: 'end' });
      await tick();
    },
    fail: async (error) => {
      deliver({ type: 'fail', error });
      await tick();
    },
    wasClosed: () => closed,
  };
};

const createEditor = (content: string) =>
  new Editor({ content, extensions: [StarterKit.configure({})] });

const listenerCounts = (editor: Editor) => {
  const callbacks = (
    editor as unknown as { callbacks: Record<string, unknown[] | undefined> }
  ).callbacks;
  return {
    transaction: callbacks['transaction']?.length ?? 0,
    destroy: callbacks['destroy']?.length ?? 0,
  };
};

describe('runMlvEditorAiStream', () => {
  it('buffers chunks between frames and assembles them across flushes', async () => {
    const editor = createEditor('<p>Alpha Beta</p>');
    try {
      editor.commands.setTextSelection({ from: 7, to: 11 });
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });

      await stream.push('Ga');
      await stream.push('mm');
      // Buffered: nothing is written until the scheduler fires, and pending
      // chunks share one scheduled frame.
      expect(editor.state.doc.textContent).toBe('Alpha Beta');
      expect(frames.scheduleCount()).toBe(1);

      frames.flushFrame();
      expect(editor.state.doc.textContent).toBe('Alpha Gamm');

      await stream.push('a');
      expect(frames.scheduleCount()).toBe(2);
      frames.flushFrame();
      expect(editor.state.doc.textContent).toBe('Alpha Gamma');

      await stream.end();
      await expect(handle.done).resolves.toEqual({
        status: 'committed',
        error: null,
        aborted: false,
        text: 'Gamma',
      });
      expect(editor.getHTML()).toBe('<p>Alpha Gamma</p>');
    } finally {
      editor.destroy();
    }
  });

  it("streams into a new paragraph after the selection's top-level block", async () => {
    const editor = createEditor('<p>One</p><p>Two</p>');
    try {
      editor.commands.setTextSelection(2);
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'insert-below',
        scheduler: frames.scheduler,
        // Uncapped: this test pins the insert-below target, not the pacing.
        revealCharsPerFrame: Infinity,
      });

      await stream.push('Inserted');
      frames.flushFrame();
      expect(editor.getHTML()).toBe('<p>One</p><p>Inserted</p><p>Two</p>');

      await stream.end();
      const result = await handle.done;
      expect(result.status).toBe('committed');
      expect(editor.getHTML()).toBe('<p>One</p><p>Inserted</p><p>Two</p>');
    } finally {
      editor.destroy();
    }
  });

  it('commits exactly one history-visible step so one undo restores the pre-session document', async () => {
    const editor = createEditor('<p>Alpha Beta</p>');
    try {
      editor.commands.setTextSelection({ from: 7, to: 11 });
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });

      await stream.push('Ga');
      frames.flushFrame();
      await stream.push('mma');
      frames.flushFrame();
      await stream.end();
      await handle.done;
      expect(editor.getHTML()).toBe('<p>Alpha Gamma</p>');

      expect(editor.commands.undo()).toBe(true);
      expect(editor.getHTML()).toBe('<p>Alpha Beta</p>');
      // The interim writes were history-invisible: nothing remains to undo.
      expect(editor.can().undo()).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("does not merge the commit into a directly preceding user edit's undo group", async () => {
    const editor = createEditor('<p>Base</p>');
    try {
      editor.commands.setTextSelection(5);
      editor.commands.insertContent(' typed');
      expect(editor.state.doc.textContent).toBe('Base typed');

      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: createManualScheduler().scheduler,
      });
      await stream.push('!');
      await stream.end();
      await handle.done;
      // The caret is collapsed, so the replace targets the whole document body
      // (see the collapsed-selection suite below); the grouping this test is
      // about is unaffected by which region was replaced.
      expect(editor.state.doc.textContent).toBe('!');

      // One undo removes the AI commit alone; the user edit keeps its own step.
      expect(editor.commands.undo()).toBe(true);
      expect(editor.state.doc.textContent).toBe('Base typed');
      expect(editor.commands.undo()).toBe(true);
      expect(editor.state.doc.textContent).toBe('Base');
    } finally {
      editor.destroy();
    }
  });

  it('keeps an earlier user edit undoable after interim writes and the commit', async () => {
    const editor = createEditor('<p>Base</p>');
    try {
      editor.commands.setTextSelection(5);
      editor.commands.insertContent(' typed');
      editor.commands.setTextSelection({ from: 6, to: 11 });

      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });
      await stream.push('wri');
      frames.flushFrame();
      await stream.push('tten');
      frames.flushFrame();
      await stream.end();
      await handle.done;
      expect(editor.state.doc.textContent).toBe('Base written');

      expect(editor.commands.undo()).toBe(true);
      expect(editor.state.doc.textContent).toBe('Base typed');
      expect(editor.commands.undo()).toBe(true);
      expect(editor.state.doc.textContent).toBe('Base');
    } finally {
      editor.destroy();
    }
  });

  it('cancel aborts silently and restores the checkpoint without a history entry', async () => {
    const editor = createEditor('<p>Alpha Beta</p>');
    try {
      editor.commands.setTextSelection({ from: 7, to: 11 });
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });

      await stream.push('Gam');
      frames.flushFrame();
      expect(editor.state.doc.textContent).toBe('Alpha Gam');

      handle.cancel();
      expect(editor.getHTML()).toBe('<p>Alpha Beta</p>');
      await expect(handle.done).resolves.toEqual({
        status: 'cancelled',
        error: null,
        aborted: true,
        text: 'Gam',
      });
      expect(editor.can().undo()).toBe(false);
      expect(stream.wasClosed()).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("cancel restores the checkpoint of an 'insert-below' session, removing the streamed paragraph", async () => {
    const editor = createEditor('<p>One</p><p>Two</p>');
    try {
      editor.commands.setTextSelection(2);
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'insert-below',
        scheduler: frames.scheduler,
        // Uncapped: this test pins cancellation, not the pacing.
        revealCharsPerFrame: Infinity,
      });

      await stream.push('Inserted');
      frames.flushFrame();
      expect(editor.getHTML()).toBe('<p>One</p><p>Inserted</p><p>Two</p>');

      handle.cancel();
      // The whole streamed paragraph is gone, not just its text: the restore
      // must remove the block 'insert-below' created, silently.
      expect(editor.getHTML()).toBe('<p>One</p><p>Two</p>');
      await expect(handle.done).resolves.toEqual({
        status: 'cancelled',
        error: null,
        aborted: true,
        text: 'Inserted',
      });
      expect(editor.can().undo()).toBe(false);
      expect(stream.wasClosed()).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("restores an 'insert-below' checkpoint and reports ai-transport when the stream throws", async () => {
    const editor = createEditor('<p>One</p><p>Two</p>');
    try {
      editor.commands.setTextSelection(2);
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'insert-below',
        scheduler: frames.scheduler,
      });

      await stream.push('Par');
      frames.flushFrame();
      expect(editor.getHTML()).toBe('<p>One</p><p>Par</p><p>Two</p>');

      await stream.fail(new Error('transport failed'));

      await expect(handle.done).resolves.toEqual({
        status: 'failed',
        error: 'ai-transport',
        aborted: false,
        text: 'Par',
      });
      expect(editor.getHTML()).toBe('<p>One</p><p>Two</p>');
      expect(editor.can().undo()).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('cancels the session when Escape is pressed in the content region', async () => {
    const editor = createEditor('<p>Alpha Beta</p>');
    try {
      editor.commands.setTextSelection({ from: 7, to: 11 });
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });

      await stream.push('Gam');
      frames.flushFrame();
      expect(editor.state.doc.textContent).toBe('Alpha Gam');

      const escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      editor.view.dom.dispatchEvent(escape);

      // The session plugin claims the key, so nothing else reacts to it.
      expect(escape.defaultPrevented).toBe(true);
      await expect(handle.done).resolves.toEqual({
        status: 'cancelled',
        error: null,
        aborted: true,
        text: 'Gam',
      });
      expect(editor.getHTML()).toBe('<p>Alpha Beta</p>');
      expect(stream.wasClosed()).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it('stops claiming Escape once the session has settled', async () => {
    const editor = createEditor('<p>Alpha Beta</p>');
    try {
      editor.commands.setTextSelection({ from: 7, to: 11 });
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: createManualScheduler().scheduler,
      });
      await stream.push('Done');
      await stream.end();
      await handle.done;

      const escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      editor.view.dom.dispatchEvent(escape);

      expect(escape.defaultPrevented).toBe(false);
      expect(editor.state.doc.textContent).toBe('Alpha Done');
    } finally {
      editor.destroy();
    }
  });

  it('commits streamed Markdown as parsed block structure, restored by one undo', async () => {
    const editor = new Editor({
      content: '<p>Saved</p>',
      extensions: mlvEditorDefaultExtensions({ format: 'markdown' }),
    });
    try {
      editor.commands.setTextSelection({ from: 1, to: 6 });
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });

      await stream.push('- Key point one\n');
      frames.flushFrame();
      await stream.push('- Key point two');
      await stream.end();

      const result = await handle.done;
      expect(result.status).toBe('committed');
      // The committed document carries a real list, not literal Markdown.
      const html = editor.getHTML();
      expect(html).toContain('<ul');
      expect(html).toContain('<li');
      expect(html).toContain('Key point one');
      expect(editor.state.doc.textContent).not.toContain('- Key');
      // The whole transform remains exactly one undo step.
      expect(editor.commands.undo()).toBe(true);
      expect(editor.getHTML()).toBe('<p>Saved</p>');
    } finally {
      editor.destroy();
    }
  });

  it('commits a one-line Markdown result inline without splitting the block', async () => {
    const editor = new Editor({
      content: '<p>Saved note</p>',
      extensions: mlvEditorDefaultExtensions({ format: 'markdown' }),
    });
    try {
      editor.commands.setTextSelection({ from: 1, to: 6 });
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });

      await stream.push('**Bold** move');
      await stream.end();

      const result = await handle.done;
      expect(result.status).toBe('committed');
      const html = editor.getHTML();
      expect(html).toContain('<strong>Bold</strong>');
      expect(html).not.toContain('**');
      // Inline replacement: the surrounding paragraph is not split.
      expect(editor.state.doc.childCount).toBe(1);
      expect(editor.state.doc.textContent).toBe('Bold move note');
    } finally {
      editor.destroy();
    }
  });

  it('restores the checkpoint and reports ai-transport when the stream throws', async () => {
    const editor = createEditor('<p>Alpha Beta</p>');
    try {
      editor.commands.setTextSelection({ from: 7, to: 11 });
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });

      await stream.push('Par');
      frames.flushFrame();
      await stream.fail(new Error('transport failed'));

      await expect(handle.done).resolves.toEqual({
        status: 'failed',
        error: 'ai-transport',
        aborted: false,
        text: 'Par',
      });
      expect(editor.getHTML()).toBe('<p>Alpha Beta</p>');
      expect(editor.can().undo()).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('restores the checkpoint and reports ai-result for whitespace-only output', async () => {
    const editor = createEditor('<p>Alpha Beta</p>');
    try {
      editor.commands.setTextSelection({ from: 7, to: 11 });
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });

      await stream.push('  ');
      frames.flushFrame();
      await stream.push(' \n');
      await stream.end();

      const result = await handle.done;
      expect(result.status).toBe('failed');
      expect(result.error).toBe('ai-result');
      expect(result.aborted).toBe(false);
      expect(result.text.trim()).toBe('');
      expect(editor.getHTML()).toBe('<p>Alpha Beta</p>');
    } finally {
      editor.destroy();
    }
  });

  it('reports ai-result for a stream that ends without any chunk', async () => {
    const editor = createEditor('<p>Alpha Beta</p>');
    try {
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: createManualScheduler().scheduler,
      });
      await stream.end();

      await expect(handle.done).resolves.toEqual({
        status: 'failed',
        error: 'ai-result',
        aborted: false,
        text: '',
      });
      expect(editor.getHTML()).toBe('<p>Alpha Beta</p>');
      expect(editor.can().undo()).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('abandons the session in place when an external transaction changes the document', async () => {
    const editor = createEditor('<p>Alpha Beta</p>');
    try {
      const basePlugins = editor.state.plugins.length;
      editor.commands.setTextSelection({ from: 7, to: 11 });
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });

      await stream.push('Str');
      frames.flushFrame();
      expect(editor.state.doc.textContent).toBe('Alpha Str');

      expect(editor.commands.insertContentAt(1, 'X')).toBe(true);

      await expect(handle.done).resolves.toEqual({
        status: 'abandoned',
        error: null,
        aborted: true,
        text: 'Str',
      });
      // Nothing is restored: the interim write and the external edit both stay.
      expect(editor.state.doc.textContent).toBe('XAlpha Str');
      expect(editor.state.plugins.length).toBe(basePlugins);
      expect(stream.wasClosed()).toBe(true);

      // Later chunks are inert once abandoned.
      await stream.push('more');
      frames.flushFrame();
      expect(editor.state.doc.textContent).toBe('XAlpha Str');
    } finally {
      editor.destroy();
    }
  });

  it("resolves 'abandoned' immediately for an already-destroyed editor", async () => {
    const editor = createEditor('<p>Gone</p>');
    editor.destroy();

    const stream = createTestStream();
    const handle = runMlvEditorAiStream(editor, {
      chunks: stream.iterable,
      output: 'replace-selection',
      scheduler: createManualScheduler().scheduler,
    });

    await expect(handle.done).resolves.toEqual({
      status: 'abandoned',
      error: null,
      aborted: true,
      text: '',
    });
    // The producer is closed even though nothing was ever consumed...
    expect(stream.wasClosed()).toBe(true);
    // ...and the settled handle stays inert: nothing exists to restore.
    handle.cancel();
    expect(handle.restoreCheckpoint()).toBe(false);
    await expect(handle.done).resolves.toMatchObject({ status: 'abandoned' });
  });

  it("settles 'abandoned' when the editor is destroyed mid-stream without touching the destroyed view", async () => {
    const editor = createEditor('<p>Alpha Beta</p>');
    try {
      editor.commands.setTextSelection({ from: 7, to: 11 });
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });

      await stream.push('Gam');
      frames.flushFrame();
      expect(editor.state.doc.textContent).toBe('Alpha Gam');

      // Any dispatch after this point would run against a destroyed view.
      const dispatch = vi.spyOn(editor.view, 'dispatch');
      editor.destroy();

      await expect(handle.done).resolves.toEqual({
        status: 'abandoned',
        error: null,
        aborted: true,
        text: 'Gam',
      });
      expect(dispatch).not.toHaveBeenCalled();
      expect(stream.wasClosed()).toBe(true);
      expect(handle.restoreCheckpoint()).toBe(false);

      // Later chunks are inert: consumption stopped with the settlement.
      await stream.push('more');
      frames.flushFrame();
      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      if (!editor.isDestroyed) editor.destroy();
    }
  });

  it('keeps the streaming, chunk, and caret decorations out of HTML, Markdown, and JSON serialization', async () => {
    const editor = new Editor({
      content: '<p>Saved</p>',
      extensions: mlvEditorDefaultExtensions({ format: 'markdown' }),
    });
    try {
      editor.commands.setTextSelection({ from: 1, to: 6 });
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
        revealCharsPerFrame: Infinity,
      });

      await stream.push('Streaming');
      frames.flushFrame();

      // The decorations are rendered in the view while the session runs...
      expect(
        editor.view.dom.querySelector(`.${MLV_EDITOR_AI_STREAMING_CLASS}`)
          ?.textContent,
      ).toBe('Streaming');
      expect(
        editor.view.dom.querySelector(`.${MLV_EDITOR_AI_STREAMING_CHUNK_CLASS}`)
          ?.textContent,
      ).toBe('Streaming');
      expect(
        editor.view.dom.querySelector(`.${MLV_EDITOR_AI_CARET_CLASS}`),
      ).not.toBeNull();
      // ...but reach none of the three serializations.
      expect(editor.getHTML()).toBe('<p>Streaming</p>');
      expect(editor.getMarkdown()).toBe('Streaming');
      const json = JSON.stringify(editor.getJSON());
      expect(json).not.toContain(MLV_EDITOR_AI_STREAMING_CLASS);
      expect(json).not.toContain(MLV_EDITOR_AI_STREAMING_CHUNK_CLASS);
      expect(json).not.toContain(MLV_EDITOR_AI_CARET_CLASS);
      expect(json).not.toContain('mlvEditorAiStream');

      await stream.end();
      await handle.done;
      expect(
        editor.view.dom.querySelector(`.${MLV_EDITOR_AI_STREAMING_CLASS}`),
      ).toBeNull();
      expect(
        editor.view.dom.querySelector(
          `.${MLV_EDITOR_AI_STREAMING_CHUNK_CLASS}`,
        ),
      ).toBeNull();
      expect(
        editor.view.dom.querySelector(`.${MLV_EDITOR_AI_CARET_CLASS}`),
      ).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it('uses the default animation-frame scheduler when none is injected', async () => {
    const editor = createEditor('<p>Live</p>');
    try {
      editor.commands.setTextSelection({ from: 1, to: 5 });
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
      });

      await stream.push('Later');
      await vi.waitFor(() =>
        expect(editor.state.doc.textContent).toBe('Later'),
      );

      await stream.end();
      const result = await handle.done;
      expect(result.status).toBe('committed');
      expect(editor.getHTML()).toBe('<p>Later</p>');
    } finally {
      editor.destroy();
    }
  });

  it('leaves no dangling listeners or plugins after completion or cancellation', async () => {
    const editor = createEditor('<p>Alpha Beta</p>');
    try {
      const before = listenerCounts(editor);
      const basePlugins = editor.state.plugins.length;
      editor.commands.setTextSelection({ from: 7, to: 11 });

      const firstFrames = createManualScheduler();
      const firstStream = createTestStream();
      const first = runMlvEditorAiStream(editor, {
        chunks: firstStream.iterable,
        output: 'replace-selection',
        scheduler: firstFrames.scheduler,
      });
      await firstStream.push('Done');
      await firstStream.end();
      await first.done;
      expect(listenerCounts(editor)).toEqual(before);
      expect(editor.state.plugins.length).toBe(basePlugins);
      expect(firstStream.wasClosed()).toBe(true);

      const secondFrames = createManualScheduler();
      const secondStream = createTestStream();
      const second = runMlvEditorAiStream(editor, {
        chunks: secondStream.iterable,
        output: 'replace-selection',
        scheduler: secondFrames.scheduler,
      });
      await secondStream.push('Gone');
      secondFrames.flushFrame();
      second.cancel();
      await second.done;
      expect(listenerCounts(editor)).toEqual(before);
      expect(editor.state.plugins.length).toBe(basePlugins);
      expect(secondStream.wasClosed()).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it('restoreCheckpoint after a commit restores the pre-session document as one undoable step', async () => {
    const editor = createEditor('<p>Alpha Beta</p>');
    try {
      editor.commands.setTextSelection({ from: 7, to: 11 });
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });
      await stream.push('Gamma');
      frames.flushFrame();
      await stream.end();
      await handle.done;
      expect(editor.getHTML()).toBe('<p>Alpha Gamma</p>');

      expect(handle.restoreCheckpoint()).toBe(true);
      expect(editor.getHTML()).toBe('<p>Alpha Beta</p>');
      // Already at the checkpoint: nothing to restore.
      expect(handle.restoreCheckpoint()).toBe(false);
      // The post-commit restore is itself one undoable step.
      expect(editor.commands.undo()).toBe(true);
      expect(editor.getHTML()).toBe('<p>Alpha Gamma</p>');
    } finally {
      editor.destroy();
    }
  });

  it('starting a second session cancels the in-flight one first', async () => {
    const editor = createEditor('<p>Alpha Beta</p>');
    try {
      editor.commands.setTextSelection({ from: 7, to: 11 });
      const firstFrames = createManualScheduler();
      const firstStream = createTestStream();
      const first = runMlvEditorAiStream(editor, {
        chunks: firstStream.iterable,
        output: 'replace-selection',
        scheduler: firstFrames.scheduler,
      });
      await firstStream.push('One');
      firstFrames.flushFrame();
      expect(editor.state.doc.textContent).toBe('Alpha One');

      const secondFrames = createManualScheduler();
      const secondStream = createTestStream();
      const second = runMlvEditorAiStream(editor, {
        chunks: secondStream.iterable,
        output: 'insert-below',
        scheduler: secondFrames.scheduler,
      });
      // The first session was cancelled and its interim write rolled back.
      expect(editor.getHTML()).toBe('<p>Alpha Beta</p>');
      const firstResult = await first.done;
      expect(firstResult.status).toBe('cancelled');

      await secondStream.push('Second');
      secondFrames.flushFrame();
      await secondStream.end();
      const secondResult = await second.done;
      expect(secondResult.status).toBe('committed');
      expect(editor.getHTML()).toBe('<p>Alpha Beta</p><p>Second</p>');
    } finally {
      editor.destroy();
    }
  });

  describe('paced reveal', () => {
    it('caps each flush at revealCharsPerFrame and carries the remainder over', async () => {
      const editor = createEditor('<p>Alpha Beta</p>');
      try {
        editor.commands.setTextSelection({ from: 7, to: 11 });
        const frames = createManualScheduler();
        const stream = createTestStream();
        const handle = runMlvEditorAiStream(editor, {
          chunks: stream.iterable,
          output: 'replace-selection',
          scheduler: frames.scheduler,
          revealCharsPerFrame: 4,
        });

        await stream.push('ABCDEFGHIJ');
        expect(frames.scheduleCount()).toBe(1);

        // Ten buffered characters at cap 4 → three flushes revealing 4/4/2.
        frames.flushFrame();
        expect(editor.state.doc.textContent).toBe('Alpha ABCD');
        // The carry-over frame is scheduled by the session itself — no new
        // chunk arrived between these flushes.
        expect(frames.scheduleCount()).toBe(2);

        frames.flushFrame();
        expect(editor.state.doc.textContent).toBe('Alpha ABCDEFGH');
        expect(frames.scheduleCount()).toBe(3);

        frames.flushFrame();
        expect(editor.state.doc.textContent).toBe('Alpha ABCDEFGHIJ');
        // Drained: nothing left to carry over.
        expect(frames.scheduleCount()).toBe(3);

        await stream.end();
        await expect(handle.done).resolves.toMatchObject({
          status: 'committed',
          text: 'ABCDEFGHIJ',
        });
        // Pacing never fractures the undo contract: one undo still restores
        // the pre-session document.
        expect(editor.commands.undo()).toBe(true);
        expect(editor.getHTML()).toBe('<p>Alpha Beta</p>');
        expect(editor.can().undo()).toBe(false);
      } finally {
        editor.destroy();
      }
    });

    it('defaults the cap to four characters per frame', async () => {
      const editor = createEditor('<p>Alpha Beta</p>');
      try {
        editor.commands.setTextSelection({ from: 7, to: 11 });
        const frames = createManualScheduler();
        const stream = createTestStream();
        runMlvEditorAiStream(editor, {
          chunks: stream.iterable,
          output: 'replace-selection',
          scheduler: frames.scheduler,
        });

        await stream.push('ABCDEF');
        frames.flushFrame();
        expect(editor.state.doc.textContent).toBe('Alpha ABCD');
        frames.flushFrame();
        expect(editor.state.doc.textContent).toBe('Alpha ABCDEF');
      } finally {
        editor.destroy();
      }
    });

    it('reveals the whole buffer per frame with revealCharsPerFrame: Infinity', async () => {
      const editor = createEditor('<p>Alpha Beta</p>');
      try {
        editor.commands.setTextSelection({ from: 7, to: 11 });
        const frames = createManualScheduler();
        const stream = createTestStream();
        runMlvEditorAiStream(editor, {
          chunks: stream.iterable,
          output: 'replace-selection',
          scheduler: frames.scheduler,
          revealCharsPerFrame: Infinity,
        });

        await stream.push('ABCDEFGHIJ');
        frames.flushFrame();
        expect(editor.state.doc.textContent).toBe('Alpha ABCDEFGHIJ');
        // Uncapped writes never need a carry-over frame.
        expect(frames.scheduleCount()).toBe(1);
      } finally {
        editor.destroy();
      }
    });

    it('cancel after several paced flushes still restores the checkpoint exactly', async () => {
      const editor = createEditor('<p>Alpha Beta</p>');
      try {
        editor.commands.setTextSelection({ from: 7, to: 11 });
        const frames = createManualScheduler();
        const stream = createTestStream();
        const handle = runMlvEditorAiStream(editor, {
          chunks: stream.iterable,
          output: 'replace-selection',
          scheduler: frames.scheduler,
          revealCharsPerFrame: 4,
        });

        await stream.push('ABCDEFGHIJ');
        frames.flushFrame();
        frames.flushFrame();
        expect(editor.state.doc.textContent).toBe('Alpha ABCDEFGH');

        handle.cancel();
        expect(editor.getHTML()).toBe('<p>Alpha Beta</p>');
        expect(editor.can().undo()).toBe(false);
        await expect(handle.done).resolves.toMatchObject({
          status: 'cancelled',
        });
      } finally {
        editor.destroy();
      }
    });

    it('commits the complete text immediately even when the buffer has not drained', async () => {
      const editor = createEditor('<p>Alpha Beta</p>');
      try {
        editor.commands.setTextSelection({ from: 7, to: 11 });
        const frames = createManualScheduler();
        const stream = createTestStream();
        const handle = runMlvEditorAiStream(editor, {
          chunks: stream.iterable,
          output: 'replace-selection',
          scheduler: frames.scheduler,
          revealCharsPerFrame: 4,
        });

        await stream.push('ABCDEFGHIJ');
        frames.flushFrame();
        expect(editor.state.doc.textContent).toBe('Alpha ABCD');

        // Settlement outruns pacing: the commit applies the full accumulated
        // text without waiting for the remaining carry-over frames.
        await stream.end();
        await expect(handle.done).resolves.toMatchObject({
          status: 'committed',
          text: 'ABCDEFGHIJ',
        });
        expect(editor.getHTML()).toBe('<p>Alpha ABCDEFGHIJ</p>');
      } finally {
        editor.destroy();
      }
    });
  });

  describe('streaming decorations', () => {
    it('gives each revealed slice its own one-shot chunk decoration and never rebuilds earlier ones', async () => {
      const editor = createEditor('<p>Alpha Beta</p>');
      try {
        editor.commands.setTextSelection({ from: 7, to: 11 });
        const frames = createManualScheduler();
        const stream = createTestStream();
        const handle = runMlvEditorAiStream(editor, {
          chunks: stream.iterable,
          output: 'replace-selection',
          scheduler: frames.scheduler,
          revealCharsPerFrame: 4,
        });
        const chunks = () => [
          ...editor.view.dom.querySelectorAll(
            `.${MLV_EDITOR_AI_STREAMING_CHUNK_CLASS}`,
          ),
        ];

        await stream.push('ABCDEFGHIJ');
        frames.flushFrame();
        expect(chunks().map((span) => span.textContent)).toEqual(['ABCD']);
        const firstChunk = chunks()[0];

        frames.flushFrame();
        expect(chunks().map((span) => span.textContent)).toEqual([
          'ABCD',
          'EFGH',
        ]);
        // The first chunk's decoration was mapped, not recreated: the same
        // DOM element persists, so its one-shot entrance cannot re-run.
        expect(chunks()[0]).toBe(firstChunk);

        frames.flushFrame();
        expect(chunks().map((span) => span.textContent)).toEqual([
          'ABCD',
          'EFGH',
          'IJ',
        ]);
        expect(chunks()[0]).toBe(firstChunk);
        // The whole-region streaming tint still spans every revealed chunk.
        expect(
          [
            ...editor.view.dom.querySelectorAll(
              `.${MLV_EDITOR_AI_STREAMING_CLASS}`,
            ),
          ]
            .map((span) => span.textContent)
            .join(''),
        ).toBe('ABCDEFGHIJ');

        await stream.end();
        await handle.done;
        expect(chunks()).toEqual([]);
      } finally {
        editor.destroy();
      }
    });

    it('anchors one aria-hidden caret widget at the insertion tip and removes it on commit', async () => {
      const editor = createEditor('<p>Alpha Beta</p>');
      try {
        editor.commands.setTextSelection({ from: 7, to: 11 });
        const frames = createManualScheduler();
        const stream = createTestStream();
        const handle = runMlvEditorAiStream(editor, {
          chunks: stream.iterable,
          output: 'replace-selection',
          scheduler: frames.scheduler,
        });

        await stream.push('Gamma');
        frames.flushFrame();

        const carets = editor.view.dom.querySelectorAll(
          `.${MLV_EDITOR_AI_CARET_CLASS}`,
        );
        expect(carets.length).toBe(1);
        expect(carets[0].getAttribute('aria-hidden')).toBe('true');
        // The caret sits at the tip: immediately after the newest chunk.
        expect(
          carets[0].previousElementSibling?.classList.contains(
            MLV_EDITOR_AI_STREAMING_CHUNK_CLASS,
          ),
        ).toBe(true);

        await stream.end();
        await handle.done;
        expect(
          editor.view.dom.querySelector(`.${MLV_EDITOR_AI_CARET_CLASS}`),
        ).toBeNull();
      } finally {
        editor.destroy();
      }
    });

    it('removes the caret and chunk decorations on cancel and on abandonment', async () => {
      const editor = createEditor('<p>Alpha Beta</p>');
      try {
        editor.commands.setTextSelection({ from: 7, to: 11 });
        const firstFrames = createManualScheduler();
        const firstStream = createTestStream();
        const first = runMlvEditorAiStream(editor, {
          chunks: firstStream.iterable,
          output: 'replace-selection',
          scheduler: firstFrames.scheduler,
        });
        await firstStream.push('Gamma');
        firstFrames.flushFrame();
        expect(
          editor.view.dom.querySelector(`.${MLV_EDITOR_AI_CARET_CLASS}`),
        ).not.toBeNull();

        first.cancel();
        await first.done;
        expect(
          editor.view.dom.querySelector(`.${MLV_EDITOR_AI_CARET_CLASS}`),
        ).toBeNull();
        expect(
          editor.view.dom.querySelector(
            `.${MLV_EDITOR_AI_STREAMING_CHUNK_CLASS}`,
          ),
        ).toBeNull();

        editor.commands.setTextSelection({ from: 7, to: 11 });
        const secondFrames = createManualScheduler();
        const secondStream = createTestStream();
        const second = runMlvEditorAiStream(editor, {
          chunks: secondStream.iterable,
          output: 'replace-selection',
          scheduler: secondFrames.scheduler,
        });
        await secondStream.push('Delta');
        secondFrames.flushFrame();
        expect(
          editor.view.dom.querySelector(`.${MLV_EDITOR_AI_CARET_CLASS}`),
        ).not.toBeNull();

        // Abandonment keeps the interim text but strips every decoration.
        expect(editor.commands.insertContentAt(1, 'X')).toBe(true);
        await expect(second.done).resolves.toMatchObject({
          status: 'abandoned',
        });
        expect(editor.state.doc.textContent).toContain('Delt');
        expect(
          editor.view.dom.querySelector(`.${MLV_EDITOR_AI_CARET_CLASS}`),
        ).toBeNull();
        expect(
          editor.view.dom.querySelector(
            `.${MLV_EDITOR_AI_STREAMING_CHUNK_CLASS}`,
          ),
        ).toBeNull();
      } finally {
        editor.destroy();
      }
    });
  });

  describe("collect-only 'review' output", () => {
    it('collects the complete text without writing, scheduling, or history entries', async () => {
      const editor = createEditor('<p>Alpha Beta</p>');
      try {
        editor.commands.setTextSelection({ from: 7, to: 11 });
        const frames = createManualScheduler();
        const stream = createTestStream();
        const handle = runMlvEditorAiStream(editor, {
          chunks: stream.iterable,
          output: 'review',
          scheduler: frames.scheduler,
        });

        await stream.push('Ga');
        await stream.push('mma');
        // Collect-only: chunks never schedule a frame, so nothing can write,
        // and no decoration of any kind — region, chunk, caret — renders.
        expect(frames.scheduleCount()).toBe(0);
        expect(editor.state.doc.textContent).toBe('Alpha Beta');
        expect(
          editor.view.dom.querySelector(`.${MLV_EDITOR_AI_STREAMING_CLASS}`),
        ).toBeNull();
        expect(
          editor.view.dom.querySelector(
            `.${MLV_EDITOR_AI_STREAMING_CHUNK_CLASS}`,
          ),
        ).toBeNull();
        expect(
          editor.view.dom.querySelector(`.${MLV_EDITOR_AI_CARET_CLASS}`),
        ).toBeNull();

        await stream.end();
        await expect(handle.done).resolves.toEqual({
          status: 'committed',
          error: null,
          aborted: false,
          text: 'Gamma',
        });
        // Committed without a document change or an undoable step.
        expect(editor.getHTML()).toBe('<p>Alpha Beta</p>');
        expect(editor.can().undo()).toBe(false);
      } finally {
        editor.destroy();
      }
    });

    it('still cancels via Escape, leaving the document untouched', async () => {
      const editor = createEditor('<p>Alpha Beta</p>');
      try {
        const frames = createManualScheduler();
        const stream = createTestStream();
        const handle = runMlvEditorAiStream(editor, {
          chunks: stream.iterable,
          output: 'review',
          scheduler: frames.scheduler,
        });
        await stream.push('Partial');

        const escape = new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        });
        editor.view.dom.dispatchEvent(escape);
        expect(escape.defaultPrevented).toBe(true);

        const result = await handle.done;
        expect(result.status).toBe('cancelled');
        expect(result.aborted).toBe(true);
        expect(editor.getHTML()).toBe('<p>Alpha Beta</p>');
      } finally {
        editor.destroy();
      }
    });

    it('abandons on an external document change and fails on empty output', async () => {
      const editor = createEditor('<p>Alpha Beta</p>');
      try {
        const frames = createManualScheduler();
        const stream = createTestStream();
        const handle = runMlvEditorAiStream(editor, {
          chunks: stream.iterable,
          output: 'review',
          scheduler: frames.scheduler,
        });
        await stream.push('Partial');
        expect(editor.commands.insertContentAt(1, 'X')).toBe(true);
        const abandoned = await handle.done;
        expect(abandoned.status).toBe('abandoned');
        expect(editor.state.doc.textContent).toBe('XAlpha Beta');

        editor.commands.undo();
        const emptyStream = createTestStream();
        const emptyHandle = runMlvEditorAiStream(editor, {
          chunks: emptyStream.iterable,
          output: 'review',
          scheduler: frames.scheduler,
        });
        await emptyStream.push('   \n');
        await emptyStream.end();
        const failed = await emptyHandle.done;
        expect(failed.status).toBe('failed');
        expect(failed.error).toBe('ai-result');
        expect(editor.state.doc.textContent).toBe('Alpha Beta');
      } finally {
        editor.destroy();
      }
    });
  });
});

/**
 * A replacing transform with nothing selected has no target of its own, and the
 * provider is handed the whole document (`selection: null`, `document: <doc>`)
 * — so the result has to land over the whole document body, not at the caret.
 * `'insert-below'` never replaces, so it keeps its caret-relative behaviour.
 */
describe('runMlvEditorAiStream collapsed-selection target', () => {
  it('replaces the whole document body when nothing is selected', async () => {
    const editor = createEditor('<p>Alpha</p><p>Beta</p>');
    try {
      editor.commands.setTextSelection(3);
      expect(editor.state.selection.empty).toBe(true);
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });

      await stream.push('Rewritten');
      frames.flushFrame();
      await stream.end();
      await handle.done;

      expect(editor.state.doc.textContent).toBe('Rewritten');
    } finally {
      editor.destroy();
    }
  });

  it('still replaces only the selection when there is one', async () => {
    const editor = createEditor('<p>Alpha</p><p>Beta</p>');
    try {
      editor.commands.setTextSelection({ from: 1, to: 6 });
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });

      await stream.push('Omega');
      frames.flushFrame();
      await stream.end();
      await handle.done;

      expect(editor.state.doc.textContent).toBe('OmegaBeta');
    } finally {
      editor.destroy();
    }
  });

  it('leaves insert-below anchored to the caret block', async () => {
    const editor = createEditor('<p>Alpha</p><p>Beta</p>');
    try {
      editor.commands.setTextSelection(3);
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'insert-below',
        scheduler: frames.scheduler,
      });

      await stream.push('Added');
      frames.flushFrame();
      await stream.end();
      await handle.done;

      expect(editor.state.doc.textContent).toBe('AlphaAddedBeta');
    } finally {
      editor.destroy();
    }
  });

  it('restores the checkpoint after a whole-document replace is cancelled', async () => {
    const editor = createEditor('<p>Alpha</p><p>Beta</p>');
    try {
      editor.commands.setTextSelection(3);
      const frames = createManualScheduler();
      const stream = createTestStream();
      const handle = runMlvEditorAiStream(editor, {
        chunks: stream.iterable,
        output: 'replace-selection',
        scheduler: frames.scheduler,
      });

      await stream.push('Rewritten');
      frames.flushFrame();
      handle.cancel();
      await handle.done;

      expect(editor.state.doc.textContent).toBe('AlphaBeta');
    } finally {
      editor.destroy();
    }
  });
});
