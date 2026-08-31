import type { Editor, EditorEvents, JSONContent } from '@tiptap/core';
// Type-only: augments `Editor` with the optional `markdown` manager the final
// commit parses through. Erased at compile time, so the engine stays free of
// any runtime dependency on the Markdown extension.
import type {} from '@tiptap/markdown';
import { closeHistory } from '@tiptap/pm/history';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { MlvEditorErrorCode } from '../editor.types';
import type { MlvEditorAiOutputMode } from './editor-ai.types';

/**
 * CSS class of the inline decoration marking the active streaming region.
 *
 * The class is applied through a ProseMirror decoration held in plugin state,
 * never through document content, so it can appear in no HTML, Markdown, or
 * JSON serialization.
 */
export const MLV_EDITOR_AI_STREAMING_CLASS = 'mlv-editor__ai-streaming';

/**
 * CSS class of the one-shot inline decoration over each flush's newly
 * revealed slice of the streaming region.
 *
 * Created exactly once per revealed delta and only mapped afterwards — never
 * rebuilt for old ranges — so a one-shot CSS entrance animation runs once per
 * chunk and earlier text never re-animates. Removed with the region
 * decoration on commit, cancel, and abandonment, and excluded from every
 * serialization the same way.
 */
export const MLV_EDITOR_AI_STREAMING_CHUNK_CLASS =
  'mlv-editor__ai-streaming-chunk';

/**
 * CSS class of the `aria-hidden` widget decoration the streaming engine
 * keeps at the current insertion tip while a writing session is active.
 *
 * View-layer only: it exists in no HTML, Markdown, or JSON serialization and
 * is removed when the session settles (commit, cancel, abandonment, failure).
 * Collect-only `'review'` sessions never render it — they never write.
 */
export const MLV_EDITOR_AI_CARET_CLASS = 'mlv-editor__ai-caret';

/**
 * Output modes a streaming session supports.
 *
 * `'replace-selection'` and `'insert-below'` write into the document while
 * streaming. `'review'` is collect-only: the session runs the full lifecycle
 * — Escape cancellation, external-transaction abandonment, transport/result
 * error detection — but never writes; the caller routes the accumulated text
 * through the suggestion engine after commit.
 */
export type MlvEditorAiStreamOutputMode = MlvEditorAiOutputMode;

/**
 * Error categories a streaming session can report.
 *
 * `'ai-transport'` — the chunk iterable threw or rejected mid-stream.
 * `'ai-result'` — the completed stream produced no usable content (empty or
 * whitespace-only total output), or the target region rejected the write.
 * Both are narrowed from {@link MlvEditorErrorCode} so hosts can forward them
 * to `editorError` unchanged.
 */
export type MlvEditorAiStreamErrorCode = Extract<
  MlvEditorErrorCode,
  'ai-transport' | 'ai-result'
>;

/**
 * Terminal state of one streaming session.
 *
 * `'committed'` — the stream completed and the final content landed as exactly
 * one history-visible step. `'cancelled'` — {@link MlvEditorAiStreamHandle.cancel}
 * aborted the session and the checkpoint was restored silently. `'abandoned'`
 * — an external document change ended the session without any restore.
 * `'failed'` — the session ended with an {@link MlvEditorAiStreamErrorCode}
 * and the checkpoint was restored.
 */
export type MlvEditorAiStreamStatus =
  | 'committed'
  | 'cancelled'
  | 'abandoned'
  | 'failed';

/**
 * Schedules one buffered-chunk flush for the next animation frame.
 *
 * Receives the flush callback and returns a cancel function. The default
 * implementation uses `requestAnimationFrame` and falls back to a short
 * `setTimeout` where no frame API exists (server rendering, test DOMs).
 * Tests inject a manual scheduler to control flush timing deterministically.
 */
export type MlvEditorAiFrameScheduler = (flush: () => void) => () => void;

/** Options accepted by {@link runMlvEditorAiStream}. */
export interface MlvEditorAiStreamOptions {
  /**
   * Markdown/text chunks in document order, typically produced by an
   * `MlvEditorAiProvider`. A non-streaming source may yield a single chunk.
   */
  readonly chunks: AsyncIterable<string>;

  /**
   * Where the streamed content lands: `'replace-selection'` replaces the
   * selection captured when the session started, `'insert-below'` streams
   * into a new paragraph after the selection's top-level block, and
   * `'review'` collects the complete stream without touching the document —
   * the result is read from {@link MlvEditorAiStreamResult.text}.
   */
  readonly output: MlvEditorAiStreamOutputMode;

