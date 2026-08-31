// Type-only, and therefore erased: the context imports this module for its
// request shapes, so a value import back would be a real module cycle.
import type { MlvEditorAiContext } from './editor-ai-context';
import type { MlvEditorAiSuggestionKind } from './editor-ai-suggestions';

/**
 * The transform kinds the library itself ships menu entries and i18n copy for.
 *
 * `'improve'`, `'fix-grammar'`, `'shorten'`, `'extend'`, and `'summarize'`
 * rewrite the selection without further arguments. `'tone'` and `'translate'`
 * carry their target tone or language in
 * {@link MlvEditorAiRequest.instruction}. `'custom'` carries a free-form host
 * or user prompt in the same field.
 */
export type MlvEditorAiBuiltInTransformKind =
  | 'improve'
  | 'fix-grammar'
  | 'shorten'
  | 'extend'
  | 'summarize'
  | 'tone'
  | 'translate'
  | 'custom';

/**
 * Selection transform requested from an AI provider: one of the
 * {@link MlvEditorAiBuiltInTransformKind} values, or any host-authored string.
 *
 * The provider owns prompting, so a kind is a name the *provider* understands
 * and is fully opaque to the editor: nothing in the library branches on it,
 * and it is forwarded verbatim on {@link MlvEditorAiRequest.kind}. A host that
 * supplies its own {@link MlvEditorAiAction} list can therefore name kinds the
 * library has never heard of (`'legal-review'`, `'to-bullets'`, …) and answer
 * them in its own provider.
 *
 * The union with `string` deliberately keeps the built-in literals in
 * autocomplete — `(string & {})` is not reduced to `string` by the compiler,
 * so editors still suggest `'improve'` while any other string remains
 * assignable. The corollary for providers: `request.kind` is not exhaustively
 * checkable, so a `switch` over it needs a `default` branch that tolerates
 * kinds it does not know.
 */
export type MlvEditorAiTransformKind =
  | MlvEditorAiBuiltInTransformKind
  | (string & {});

/**
 * One entry of the AI menu's action list.
 *
 * Hosts pass an array of these to `MlvEditorAiMenu.actions` to replace the
 * built-in list literally — see `mlvEditorAiDefaultActions()` to start from
 * the built-ins instead of retyping them.
 */
export interface MlvEditorAiAction {
  /**
   * Transform kind forwarded verbatim to the provider through
   * {@link MlvEditorAiContext.runTransform}. Any string is valid; see
   * {@link MlvEditorAiTransformKind}. Ignored when {@link run} is present.
   *
   * Kinds are not required to be unique within one list: two entries may run
   * the same kind with different instructions.
   */
  readonly kind: MlvEditorAiTransformKind;

  /**
   * Display text of the menu item, already resolved. The menu renders it as
   * given and never translates it — a localized list is built by resolving
   * the copy before constructing the actions.
   */
  readonly label: string;

  /**
   * Free-form transform argument passed through as
   * {@link MlvEditorAiRequest.instruction}: a fixed tone for `'tone'`, a fixed
   * target language for `'translate'`, or a canned prompt for `'custom'`.
   * Omitted from the request when absent. Ignored when {@link run} is present.
   */
  readonly instruction?: string;

  /**
   * Where the result lands; defaults to `'replace-selection'`. Ignored when
   * {@link run} is present.
   */
  readonly output?: MlvEditorAiOutputMode;

  /**
   * Escape hatch replacing the menu's own behaviour for this entry.
   *
   * When present the menu calls this instead of `runTransform` and reads
   * neither {@link kind}, {@link instruction}, nor {@link output} — they stay
   * available to the callback itself, which owns the whole action. The
   * argument is the live per-editor {@link MlvEditorAiContext}, so the
   * callback can call `runTransform` with anything (including options this
   * shape cannot express), chain several calls, inspect `status()` /
   * `hasProvider()` / the review surface, or do something else entirely and
   * never touch the AI context at all.
   *
   * It runs only when the item is enabled, so the readonly, disabled, and
   * already-running guards still hold.
   *
   * @param context The AI context of the editor this menu belongs to.
   */
  readonly run?: (context: MlvEditorAiContext) => void;
}

