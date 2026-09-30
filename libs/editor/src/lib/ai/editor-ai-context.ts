import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  computed,
  inject,
  Injectable,
  InjectionToken,
  signal,
} from '@angular/core';
import type { Signal } from '@angular/core';
import type { Editor } from '@tiptap/core';
import type {} from '@tiptap/markdown';
import { MLV_EDITOR_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import { mlvEditorCollaborationBlocksAi } from '../editor/editor-collaboration.contract';
import { MLV_EDITOR_TOOLBAR_CONTEXT } from '../editor-toolbar-context';
import {
  mlvEditorAiReplaceRange,
  runMlvEditorAiStream,
} from './editor-ai-stream';
import type { MlvEditorAiStreamHandle } from './editor-ai-stream';
import { applyMlvEditorAiSuggestions } from './editor-ai-suggestions';
import type { MlvEditorAiSuggestionsSession } from './editor-ai-suggestions';
import { MLV_EDITOR_AI_PROVIDER } from './editor-ai.tokens';
import type {
  MlvEditorAiOutputMode,
  MlvEditorAiProvider,
  MlvEditorAiRequest,
  MlvEditorAiReviewSuggestion,
  MlvEditorAiTransformKind,
} from './editor-ai.types';

/**
 * Lifecycle of the per-editor AI surface.
 *
 * `'idle'` — no AI work is in flight. `'running'` — a transform is streaming
 * into the document, or a `'review'` transform is collecting its result.
 * `'reviewing'` — a collected result was applied as tracked suggestions that
 * await per-change or bulk accept/reject; the state ends when the suggestion
 * set empties.
 */
export type MlvEditorAiStatus = 'idle' | 'running' | 'reviewing';

/**
 * @internal English ICU fallback for the review-started announcement, used
 * when no `MLV_EDITOR_I18N` token is provided — the same template the English
 * pack ships.
 */
const REVIEW_STARTED_FALLBACK =
  '{count, plural, one {# AI suggestion ready for review} other {# AI suggestions ready for review}}';

/**
 * @internal English ICU fallbacks for the current-suggestion descriptions,
 * used when no `MLV_EDITOR_I18N` token is provided — the same templates the
 * English pack ships.
 */
const CURRENT_SUGGESTION_FALLBACKS = {
  aiCurrentSuggestionReplace:
    'Suggestion {index} of {count}: replaces "{oldText}" with "{newText}"',
  aiCurrentSuggestionInsert:
    'Suggestion {index} of {count}: inserts "{newText}"',
  aiCurrentSuggestionDelete:
    'Suggestion {index} of {count}: removes "{oldText}"',
} as const;

/** Options accepted by {@link MlvEditorAiContext.runTransform}. */
export interface MlvEditorAiTransformOptions {
  /**
   * Free-form transform argument: the prompt for `'custom'`, the target tone
   * for `'tone'`, or the target language for `'translate'`.
   */
  readonly instruction?: string;

  /**
   * Where the streamed result lands; defaults to `'replace-selection'`.
   * `'review'` collects the complete result without touching the document
   * and applies it as reviewable tracked suggestions on success.
   */
  readonly output?: MlvEditorAiOutputMode;
}

/**
 * @internal Supplies the owning `mlv-editor`'s `aiProvider` input signal to
 * the per-editor AI context. The input wins over `MLV_EDITOR_AI_PROVIDER`,
 * mirroring the image-uploader precedence rule. Deliberately excluded from
 * the public barrels.
 */
export const MLV_EDITOR_AI_INPUT_PROVIDER = new InjectionToken<
  Signal<MlvEditorAiProvider | undefined>
>('MLV_EDITOR_AI_INPUT_PROVIDER');

/**
 * Per-editor AI command state provided by `mlv-editor`.
 *
 * The context owns provider resolution, request shaping, and the streaming
 * and review session lifecycles; the framework-free engines
 * ({@link runMlvEditorAiStream}, {@link applyMlvEditorAiSuggestions}) own
 * document mutation. Every mutation is
 * gated by the toolbar context's guard, so readonly and disabled editors
 * refuse to start AI work — controls stay visible while a provider exists
 * (presence) and disable with the editor (executability), matching the
 * toolbar's presence-vs-executability rule.
 *
 * Failures never throw or reject: they surface as recoverable
 * {@link MlvEditorError} emissions through the owning editor's `editorError`
 * output. Cancellation stays silent.
 */
@Injectable()
export class MlvEditorAiContext {
  /** @private Guarded command surface and error channel of the owning editor. */
  private readonly _toolbar = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Application-level provider used when the input supplies none. */
  private readonly _injectedProvider = inject(MLV_EDITOR_AI_PROVIDER, {
    optional: true,
  });

  /** @private The owning editor's `aiProvider` input; wins over the token. */
  private readonly _inputProvider = inject(MLV_EDITOR_AI_INPUT_PROVIDER, {
    optional: true,
  });

  /** @private Announces streaming lifecycle politely; decorations are aria-hidden. */
  private readonly _liveAnnouncer = inject(LiveAnnouncer);

  /** @private Optional translated announcement strings. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @private Resolves the ICU review-count announcement template. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /** @private Writable lifecycle state behind the readonly public signal. */
  private readonly _status = signal<MlvEditorAiStatus>('idle');

  /** @private Writable pending-suggestion projection behind the readonly signal. */
  private readonly _suggestions = signal<
    readonly MlvEditorAiReviewSuggestion[]
  >([]);

  /**
   * @private Latest streaming session. Retained after settlement so
   * {@link restoreCheckpoint} can undo a committed transform; replaced when
   * the next transform starts.
   */
  private _session: MlvEditorAiStreamHandle | null = null;

  /** @private Abort control for the in-flight provider request, if any. */
  private _abortController: AbortController | null = null;

  /**
   * @private Active review wiring: the engine session plus the teardown that
   * detaches the editor `transaction`/`destroy` listeners mirroring it into
   * {@link suggestions}. `null` outside `'reviewing'`.
   */
  private _review: {
    readonly session: MlvEditorAiSuggestionsSession;
    readonly detach: () => void;
  } | null = null;

  /**
   * @private Last suggestion id {@link revealSuggestion} announced. Repeated
   * reveals of the same suggestion (the review bar re-runs its outline effect
   * on unrelated signal updates) must not re-announce it.
   */
  private _revealedId: string | null = null;

  /** Lifecycle of the AI surface for this editor. */
  readonly status: Signal<MlvEditorAiStatus> = this._status.asReadonly();

  /**
   * Pending suggestions of the active review session, in document order.
   * Empty outside `'reviewing'`. Refreshed after every editor transaction, so
   * accept/reject calls, intersecting user edits, and an undo of the
   * application are all reflected immediately. Document ranges deliberately
   * stay internal — they remap on every transaction and would be stale the
   * moment a consumer stored them.
   */
  readonly suggestions: Signal<readonly MlvEditorAiReviewSuggestion[]> =
    this._suggestions.asReadonly();

  /**
   * Whether a review session with unresolved suggestions is active. Hosts
   * gate saves on this: during `'reviewing'` the document serializes in its
   * accepted-by-default shape (inserted text present, removed text absent).
   */
  readonly hasPendingSuggestions = computed(
    () => this._suggestions().length > 0,
  );

  /**
   * Whether an AI provider is resolvable for this editor, either through the
   * `aiProvider` input or `MLV_EDITOR_AI_PROVIDER`. AI UI modules hide
   * entirely without a provider.
   */
  readonly hasProvider = computed(() => this._resolveProvider() !== null);

  /**
   * @internal Whether {@link runTransform} would start a transform now: a
   * provider resolves, the context is `'idle'` (no transform running, no
   * review pending) and the editor is editable (created, neither disabled nor
   * readonly). It mirrors `runTransform`'s refusals, so an entry point bound
   * to it (`mlv-editor-ai-improve`, the clean-mode prompt) never offers an
   * action that would be refused.
   *
   * F-D15 (#515): AI is disabled while collaborating. The guard lives in
   * {@link _collaborationAllowsAi}, so every clean-mode AI entry point
   * (Improve, the bubble's Improve slot, the command menu's Ask AI) picks it
   * up from this one predicate.
   */
  readonly canStart = computed(
    () =>
      this.hasProvider() &&
      this._status() === 'idle' &&
      this._toolbar.editable() &&
      this._collaborationAllowsAi(),
  );

  /**
   * Runs one selection transform through the resolved provider and lands the
   * result according to the output mode: `'replace-selection'` and
   * `'insert-below'` stream into the document, while `'review'` collects the
   * complete result without writing and then applies it over the selection
   * captured at start as reviewable tracked suggestions — status moves to
   * `'reviewing'` and the suggestion surface
   * ({@link suggestions}, {@link acceptSuggestion}, …) takes over. A review
   * result identical to the region applies nothing: status returns straight
   * to `'idle'` with a polite no-changes announcement and no error.
   *
   * The returned promise resolves after the session settles and never
   * rejects; every failure is reported as a recoverable error through the
   * editor's `editorError` output instead:
   *
   * - a transform already running, or a review still pending
   *   (`configuration`) — concurrent calls are refused rather than queued,
   *   so one editor never hosts two writers and pending suggestions are
   *   never silently replaced;
   * - a readonly, disabled, or absent editor (`configuration`) — the toolbar
   *   guard refuses to start, and a `'review'` run re-checks the same guard
   *   after collection: an editor that became readonly or disabled mid-run
   *   refuses to apply the collected suggestions (checkpoint untouched — a
   *   review collection never wrote);
   * - no resolvable provider (`configuration`);
   * - a provider that throws or whose stream fails (`'ai-transport'`) — the
   *   checkpoint is restored;
   * - unusable output (`'ai-result'`) — the checkpoint is restored. Both
   *   restore paths are no-ops for `'review'`, which never wrote.
   *
   * Start, successful finish, and cancellation are announced through the CDK
   * `LiveAnnouncer` at `'polite'`; a successful `'review'` run announces the
   * pending suggestion count instead of the generic finish. A failure
   * announces nothing because the error channel already reports it.
   *
   * @param kind Transform requested from the provider.
   * @param options Optional instruction and output mode.
   */
  async runTransform(
    kind: MlvEditorAiTransformKind,
    options: MlvEditorAiTransformOptions = {},
  ): Promise<void> {
    if (this._status() !== 'idle') {
      this._reportConfiguration(
        this._status() === 'reviewing'
          ? 'An AI review is pending for this editor: resolve the suggestions before starting another transform.'
          : 'An AI transform is already running for this editor.',
      );
      return;
    }
    if (mlvEditorCollaborationBlocksAi(this._toolbar.editor())) {
      this._reportConfiguration(
        'AI transforms are not supported while collaborating (yet)',
      );
      return;
    }
    if (!this._toolbar.can(() => true)) {
      this._reportConfiguration(
        'AI transforms require an editable editor: readonly and disabled editors refuse to start.',
      );
      return;
    }
    const editor = this._toolbar.editor();
    if (!editor) return;
    const provider = this._resolveProvider();
    if (!provider) {
      this._reportConfiguration(
        'No AI provider is configured. Supply the aiProvider input or provide MLV_EDITOR_AI_PROVIDER.',
      );
      return;
    }
    const output = options.output ?? 'replace-selection';
    // Review applies over the region captured at start — the selection, or the
    // whole document body when nothing is selected (the same rule the streaming
    // replace uses; see `mlvEditorAiReplaceRange`). External edits abandon the
    // collection session, so a committed run still sees exactly this region.
    const { from: reviewFrom, to: reviewTo } = mlvEditorAiReplaceRange(editor);

    const controller = new AbortController();
    const request: MlvEditorAiRequest = {
      kind,
      ...(options.instruction === undefined
        ? {}
        : { instruction: options.instruction }),
      context: {
        selection: this._serializeSelection(editor),
        document: this._serializeDocument(editor),
      },
      signal: controller.signal,
    };

    let chunks: AsyncIterable<string>;
    try {
      chunks = provider.stream(request);
    } catch (cause: unknown) {
      this._toolbar.reportError({
        code: 'ai-transport',
        message: 'The AI provider failed to start streaming.',
        recoverable: true,
        cause,
      });
      return;
    }

    this._abortController = controller;
    this._status.set('running');
    this._announce('aiStreamingStarted', 'AI generation started');

    const session = runMlvEditorAiStream(editor, { chunks, output });
    this._session = session;
    const result = await session.done;

    if (this._abortController === controller) this._abortController = null;
    // Cancellation, abandonment, and failure all release the provider: the
    // request signal aborts so a still-producing transport stops.
    if (result.status !== 'committed') controller.abort();

    switch (result.status) {
      case 'committed':
        if (output === 'review') {
          // The guard passed at start, but the editor may have become
          // readonly or disabled while the result was collected. Applying
          // suggestions is a document mutation, so it must re-pass the
          // toolbar guard here; on refusal the checkpoint is untouched — a
          // review collection never wrote.
          if (!this._toolbar.can(() => true)) {
            this._status.set('idle');
            this._reportConfiguration(
              'The editor became readonly or disabled while the AI review result was collected: the suggestions were not applied.',
            );
            break;
          }
          this._startReview(editor, reviewFrom, reviewTo, result.text);
        } else {
          this._status.set('idle');
          this._announce('aiStreamingFinished', 'AI generation finished');
        }
        break;
      case 'cancelled':
      case 'abandoned':
        this._status.set('idle');
        this._announce('aiStreamingCancelled', 'AI generation cancelled');
        break;
      case 'failed':
        this._status.set('idle');
        this._toolbar.reportError({
          code: result.error ?? 'ai-result',
          message:
            result.error === 'ai-transport'
              ? 'The AI provider stream failed.'
              : 'The AI provider produced no usable output.',
          recoverable: true,
        });
        break;
    }
  }

  /**
   * Aborts the in-flight request and rolls the document back to the
   * checkpoint captured when the transform started.
   *
   * The provider's `AbortSignal` aborts, the streaming session restores the
   * checkpoint, and the transform resolves silently — no error is emitted
   * and only the cancellation announcement is made. A no-op while idle.
   */
  cancel(): void {
    this._abortController?.abort();
    this._abortController = null;
    this._session?.cancel();
  }

  /**
   * Restores the document to the checkpoint of the most recent transform.
   *
   * While a transform is running this behaves exactly like {@link cancel}.
   * After a committed transform it reverts the commit in one history-visible
   * step, so the restore is itself undoable. While `'reviewing'`, restoring
   * reverts the applied suggestions wholesale, which drops the suggestion
   * set and ends the review. The restore is a document mutation and
   * therefore passes the toolbar guard: readonly and disabled editors refuse
   * it. A no-op when no transform has run.
   */
  restoreCheckpoint(): void {
    if (this._status() === 'running') {
      this.cancel();
      return;
    }
    const session = this._session;
    if (!session) return;
    this._toolbar.run(() => session.restoreCheckpoint());
  }

  /**
   * Accepts one pending suggestion: the applied change stays in the document
   * and its decorations drop. Delegates to the review engine — a pure
   * plugin-state update that creates no history entry. Announces the
   * acceptance politely; when the last suggestion resolves the review ends
   * and {@link status} returns to `'idle'`.
   *
   * Refused silently — decorations stay visible, nothing changes — while no
   * review is active, the id is unknown, or the editor is readonly or
   * disabled (the same guard rule that blocks every other AI mutation).
   *
   * @param id Identifier from {@link suggestions}.
   */
  acceptSuggestion(id: string): void {
    const session = this._review?.session;
    if (!session || !this._toolbar.can(() => true)) return;
    if (session.accept(id)) {
      this._announce('aiSuggestionAccepted', 'AI suggestion accepted');
    }
  }

  /**
   * Rejects one pending suggestion: the original content is restored over
   * the suggestion's range in exactly one history-visible step and its
   * decorations drop. Announces the rejection politely; when the last
   * suggestion resolves the review ends and {@link status} returns to
   * `'idle'`.
   *
   * Refused silently while no review is active, the id is unknown, or the
   * editor is readonly or disabled — the restore is a document mutation and
   * runs through the toolbar guard.
   *
   * @param id Identifier from {@link suggestions}.
   */
  rejectSuggestion(id: string): void {
    const session = this._review?.session;
    if (!session) return;
    if (this._toolbar.run(() => session.reject(id))) {
      this._announce('aiSuggestionRejected', 'AI suggestion rejected');
    }
  }

  /**
   * Accepts every pending suggestion in one plugin-state update — no
   * document step, no history entry — then ends the review and returns
   * {@link status} to `'idle'`. Announced politely. Refused silently while
   * no review is active or the editor is readonly or disabled.
   */
  acceptAll(): void {
    const session = this._review?.session;
    if (!session || !this._toolbar.can(() => true)) return;
    if (session.acceptAll()) {
      this._announce('aiAllSuggestionsAccepted', 'All AI suggestions accepted');
    }
  }

  /**
   * Rejects every pending suggestion in exactly one history-visible step,
   * restoring the original content of the whole reviewed region, then ends
   * the review and returns {@link status} to `'idle'`. Announced politely.
   * Refused silently while no review is active or the editor is readonly or
   * disabled — the restore is a document mutation and runs through the
   * toolbar guard.
   */
  rejectAll(): void {
    const session = this._review?.session;
    if (!session) return;
    if (this._toolbar.run(() => session.rejectAll())) {
      this._announce('aiAllSuggestionsRejected', 'All AI suggestions rejected');
    }
  }

  /**
   * Outlines one pending suggestion as the current one under review and
   * scrolls its document range into view; `null` clears the outline (review
   * surfaces call that on teardown so no marker strands).
   *
   * The outline decorations are `aria-hidden`, so revealing a suggestion also
   * announces its {@link describeSuggestion} description politely — index,
   * count, and the removed/added text — the non-visual equivalent the spec
   * requires. Each suggestion is announced once per reveal: repeating the
   * current id moves nothing and re-announces nothing.
   *
   * Otherwise a pure view affordance: the outline is a decoration-only
   * plugin-state update, so no document step and no history entry is created
   * — which is why, unlike accept/reject, it stays available in readonly
   * editors, whose pending reviews remain visible and navigable. Refused
   * silently while no review is active or the id is unknown. The review bar
   * drives this from its navigation cursor.
   *
   * @param id Identifier from {@link suggestions}, or `null` to clear.
   */
  revealSuggestion(id: string | null): void {
    const session = this._review?.session;
    if (!session || !session.setCurrent(id)) return;
    if (id === null) {
      this._revealedId = null;
      return;
    }
    const editor = this._toolbar.editor();
    if (editor) {
      const target = session
        .suggestions()
        .find((suggestion) => suggestion.id === id);
      if (target) this._scrollPositionIntoView(editor, target.range.from);
    }
    if (this._revealedId !== id) {
      this._revealedId = id;
      const description = this.describeSuggestion(id);
      if (description) {
        void this._liveAnnouncer.announce(description, 'polite');
      }
    }
  }

  /**
   * Human-readable description of one pending suggestion — its one-based
   * position in the pending list plus what it replaces, inserts, or removes —
   * resolved through the `aiCurrentSuggestionReplace`/`-Insert`/`-Delete`
   * ICU templates.
   *
   * This is the non-visual equivalent of the `aria-hidden` suggestion
   * decorations: {@link revealSuggestion} announces it, and the review bar
   * additionally exposes it to its accept/reject controls through
   * `aria-describedby`, so the change under decision is inspectable without
   * sight of the decorations. Returns `null` while no review is active or
   * for an unknown id.
   *
   * @param id Identifier from {@link suggestions}.
   */
  describeSuggestion(id: string): string | null {
    const pending = this._suggestions();
    const index = pending.findIndex((suggestion) => suggestion.id === id);
    if (index < 0) return null;
    const suggestion = pending[index];
    const key =
      suggestion.kind === 'insert'
        ? 'aiCurrentSuggestionInsert'
        : suggestion.kind === 'delete'
          ? 'aiCurrentSuggestionDelete'
          : 'aiCurrentSuggestionReplace';
    const template = this._i18n?.()[key] ?? CURRENT_SUGGESTION_FALLBACKS[key];
    return this._resolver.resolve({ [key]: template }, key, {
      index: index + 1,
      count: pending.length,
      oldText: suggestion.oldText,
      newText: suggestion.newText,
    });
  }

  /**
   * @private Scrolls the rendered element at one document position into view.
   * Best effort: position resolution can fail transiently mid-transaction and
   * jsdom offers no `scrollIntoView`, so failure never fails the reveal.
   */
  private _scrollPositionIntoView(editor: Editor, position: number): void {
    try {
      const { node } = editor.view.domAtPos(position);
      const element = node instanceof HTMLElement ? node : node.parentElement;
      if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ block: 'nearest' });
      }
    } catch {
      // The outline already moved; scrolling is a progressive enhancement.
    }
  }

  /**
   * @private Routes a committed review collection through the suggestion
   * engine. An engine refusal — the replacement is identical to the region,
   * or otherwise nothing reviewable results — is the no-changes case: status
   * returns to `'idle'` with a polite announcement, no error, and no
   * document change. Otherwise the context enters `'reviewing'`, mirrors the
   * engine's suggestion set into {@link suggestions} after every editor
   * transaction (the session has no change notification of its own), and
   * announces the pending count.
   */
  private _startReview(
    editor: Editor,
    from: number,
    to: number,
    replacementMarkdown: string,
  ): void {
    const session = applyMlvEditorAiSuggestions(editor, {
      from,
      to,
      replacementMarkdown,
    });
    if (!session) {
      this._status.set('idle');
      this._announce('aiReviewNoChanges', 'The AI suggested no changes');
      return;
    }
    const synchronize = () => {
      if (this._review?.session !== session) return;
      const pending = this._projectSuggestions(session);
      this._suggestions.set(pending);
      if (pending.length === 0) this._endReview();
    };
    const onDestroy = () => {
      if (this._review?.session === session) this._endReview();
    };
    editor.on('transaction', synchronize);
    editor.on('destroy', onDestroy);
    this._revealedId = null;
    this._review = {
      session,
      detach: () => {
        editor.off('transaction', synchronize);
        editor.off('destroy', onDestroy);
      },
    };
    const pending = this._projectSuggestions(session);
    this._suggestions.set(pending);
    if (pending.length === 0) {
      // Defensive: the engine returns null rather than an empty session.
      this._endReview();
      this._announce('aiReviewNoChanges', 'The AI suggested no changes');
      return;
    }
    this._status.set('reviewing');
    this._announceReviewStarted(pending.length);
  }

  /**
   * @private Ends the review session exactly once: detaches the editor
   * listeners, clears the suggestion projection, and returns to `'idle'`.
   * Runs when the suggestion set empties — accept/reject calls, intersecting
   * edits dropping the last suggestion, or an undo of the application — and
   * when the editor is destroyed.
   */
  private _endReview(): void {
    const review = this._review;
    if (!review) return;
    this._review = null;
    this._revealedId = null;
    review.detach();
    this._suggestions.set([]);
    this._status.set('idle');
  }

  /** @private Projects engine suggestions into the range-free public shape. */
  private _projectSuggestions(
    session: MlvEditorAiSuggestionsSession,
  ): readonly MlvEditorAiReviewSuggestion[] {
    return session.suggestions().map(({ id, kind, oldText, newText }) => ({
      id,
      kind,
      oldText,
      newText,
    }));
  }

  /** @private Announces the pending review count politely through the ICU template. */
  private _announceReviewStarted(count: number): void {
    const template = this._i18n?.().aiReviewStarted ?? REVIEW_STARTED_FALLBACK;
    void this._liveAnnouncer.announce(
      this._resolver.resolve({ aiReviewStarted: template }, 'aiReviewStarted', {
        count,
      }),
      'polite',
    );
  }

  /**
   * @private F-D15 hook of {@link canStart}: `false` while the editor is
   * bound to a collaboration session — F1's "no AI while collaborating"
   * guard, the predicate {@link runTransform} refuses on — until #738 (F2)
   * lands a collaboration-safe engine. Reading the editor signal is what
   * keeps `canStart` reactive: a binding is registered in the step that
   * publishes the editor and never changes for that editor's lifetime.
   */
  private _collaborationAllowsAi(): boolean {
    return !mlvEditorCollaborationBlocksAi(this._toolbar.editor());
  }

  /** @private Resolves the active provider; the input wins over the token. */
  private _resolveProvider(): MlvEditorAiProvider | null {
    return this._inputProvider?.() ?? this._injectedProvider ?? null;
  }

  /** @private Reports a recoverable configuration refusal through the editor. */
  private _reportConfiguration(message: string): void {
    this._toolbar.reportError({
      code: 'configuration',
      message,
      recoverable: true,
    });
  }

  /** @private Announces one localized AI lifecycle message politely. */
  private _announce(
    key:
      | 'aiStreamingStarted'
      | 'aiStreamingFinished'
      | 'aiStreamingCancelled'
      | 'aiReviewNoChanges'
      | 'aiSuggestionAccepted'
      | 'aiSuggestionRejected'
      | 'aiAllSuggestionsAccepted'
      | 'aiAllSuggestionsRejected',
    fallback: string,
  ): void {
    void this._liveAnnouncer.announce(
      this._i18n?.()[key] ?? fallback,
      'polite',
    );
  }

  /**
   * @private Serializes the current selection as Markdown, or `null` when the
   * selection is empty. Uses the editor's Markdown manager — the same
   * serialization path as `getMarkdown()` — over the selection sliced into
   * its own document; a replacement extension set without Markdown falls back
   * to plain text so providers still receive usable context.
   */
  private _serializeSelection(editor: Editor): string | null {
    const { from, to } = editor.state.selection;
    if (from === to) return null;
    const manager = editor.markdown;
    if (manager) {
      try {
        const markdown = manager.serialize(
          editor.state.doc.cut(from, to).toJSON(),
        );
        if (markdown.length > 0) return markdown;
      } catch {
        // Fall back to plain text below.
      }
    }
    const text = editor.state.doc.textBetween(from, to, '\n\n');
    return text.length > 0 ? text : null;
  }

  /**
   * @private Serializes the whole document as Markdown, or `null` when the
   * document is semantically empty. The document window is currently the full
   * document; a bounded window is a later refinement. Falls back to plain
   * text when the extension set carries no Markdown manager.
   */
  private _serializeDocument(editor: Editor): string | null {
    if (editor.isEmpty) return null;
    if (typeof editor.getMarkdown === 'function' && editor.markdown) {
      try {
        const markdown = editor.getMarkdown();
        if (markdown.length > 0) return markdown;
      } catch {
        // Fall back to plain text below.
      }
    }
    const text = editor.getText();
    return text.length > 0 ? text : null;
  }
}

/** Injects the AI command state belonging to the nearest `mlv-editor`. */
export const MLV_EDITOR_AI_CONTEXT = new InjectionToken<MlvEditorAiContext>(
  'MLV_EDITOR_AI_CONTEXT',
);