  /** Frame scheduler override; defaults to `requestAnimationFrame`. */
  readonly scheduler?: MlvEditorAiFrameScheduler;

  /**
   * Maximum characters one frame flush reveals into the document. Buffered
   * text beyond the cap carries over: the session keeps scheduling follow-up
   * frames until the buffer drains, so bursty provider chunks render at an
   * even typing cadence instead of appearing in per-chunk lumps. Defaults to
   * 4; `Infinity` restores the uncapped write-everything-per-frame behavior.
   * Non-finite values other than `Infinity` and values below 1 fall back to
   * the default; fractions are floored. The cap never delays settlement —
   * commit, cancellation, and abandonment still apply the complete
   * accumulated text immediately. Collect-only `'review'` sessions ignore it
   * entirely (they never flush).
   */
  readonly revealCharsPerFrame?: number;
}

/** Terminal result every streaming session resolves with; it never rejects. */
export interface MlvEditorAiStreamResult {
  /** Terminal state of the session. */
  readonly status: MlvEditorAiStreamStatus;

  /** Error category for `'failed'` sessions, `null` for every other status. */
  readonly error: MlvEditorAiStreamErrorCode | null;

  /**
   * Whether the session was stopped before completing: `true` for
   * `'cancelled'` and `'abandoned'`, `false` for `'committed'` and
   * `'failed'`. Cancellation and abandonment are silent — neither carries an
   * error code.
   */
  readonly aborted: boolean;

  /** Complete text accumulated from the stream, including unwritten chunks. */
  readonly text: string;
}

/** Handle controlling one in-flight or finished streaming session. */
export interface MlvEditorAiStreamHandle {
  /** Resolves with the terminal {@link MlvEditorAiStreamResult}; never rejects. */
  readonly done: Promise<MlvEditorAiStreamResult>;

  /**
   * Aborts an in-flight session: stops consuming chunks, restores the
   * checkpoint through a history-invisible step, and resolves {@link done}
   * with `'cancelled'` and no error. A no-op once the session has settled.
   */
  cancel(): void;

  /**
   * Restores the checkpoint captured when the session started.
   *
   * While the session is running this behaves exactly like {@link cancel}.
   * After the session has settled it replaces the whole document with the
   * checkpoint in one history-visible step — so a post-commit restore is
   * itself undoable. Returns whether the document changed; `false` when the
   * document already matches the checkpoint or the editor was destroyed.
   * After an `'abandoned'` session this overwrites the external edit too —
   * callers own that decision.
   */
  restoreCheckpoint(): boolean;
}

/** @internal Streaming target region tracked by the session plugin. */
interface MlvEditorAiStreamRegion {
  /** Document position where the streamed content begins. */
  readonly from: number;

  /** Document position where the streamed content ends. */
  readonly to: number;
}

/**
 * @internal State the session plugin holds: the tracked region plus the
 * decoration set carrying one entrance decoration per revealed chunk and the
 * caret widget at the insertion tip. Chunk decorations are created once per
 * flush and only mapped afterwards, so their DOM never rebuilds and the
 * one-shot CSS entrance cannot re-run over earlier text.
 */
interface MlvEditorAiStreamPluginState {
  /** Streaming target region, `null` before the first write. */
  readonly region: MlvEditorAiStreamRegion | null;

  /** Region tint, per-chunk entrance decorations, and the caret widget. */
  readonly decorations: DecorationSet;
}

/** @internal Transaction metadata updating or clearing the tracked region. */
type MlvEditorAiStreamMetadata =
  | {
      readonly type: 'set';
      readonly from: number;
      readonly to: number;
      /** Start of the slice this flush revealed (post-transaction position). */
      readonly chunkFrom: number;
      /** End of the slice this flush revealed (post-transaction position). */
      readonly chunkTo: number;
    }
  | { readonly type: 'clear' };

/**
 * @internal Key identifying the per-session streaming plugin. Every
 * transaction the session dispatches carries metadata under this key, which
 * is also how the external-transaction listener tells session writes apart
 * from foreign document changes.
 */
const MLV_EDITOR_AI_STREAM_KEY =
  new PluginKey<MlvEditorAiStreamPluginState | null>('mlvEditorAiStream');

/** @internal Metadata clearing the region on restore and commit transactions. */
const MLV_EDITOR_AI_CLEAR_METADATA: MlvEditorAiStreamMetadata = {
  type: 'clear',
};