/**
 * Where the streamed result of a transform lands in the document.
 *
 * `'replace-selection'` overwrites the selected fragment in place.
 * `'insert-below'` keeps the selection and streams the result into a new
 * block after it. `'review'` collects the complete result without touching
 * the document, then lands it as reviewable tracked suggestions the user
 * accepts or rejects through the context's suggestion surface.
 */
export type MlvEditorAiOutputMode =
  | 'replace-selection'
  | 'insert-below'
  | 'review';

/**
 * One pending AI change as the Angular context exposes it to review UIs.
 *
 * A projection of the engine-level `MlvEditorAiSuggestion`: the live document
 * range stays internal to the context — positions remap on every transaction
 * and would be stale the moment a template read them. Review surfaces render
 * identity, shape, and the two texts; accept/reject go back through the
 * context by `id`.
 */
export interface MlvEditorAiReviewSuggestion {
  /** Stable identifier, unique across sessions within this runtime. */
  readonly id: string;

  /**
   * Shape of the change: `'insert'` added text, `'delete'` removed text,
   * `'replace'` swapped text.
   */
  readonly kind: MlvEditorAiSuggestionKind;

  /** Plain text the change removed; empty for `'insert'`. */
  readonly oldText: string;

  /** Plain text the change added; empty for `'delete'`. */
  readonly newText: string;
}

/**
 * One structured request handed to an {@link MlvEditorAiProvider}.
 *
 * The editor never builds a prompt: the provider receives the transform kind,
 * the optional instruction, and Markdown context, and owns prompting, model
 * choice, and server-side policy itself.
 */
export interface MlvEditorAiRequest {
  /**
   * Requested capability. Either a selection transform or `'autocomplete'`
   * for ghost-text completion at the caret.
   *
   * Not a closed union: a host-supplied action list can name any kind, so a
   * provider that branches on this field must tolerate kinds it does not
   * recognize rather than assume exhaustiveness.
   */
  readonly kind: MlvEditorAiTransformKind | 'autocomplete';

  /**
   * Free-form argument for the transform: the custom prompt for `'custom'`,
   * the target tone for `'tone'`, or the target language for `'translate'`.
   * Absent for transforms that need no argument.
   */
  readonly instruction?: string;

  /** Markdown context captured from the editor when the request started. */
  readonly context: {
    /** Selected fragment as Markdown, or `null` when nothing is selected. */
    readonly selection: string | null;

    /** Optional surrounding document window as Markdown, or `null`. */
    readonly document: string | null;
  };

  /**
   * Aborted when the user cancels, presses Escape, or edits the document
   * mid-stream. Providers should stop producing chunks once aborted.
   */
  readonly signal: AbortSignal;

  /** Host-defined passthrough metadata; the editor never reads it. */
  readonly meta?: Record<string, unknown>;
}

/**
 * Host-supplied transport for AI transforms.
 *
 * The library performs no network requests itself. Hosts provide an
 * implementation through the `aiProvider` input on `mlv-editor` or the
 * `MLV_EDITOR_AI_PROVIDER` injection token; the input wins, mirroring the
 * image-uploader precedence rule.
 */
export interface MlvEditorAiProvider {
  /**
   * Streams the result of one request as plain Markdown/text chunks.
   *
   * Non-streaming transports may return a single-chunk iterable. A thrown
   * error or rejected iteration surfaces as a recoverable `'ai-transport'`
   * editor error; unusable output surfaces as `'ai-result'`.
   *
   * @param request Structured transform or autocomplete request.
   * @returns Async iterable of Markdown/text chunks in document order.
   */
  stream(request: MlvEditorAiRequest): AsyncIterable<string>;
}