/** @internal Empty plugin state shared by init and every clear. */
const MLV_EDITOR_AI_EMPTY_PLUGIN_STATE: MlvEditorAiStreamPluginState = {
  region: null,
  decorations: DecorationSet.empty,
};

/**
 * @internal Default {@link MlvEditorAiStreamOptions.revealCharsPerFrame}:
 * about four characters per frame reads as fast, steady typing at 60 fps
 * without the per-chunk lurch of uncapped writes.
 */
const MLV_EDITOR_AI_DEFAULT_REVEAL_CAP = 4;

/**
 * @internal Spec marker identifying the caret widget inside the decoration
 * set, so each flush can remove the previous caret before re-anchoring it at
 * the new insertion tip.
 */
const MLV_EDITOR_AI_CARET_SPEC = 'mlvEditorAiCaret';

/**
 * @internal Spec marker identifying the whole-region tint decoration, which
 * is rebuilt on every flush because its range grows — unlike the per-chunk
 * decorations, which are created once and only mapped.
 */
const MLV_EDITOR_AI_REGION_SPEC = 'mlvEditorAiRegion';

/**
 * @internal Normalizes the reveal cap: `Infinity` is honoured as "uncapped",
 * unusable values fall back to the default, fractions floor.
 */
const normalizeRevealCap = (value: number | undefined): number => {
  if (value === Number.POSITIVE_INFINITY) return value;
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return MLV_EDITOR_AI_DEFAULT_REVEAL_CAP;
  }
  return Math.floor(value);
};

/**
 * @internal Builds the caret widget decoration at the given insertion tip.
 * The element is created lazily by the view (browser-only, so module scope
 * stays SSR-safe) and is `aria-hidden`: the caret is a purely visual pulse,
 * not content. `side: 1` keeps it after the text already revealed. The `key`
 * lets ProseMirror treat consecutive carets at one position as identical.
 */
const createCaretDecoration = (tip: number): Decoration =>
  Decoration.widget(
    tip,
    () => {
      const caret = document.createElement('span');
      caret.className = MLV_EDITOR_AI_CARET_CLASS;
      caret.setAttribute('aria-hidden', 'true');
      return caret;
    },
    {
      key: MLV_EDITOR_AI_CARET_SPEC,
      side: 1,
      ignoreSelection: true,
      [MLV_EDITOR_AI_CARET_SPEC]: true,
    },
  );

/**
 * @internal One active session per editor. Starting a new session cancels the
 * previous one first, so the shared plugin key can never be registered twice.
 */
const activeSessions = new WeakMap<Editor, () => void>();

/**
 * @internal Default frame scheduler: `requestAnimationFrame` where available,
 * otherwise a short timeout so streaming still progresses under server
 * rendering or a test DOM without a frame API. Feature-detected at call time —
 * module scope stays SSR-safe.
 */
const defaultScheduler: MlvEditorAiFrameScheduler = (flush) => {
  if (
    typeof requestAnimationFrame === 'function' &&
    typeof cancelAnimationFrame === 'function'
  ) {
    const handle = requestAnimationFrame(() => flush());
    return () => cancelAnimationFrame(handle);
  }
  const handle = setTimeout(flush, 16);
  return () => clearTimeout(handle);
};

/**
 * @internal Creates the per-session ProseMirror plugin holding the streaming
 * region and rendering it as an inline decoration. Decorations are view-layer
 * state, so the region reaches no HTML, Markdown, or JSON serialization —
 * the upload-placeholder precedent.
 *
 * The plugin also claims Escape while it is registered — which is exactly the
 * session's lifetime — so a keyboard user whose focus is in the content
 * region can cancel a running transform without reaching for the toolbar
 * stop button.
 *
 * @param onEscape Invoked when Escape is pressed inside the content region.
 */
function createStreamPlugin(
  onEscape: () => void,
): Plugin<MlvEditorAiStreamPluginState> {
  return new Plugin<MlvEditorAiStreamPluginState>({
    key: MLV_EDITOR_AI_STREAM_KEY,
    state: {
      init: () => MLV_EDITOR_AI_EMPTY_PLUGIN_STATE,
      apply: (transaction, value) => {
        const metadata = transaction.getMeta(MLV_EDITOR_AI_STREAM_KEY) as
          | MlvEditorAiStreamMetadata
          | undefined;
        if (metadata?.type === 'clear') return MLV_EDITOR_AI_EMPTY_PLUGIN_STATE;
        // Existing chunk decorations are only ever mapped — never rebuilt —
        // so their DOM survives later flushes and the one-shot entrance
        // animation cannot re-run over earlier text.
        let decorations = transaction.docChanged
          ? value.decorations.map(transaction.mapping, transaction.doc)
          : value.decorations;
        if (metadata?.type === 'set') {
          // The region tint (its range grew) and the caret (it moved to the
          // new tip) are replaced; the newly revealed slice gets its own
          // freshly created one-shot chunk decoration.
          decorations = decorations.remove(
            decorations.find(
              undefined,
              undefined,
              (spec: Record<string, unknown>) =>
                spec[MLV_EDITOR_AI_CARET_SPEC] === true ||
                spec[MLV_EDITOR_AI_REGION_SPEC] === true,
            ),
          );
          const added: Decoration[] = [];
          if (metadata.from < metadata.to) {
            added.push(
              Decoration.inline(
                metadata.from,
                metadata.to,
                { class: MLV_EDITOR_AI_STREAMING_CLASS },
                { [MLV_EDITOR_AI_REGION_SPEC]: true },
              ),
            );
          }
          if (metadata.chunkFrom < metadata.chunkTo) {
            added.push(
              Decoration.inline(metadata.chunkFrom, metadata.chunkTo, {
                class: MLV_EDITOR_AI_STREAMING_CHUNK_CLASS,
              }),
            );
          }
          added.push(createCaretDecoration(metadata.to));
          return {
            region: { from: metadata.from, to: metadata.to },
            decorations: decorations.add(transaction.doc, added),
          };
        }
        if (!value.region || !transaction.docChanged) {
          return decorations === value.decorations
            ? value
            : { region: value.region, decorations };
        }
        // Appended transactions from other plugins move the region too; the
        // session re-reads this mapped state after every dispatch.
        return {
          region: {
            from: transaction.mapping.map(value.region.from, -1),
            to: transaction.mapping.map(value.region.to, 1),
          },
          decorations,
        };
      },
    },
    props: {
      decorations: (state: EditorState) =>
        MLV_EDITOR_AI_STREAM_KEY.getState(state)?.decorations ?? null,
      handleKeyDown: (_view, event) => {
        if (event.key !== 'Escape') return false;
        onEscape();
        return true;
      },
    },
  });
}

/**
 * Runs one AI streaming session against a live Tiptap editor.
 *
 * Framework-free: the runner needs only the editor instance and an async
 * iterable of Markdown/text chunks — no Angular, no provider token, no
 * network. Interim writes render the chunks as plain text inside the target
 * region; the final commit parses the accumulated Markdown through the
 * editor's Markdown manager, so the committed document carries real
 * structure rather than literal Markdown syntax. An editor without a
 * Markdown manager commits plain text — the same fallback the Angular
 * context uses for request serialization. The `'review'` output mode is
 * collect-only: no interim write, no decoration, and no final commit ever
 * touches the document — a `'committed'` result just carries the complete
 * text for the caller to route through the suggestion engine. Every other
 * lifecycle rule below (Escape, cancellation, abandonment, transport and
 * result errors) applies to it unchanged.
 *
 * Lifecycle:
 *
 * - A checkpoint (document JSON) and the target coordinates are captured when
 *   the session starts, before the first mutating step.
 * - Chunks are buffered and written at most once per animation frame, and
 *   each flush reveals at most {@link MlvEditorAiStreamOptions.revealCharsPerFrame}
 *   characters — the remainder carries over to self-scheduled follow-up
 *   frames, smoothing bursty providers into a steady typing cadence. Every
 *   interim write dispatches with `addToHistory: false`, so no partial state
 *   ever becomes an undo step.
 * - Each flush's newly revealed slice carries a one-shot
 *   {@link MLV_EDITOR_AI_STREAMING_CHUNK_CLASS} entrance decoration (created
 *   once, then only mapped), and an `aria-hidden`
 *   {@link MLV_EDITOR_AI_CARET_CLASS} widget marks the insertion tip while
 *   the session writes. Both are view-layer decorations: removed when the
 *   session settles and excluded from every serialization, exactly like the
 *   region tint.
 * - On successful completion the session silently reverts to the checkpoint
 *   and commits the complete content as exactly one history-visible step
 *   (closed against the previous history group): one undo restores the
 *   pre-session document.
 * - {@link MlvEditorAiStreamHandle.cancel} restores the checkpoint and
 *   resolves with `'cancelled'` — silently, with no error code. Pressing
 *   Escape inside the content region triggers the same cancellation through
 *   the session plugin's key handler.
 * - A thrown or rejected chunk iteration restores the checkpoint and resolves
 *   `'failed'` with `'ai-transport'`. Empty or whitespace-only total output
 *   restores the checkpoint and resolves `'failed'` with `'ai-result'`.
 * - **Abandonment**: any external transaction — one whose root carries no
 *   session metadata but changes the document (directly or through appended
 *   transactions) — ends the session immediately following the drag-lifecycle
 *   precedent. The session stops consuming and writing, removes its
 *   decoration, and resolves `'abandoned'` with `error: null` and
 *   `aborted: true`. **Nothing is restored**: inverting the checkpoint
 *   through foreign steps is unsafe, so the document is left exactly as the
 *   external edit made it, including any interim session writes (which were
 *   history-invisible and therefore cannot be undone individually).
 * - Destroying the editor mid-session settles it as `'abandoned'` without
 *   touching the DOM.
 *
 * The session never throws and {@link MlvEditorAiStreamHandle.done} never
 * rejects. Starting a new session on an editor cancels the session already
 * running there.
 *
 * @param editor Live Tiptap editor the session writes into.
 * @param options Chunk source, output mode, and optional frame scheduler.
 * @returns Handle exposing completion, cancellation, and checkpoint restore.
 */
/**
 * Document region a replacing AI transform writes over.
 *
 * A non-empty selection is the region. A **collapsed** selection means the user
 * asked for the transform without choosing a target — and the provider was
 * handed the whole document rather than a region (`context.selection` is `null`
 * exactly when the selection is empty) — so the result lands over the whole
 * document body: the first text position through the last, never the raw caret.
 *
 * Only replacing outputs (`'replace-selection'` streaming, `'review'` applying
 * its collected result) resolve through here. `'insert-below'` adds a block
 * after the caret's own top-level block and is unaffected.
 */
export function mlvEditorAiReplaceRange(editor: Editor): {
  readonly from: number;
  readonly to: number;
} {
  const { selection, doc } = editor.state;
  if (!selection.empty) return { from: selection.from, to: selection.to };
  return {
    from: TextSelection.atStart(doc).from,
    to: TextSelection.atEnd(doc).to,
  };
}

export function runMlvEditorAiStream(
  editor: Editor,
  options: MlvEditorAiStreamOptions,
): MlvEditorAiStreamHandle {
  const scheduler = options.scheduler ?? defaultScheduler;
  const output = options.output;
  const revealCap = normalizeRevealCap(options.revealCharsPerFrame);
  const iterator = options.chunks[Symbol.asyncIterator]();

  let resolveDone!: (result: MlvEditorAiStreamResult) => void;
  const done = new Promise<MlvEditorAiStreamResult>((resolve) => {
    resolveDone = resolve;
  });

  /** Resolves the consumption loop's race when the session settles early. */
  let notifyInterrupt: () => void = () => undefined;
  const interrupted = new Promise<'interrupted'>((resolve) => {
    notifyInterrupt = () => resolve('interrupted');
  });

  let settled = false;
  let hostDestroyed = false;
  let registered = false;
  let mutated = false;
  let accumulated = '';
  /** Characters of `accumulated` already written into the document. */
  let written = 0;
  /**
   * Characters the first (region-bootstrapping) flush wrote. Marks the exact
   * document point where prosemirror-history's deferred mapping pins the
   * `to` positions of earlier undo items (ReplaceStep maps `to` with assoc
   * -1, so later appends never move them past it); the precise revert must
   * split its steps at this point rather than replace across it.
   */
  let firstWritten = 0;
  let region: MlvEditorAiStreamRegion | null = null;
  let scheduled = false;
  let cancelScheduled: (() => void) | null = null;

  /** Politely closes the chunk producer; its cleanup must not break settlement. */
  const closeIterator = () => {
    try {
      const closing = iterator.return?.();
      if (closing) void Promise.resolve(closing).catch(() => undefined);
    } catch {
      // A producer throwing from return() has no bearing on the session result.
    }
  };

  if (editor.isDestroyed) {
    settled = true;
    closeIterator();
    resolveDone({ status: 'abandoned', error: null, aborted: true, text: '' });
    return {
      done,
      cancel: () => undefined,
      restoreCheckpoint: () => false,
    };
  }

  // One session per editor: the shared plugin key must never register twice,
  // and two writers over one region cannot both be correct.
  activeSessions.get(editor)?.();

  // Captured before the first mutating step. External document changes abandon
  // the session, and only session writes mutate otherwise, so these stay valid
  // until the session itself writes.
  const checkpoint: unknown = editor.state.doc.toJSON();
  // `'insert-below'` never replaces, so it keeps the raw caret position and its
  // caret-relative `insertAt` below.
  const { from: selectionFrom, to: selectionTo } =
    output === 'replace-selection'
      ? mlvEditorAiReplaceRange(editor)
      : editor.state.selection;
  const $to = editor.state.selection.$to;
  /** Gap after the selection's top-level block, where `'insert-below'` writes. */
  const insertAt = $to.depth === 0 ? $to.pos : $to.after(1);

  /** @internal Parses the checkpoint back into a document node. */
  const checkpointDoc = (): ProseMirrorNode =>
    ProseMirrorNode.fromJSON(editor.schema, checkpoint);

  /**
   * @internal Tries to revert only the session-written region back to the
   * checkpoint content. Preferred over replacing the whole document because
   * a whole-document replace map collapses every position inside it, which
   * would corrupt the deferred mapping prosemirror-history applies to undo
   * items recorded before the session. Returns whether the built steps are
   * usable; the caller still verifies the result equals the checkpoint.
   */
  const buildPreciseRevert = (
    tr: Transaction,
    target: ProseMirrorNode,
  ): boolean => {
    if (!region) return false;
    try {
      if (output === 'replace-selection') {
        // Earlier undo items' `to` positions sit pinned at the end of the
        // first interim write (see `firstWritten`). Splitting the revert
        // there keeps every step boundary exactly on that point, so the
        // deferred mapping prosemirror-history applies to pre-session undo
        // items never crosses the interior of a replaced range — which would
        // silently corrupt those items.
        const firstEnd = Math.min(region.from + firstWritten, region.to);
        if (firstEnd < region.to) tr.delete(firstEnd, region.to);
        tr.replace(
          region.from,
          firstEnd,
          target.slice(selectionFrom, selectionTo),
        );
      } else {
        // The streamed paragraph wraps the region by exactly one position on
        // each side; deleting it removes everything the session inserted.
        tr.delete(
          Math.max(0, region.from - 1),
          Math.min(tr.doc.content.size, region.to + 1),
        );
      }
      return true;
    } catch {
      return false;
    }
  };

  /**
   * @internal Restores the checkpoint: precisely when the region-local revert
   * verifiably reproduces it, otherwise by replacing the whole document.
   * History-visible restores close the current history group so they undo on
   * their own; invisible restores also hide from history entirely.
   */
  const restoreDoc = (historyVisible: boolean) => {
    const target = checkpointDoc();
    let tr = editor.state.tr;
    if (!buildPreciseRevert(tr, target) || !tr.doc.eq(target)) {
      tr = editor.state.tr;
      tr.replaceWith(0, tr.doc.content.size, target.content);
    }
    tr.setSelection(
      TextSelection.near(
        tr.doc.resolve(Math.min(selectionFrom, tr.doc.content.size)),
      ),
    );
    tr.setMeta(MLV_EDITOR_AI_STREAM_KEY, MLV_EDITOR_AI_CLEAR_METADATA);
    if (historyVisible) closeHistory(tr);
    else tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
  };

  /**
   * @internal Commits the streamed Markdown as parsed rich content through
   * the editor's Markdown manager, as one history-visible step against the
   * checkpoint document. A single plain paragraph replaces the selection
   * inline, so a one-line result never splits the surrounding block; every
   * other result lands as the block structure the Markdown describes.
   * Returns `false` — without dispatching a content change — when no manager
   * is registered, parsing fails or yields nothing, or the insertion is
   * refused; the caller then commits plain text instead.
   */
  const commitParsedMarkdown = (text: string): boolean => {
    const manager = editor.markdown;
    if (!manager) return false;
    let blocks: JSONContent[];
    try {
      const parsed = manager.parse(text);
      if (!Array.isArray(parsed.content) || parsed.content.length === 0) {
        return false;
      }
      blocks = parsed.content;
    } catch {
      return false;
    }
    const inline =
      output === 'replace-selection' &&
      blocks.length === 1 &&
      blocks[0].type === 'paragraph'
        ? (blocks[0].content ?? [])
        : null;
    const content = inline ?? blocks;
    if (content.length === 0) return false;
    try {
      return editor
        .chain()
        .command(({ tr }) => {
          tr.setMeta(MLV_EDITOR_AI_STREAM_KEY, MLV_EDITOR_AI_CLEAR_METADATA);
          closeHistory(tr);
          return true;
        })
        .insertContentAt(
          output === 'replace-selection'
            ? { from: selectionFrom, to: selectionTo }
            : insertAt,
          content,
        )
        .run();
    } catch {
      return false;
    }
  };

  /**
   * @internal Commits the complete streamed text as one history-visible step
   * against the checkpoint document. `closeHistory` prevents the step from
   * merging into a directly preceding user edit's undo group. Markdown
   * structure is committed through {@link commitParsedMarkdown}; the inline
   * path below is the plain-text fallback for editors without a Markdown
   * manager.
   */
  const commitFinal = (text: string) => {
    if (commitParsedMarkdown(text)) return;
    const tr = editor.state.tr;
    let end: number;
    if (output === 'replace-selection') {
      tr.insertText(text, selectionFrom, selectionTo);
      end = tr.mapping.map(selectionTo, 1);
    } else {
      const paragraph = editor.schema.nodes['paragraph'];
      if (paragraph) {
        tr.insert(insertAt, paragraph.create(null, editor.schema.text(text)));
        end = insertAt + 1 + text.length;
      } else {
        tr.insertText(text, insertAt, insertAt);
        end = tr.mapping.map(insertAt, 1);
      }
    }
    tr.setSelection(
      TextSelection.near(tr.doc.resolve(Math.min(end, tr.doc.content.size))),
    );
    tr.setMeta(MLV_EDITOR_AI_STREAM_KEY, MLV_EDITOR_AI_CLEAR_METADATA);
    closeHistory(tr);
    editor.view.dispatch(tr);
  };

  /**
   * @internal Settles the session exactly once: detaches every listener,
   * cancels pending frames, closes the producer, performs the requested
   * restore/commit, unregisters the plugin, and resolves `done`. Wrapped so a
   * failing dispatch can never surface as a thrown error — the session's
   * contract is that it never throws.
   */
  const settle = (
    status: MlvEditorAiStreamStatus,
    error: MlvEditorAiStreamErrorCode | null,
    behavior: { readonly restore: boolean; readonly commit: boolean },
  ) => {
    if (settled) return;
    settled = true;
    editor.off('transaction', onTransaction);
    editor.off('destroy', onDestroy);
    cancelScheduled?.();
    cancelScheduled = null;
    scheduled = false;
    closeIterator();
    try {
      if (!hostDestroyed && !editor.isDestroyed) {
        if (behavior.restore && mutated) restoreDoc(false);
        if (behavior.commit) commitFinal(accumulated);
        if (registered) editor.unregisterPlugin(MLV_EDITOR_AI_STREAM_KEY);
      }
    } catch {
      // Settlement must complete even when a final dispatch fails; the result
      // below still reports the session outcome.
    }
    if (activeSessions.get(editor) === cancel) activeSessions.delete(editor);
    notifyInterrupt();
    resolveDone({
      status,
      error,
      aborted: status === 'cancelled' || status === 'abandoned',
      text: accumulated,
    });
  };

  /**
   * @internal Abandons on any external document change: the root transaction
   * carries no session metadata and the document changed, either directly or
   * through transactions other plugins appended to that root. Session-rooted
   * events are skipped wholesale — reactions other plugins append to a
   * session write (for example a trailing paragraph) belong to the session.
   */
  const onTransaction = ({
    transaction,
    appendedTransactions,
  }: EditorEvents['transaction']) => {
    if (settled) return;
    if (transaction.getMeta(MLV_EDITOR_AI_STREAM_KEY) !== undefined) return;
    const docChanged =
      transaction.docChanged ||
      appendedTransactions.some((appended) => appended.docChanged);
    if (docChanged)
      settle('abandoned', null, { restore: false, commit: false });
  };

  /** @internal A destroyed editor leaves nothing to restore or unregister. */
  const onDestroy = () => {
    hostDestroyed = true;
    settle('abandoned', null, { restore: false, commit: false });
  };

  /**
   * @internal Writes the next paced slice of the accumulated text into the
   * target region. The first write bootstraps the region from the captured
   * target; later writes append at the region's end — appends only, so the
   * per-chunk entrance decorations over earlier text keep their positions and
   * DOM. Each flush reveals at most `revealCap` characters; a remaining
   * buffer schedules its own follow-up frame (carry-over), which is what
   * turns bursty chunks into a steady cadence. Region boundaries are mapped
   * through the transaction and then re-read from plugin state, so appended
   * transactions cannot desynchronize them.
   */
  const flush = () => {
    if (settled || hostDestroyed || editor.isDestroyed) return;
    const pending = accumulated.length - written;
    if (pending <= 0) return;
    const count = Math.min(pending, revealCap);
    const delta = accumulated.slice(written, written + count);
    try {
      const tr = editor.state.tr;
      let next: MlvEditorAiStreamRegion;
      let chunkFrom: number;
      if (region) {
        tr.insertText(delta, region.to, region.to);
        chunkFrom = tr.mapping.map(region.to, -1);
        next = {
          from: tr.mapping.map(region.from, -1),
          to: tr.mapping.map(region.to, 1),
        };
      } else if (output === 'replace-selection') {
        tr.insertText(delta, selectionFrom, selectionTo);
        next = {
          from: tr.mapping.map(selectionFrom, -1),
          to: tr.mapping.map(selectionTo, 1),
        };
        chunkFrom = next.from;
      } else {
        const paragraph = editor.schema.nodes['paragraph'];
        if (paragraph) {
          tr.insert(
            insertAt,
            paragraph.create(null, editor.schema.text(delta)),
          );
          next = { from: insertAt + 1, to: insertAt + 1 + delta.length };
        } else {
          tr.insertText(delta, insertAt, insertAt);
          next = {
            from: tr.mapping.map(insertAt, -1),
            to: tr.mapping.map(insertAt, 1),
          };
        }
        chunkFrom = next.from;
      }
      tr.setMeta('addToHistory', false);
      tr.setMeta(MLV_EDITOR_AI_STREAM_KEY, {
        type: 'set',
        from: next.from,
        to: next.to,
        chunkFrom,
        chunkTo: next.to,
      } satisfies MlvEditorAiStreamMetadata);
      editor.view.dispatch(tr);
      mutated = true;
      if (written === 0) firstWritten = count;
      written += count;
      region = MLV_EDITOR_AI_STREAM_KEY.getState(editor.state)?.region ?? next;
      // Carry-over: reveal the rest of the buffer on later frames.
      if (written < accumulated.length) scheduleFlush();
    } catch {
      // The target region rejected the write; the output is unusable here.
      settle('failed', 'ai-result', { restore: true, commit: false });
    }
  };

  /** @internal Schedules at most one flush per frame while chunks arrive. */
  const scheduleFlush = () => {
    if (settled || scheduled) return;
    scheduled = true;
    const cancelFrame = scheduler(() => {
      scheduled = false;
      cancelScheduled = null;
      flush();
    });
    // A synchronously invoked scheduler has already flushed by now.
    cancelScheduled = scheduled ? cancelFrame : null;
  };

  const cancel = () =>
    settle('cancelled', null, { restore: true, commit: false });

  const restoreCheckpoint = (): boolean => {
    if (hostDestroyed || editor.isDestroyed) return false;
    const changed = !editor.state.doc.eq(checkpointDoc());
    if (!settled) {
      cancel();
      return changed;
    }
    if (!changed) return false;
    try {
      restoreDoc(true);
    } catch {
      return false;
    }
    return true;
  };

  editor.registerPlugin(createStreamPlugin(() => cancel()));
  registered = true;
  editor.on('transaction', onTransaction);
  editor.on('destroy', onDestroy);
  activeSessions.set(editor, cancel);

  void (async () => {
    for (;;) {
      if (settled) return;
      const step = await Promise.race([
        interrupted,
        iterator.next().then(
          (result) => result,
          () => 'thrown' as const,
        ),
      ]);
      if (settled || step === 'interrupted') return;
      if (step === 'thrown') {
        settle('failed', 'ai-transport', { restore: true, commit: false });
        return;
      }
      if (step.done) {
        if (accumulated.trim().length === 0) {
          settle('failed', 'ai-result', { restore: true, commit: false });
        } else {
          // Collect-only review sessions never wrote, so there is nothing to
          // restore (`mutated` stayed false) and nothing to commit.
          settle('committed', null, {
            restore: true,
            commit: output !== 'review',
          });
        }
        return;
      }
      accumulated += step.value;
      // Review sessions only accumulate; a flush would write the document.
      if (output !== 'review') scheduleFlush();
    }
  })();

  return { done, cancel, restoreCheckpoint };
}
