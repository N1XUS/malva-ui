import type { Editor, JSONContent } from '@tiptap/core';
// Type-only: augments `Editor` with the optional `markdown` manager the
// replacement is parsed through. Erased at compile time, so the engine stays
// free of any runtime dependency on the Markdown extension.
import type {} from '@tiptap/markdown';
import { closeHistory } from '@tiptap/pm/history';
import { Fragment, Slice } from '@tiptap/pm/model';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { Mapping } from '@tiptap/pm/transform';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * CSS class of the inline decoration highlighting text a pending suggestion
 * inserted into the document.
 *
 * The class is applied through a ProseMirror decoration held in plugin state,
 * never through document content, so it can appear in no HTML, Markdown, or
 * JSON serialization.
 */
export const MLV_EDITOR_AI_SUGGESTION_INSERT_CLASS =
  'mlv-editor__ai-suggestion-insert';

/**
 * CSS class of the widget decoration rendering text a pending suggestion
 * removed from the document.
 *
 * The removed text lives only inside the widget element — a strikethrough,
 * `aria-hidden` affordance — so it is absent from the document and from every
 * serialization the moment the suggestion is applied.
 */
export const MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS =
  'mlv-editor__ai-suggestion-delete';

/**
 * CSS class added on top of the insert and delete decorations of the one
 * suggestion a review surface currently navigates
 * ({@link MlvEditorAiSuggestionsSession.setCurrent}).
 *
 * A decoration-only outline affordance: it never enters document content or
 * any serialization, and marking a suggestion current dispatches no document
 * step, so it can never create a history entry.
 */
export const MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS =
  'mlv-editor__ai-suggestion-current';

/**
 * Shape of one reviewable change.
 *
 * `'insert'` — new text was added; reject removes it. `'delete'` — text was
 * removed; reject restores it. `'replace'` — text was swapped; reject
 * restores the original.
 */
export type MlvEditorAiSuggestionKind = 'insert' | 'delete' | 'replace';

/** Document range a suggestion currently occupies. */
export interface MlvEditorAiSuggestionRange {
  /** Start position of the suggestion's inserted content. */
  readonly from: number;

  /**
   * End position of the suggestion's inserted content. Equals {@link from}
   * for `'delete'` suggestions, whose removed text exists only in the widget
   * decoration anchored at this collapsed position.
   */
  readonly to: number;
}

/** One pending, reviewable AI change. */
export interface MlvEditorAiSuggestion {
  /** Stable identifier, unique across sessions within this runtime. */
  readonly id: string;

  /** Shape of the change. */
  readonly kind: MlvEditorAiSuggestionKind;

  /**
   * Current document range of the inserted content, remapped through every
   * concurrent transaction. Collapsed for `'delete'` suggestions.
   */
  readonly range: MlvEditorAiSuggestionRange;

  /** Plain text the change removed; empty for `'insert'`. */
  readonly oldText: string;

  /** Plain text the change added; empty for `'delete'`. */
  readonly newText: string;
}

/** Options accepted by {@link applyMlvEditorAiSuggestions}. */
export interface MlvEditorAiSuggestionsOptions {
  /** Start of the document region the replacement rewrites. */
  readonly from: number;

  /** End of the document region the replacement rewrites. */
  readonly to: number;

  /**
   * AI-produced replacement for the region, as Markdown. Parsed through the
   * editor's Markdown manager when one is registered; treated as plain text
   * otherwise — the same fallback the streaming engine uses for its commit.
   */
  readonly replacementMarkdown: string;
}

/**
 * Handle over one review session created by {@link applyMlvEditorAiSuggestions}.
 *
 * Undo semantics — a deliberate refinement of the spec sentence "each
 * accept/reject = one undo step": in the applied-edits storage model the
 * document already carries every change, so **accepting changes no document
 * content**. Accept operations (including {@link acceptAll}) are pure
 * plugin-state updates that drop decorations and entries without dispatching
 * a single step, and therefore create **no** history entry — an "accept undo
 * step" would necessarily be an empty one. Rejects mutate the document:
 * {@link reject} is exactly one history-visible step per call, and
 * {@link rejectAll} is exactly one step total.
 *
 * Every method returns `false` once the session has ended — all suggestions
 * resolved, the application undone, a newer session started, or the editor
 * destroyed.
 */
export interface MlvEditorAiSuggestionsSession {
  /**
   * Current pending suggestions in document order, with ranges remapped
   * through every transaction dispatched since application. Empty once the
   * session has ended.
   */
  suggestions(): readonly MlvEditorAiSuggestion[];

  /**
   * Accepts one suggestion: the applied change stays in the document and its
   * decorations are dropped. A pure plugin-state update — no document step,
   * no history entry. Returns whether the suggestion existed.
   */
  accept(id: string): boolean;

  /**
   * Rejects one suggestion: the original content is restored over the
   * suggestion's current range in exactly one history-visible step, and the
   * suggestion's decorations are dropped. Returns whether the suggestion
   * existed and the restore succeeded.
   *
   * Restored is the reviewed region, not the editor's own schema-maintenance
   * reactions to the suggested state: for example, the default preset's
   * `trailingNode` paragraph appended while a structural suggestion was the
   * last block stays behind — the same residue an ordinary user edit leaves.
   */
  reject(id: string): boolean;

  /**
   * Accepts every pending suggestion in one plugin-state update. Like
   * {@link accept}, dispatches no document step and creates no history
   * entry. Returns whether any suggestion was pending.
   */
  acceptAll(): boolean;

  /**
   * Rejects every pending suggestion in exactly one history-visible step,
   * restoring the original content of the whole reviewed region. Returns
   * whether any suggestion was pending and the restore succeeded.
   */
  rejectAll(): boolean;

  /**
   * Marks one suggestion as the current one under review: its decorations
   * gain {@link MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS} and the previous
   * current suggestion loses it. `null` clears the marker. Like
   * {@link accept}, a pure plugin-state update — no document step, no
   * history entry. The marker clears itself when its suggestion resolves or
   * is dropped by a concurrent edit. Returns `false` once the session has
   * ended or for an unknown id.
   */
  setCurrent(id: string | null): boolean;
}

/** One contiguous change between two texts, produced by {@link mlvEditorAiWordDiff}. */
export interface MlvEditorAiWordDiffRun {
  /** Shape of the change at this position. */
  readonly kind: MlvEditorAiSuggestionKind;

  /** Inclusive character offset in the old text where the run starts. */
  readonly oldFrom: number;

  /**
   * Exclusive character offset in the old text where the run ends. Equals
   * {@link oldFrom} for `'insert'` runs.
   */
  readonly oldTo: number;

  /** Old text covered by the run; empty for `'insert'`. */
  readonly oldText: string;

  /** New text the run introduces; empty for `'delete'`. */
  readonly newText: string;
}

/**
 * @internal Cell budget for the LCS table. Two texts whose token counts
 * multiply past this bound (only reachable with degenerate, book-length
 * "paragraphs") skip the quadratic diff and collapse to one replace run.
 */
const MAX_DIFF_CELLS = 1_000_000;

/** @internal Splits text into alternating whitespace and word tokens; the tokens partition the input exactly. */
const tokenize = (text: string): string[] => text.match(/\s+|\S+/g) ?? [];

/**
 * Token-level word diff between two plain texts, computed over a
 * longest-common-subsequence of tokens. Tokens are maximal whitespace or
 * non-whitespace runs, so whitespace changes are diffed like words.
 * Consecutive non-equal tokens merge into one run; a run that both removes
 * and adds text is a `'replace'`.
 *
 * Pure and framework-free. Returns an empty array for identical inputs.
 *
 * @param oldText Text currently in the document.
 * @param newText Replacement text.
 * @returns Change runs in ascending old-text offset order.
 */
export function mlvEditorAiWordDiff(
  oldText: string,
  newText: string,
): readonly MlvEditorAiWordDiffRun[] {
  if (oldText === newText) return [];
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  let prefix = 0;
  while (
    prefix < oldTokens.length &&
    prefix < newTokens.length &&
    oldTokens[prefix] === newTokens[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < oldTokens.length - prefix &&
    suffix < newTokens.length - prefix &&
    oldTokens[oldTokens.length - 1 - suffix] ===
      newTokens[newTokens.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const oldCore = oldTokens.slice(prefix, oldTokens.length - suffix);
  const newCore = newTokens.slice(prefix, newTokens.length - suffix);

  // Edit script over the cores as (op, token) pairs in document order.
  const ops: {
    readonly op: 'equal' | 'del' | 'ins';
    readonly token: string;
  }[] = [];
  if ((oldCore.length + 1) * (newCore.length + 1) > MAX_DIFF_CELLS) {
    // Degenerate size: one whole-core replacement instead of an LCS walk.
    oldCore.forEach((token) => ops.push({ op: 'del', token }));
    newCore.forEach((token) => ops.push({ op: 'ins', token }));
  } else {
    // dp[i][j] = LCS length of oldCore[i..] and newCore[j..].
    const width = newCore.length + 1;
    const dp = new Uint32Array((oldCore.length + 1) * width);
    for (let i = oldCore.length - 1; i >= 0; i--) {
      for (let j = newCore.length - 1; j >= 0; j--) {
        dp[i * width + j] =
          oldCore[i] === newCore[j]
            ? dp[(i + 1) * width + j + 1] + 1
            : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < oldCore.length && j < newCore.length) {
      if (oldCore[i] === newCore[j]) {
        ops.push({ op: 'equal', token: oldCore[i] });
        i += 1;
        j += 1;
      } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
        ops.push({ op: 'del', token: oldCore[i] });
        i += 1;
      } else {
        ops.push({ op: 'ins', token: newCore[j] });
        j += 1;
      }
    }
    while (i < oldCore.length) ops.push({ op: 'del', token: oldCore[i++] });
    while (j < newCore.length) ops.push({ op: 'ins', token: newCore[j++] });
  }

  const runs: MlvEditorAiWordDiffRun[] = [];
  let oldPos = oldTokens.slice(0, prefix).join('').length;
  let pendingStart = -1;
  let pendingOld = '';
  let pendingNew = '';
  const flush = () => {
    if (pendingStart < 0) return;
    if (pendingOld.length > 0 && pendingNew.length > 0) {
      runs.push({
        kind: 'replace',
        oldFrom: pendingStart,
        oldTo: pendingStart + pendingOld.length,
        oldText: pendingOld,
        newText: pendingNew,
      });
    } else if (pendingOld.length > 0) {
      runs.push({
        kind: 'delete',
        oldFrom: pendingStart,
        oldTo: pendingStart + pendingOld.length,
        oldText: pendingOld,
        newText: '',
      });
    } else {
      runs.push({
        kind: 'insert',
        oldFrom: pendingStart,
        oldTo: pendingStart,
        oldText: '',
        newText: pendingNew,
      });
    }
    pendingStart = -1;
    pendingOld = '';
    pendingNew = '';
  };
  for (const { op, token } of ops) {
    if (op === 'equal') {
      flush();
      oldPos += token.length;
    } else if (op === 'del') {
      if (pendingStart < 0) pendingStart = oldPos;
      pendingOld += token;
      oldPos += token.length;
    } else {
      if (pendingStart < 0) pendingStart = oldPos;
      pendingNew += token;
    }
  }
  flush();
  return runs;
}

/** @internal One pending change tracked by the suggestion plugin. */
interface MlvEditorAiSuggestionEntry {
  readonly id: string;
  readonly kind: MlvEditorAiSuggestionKind;
  /** Current start of the inserted content (widget anchor for `'delete'`). */
  readonly from: number;
  /** Current end of the inserted content; equals `from` for `'delete'`. */
  readonly to: number;
  readonly oldText: string;
  readonly newText: string;
  /** Original content a reject restores over `[from, to]`; empty for `'insert'`. */
  readonly inverted: Slice;
}

/** @internal State the per-session suggestion plugin holds. */
interface MlvEditorAiSuggestionsPluginState {
  readonly entries: readonly MlvEditorAiSuggestionEntry[];
  /** Entry currently outlined for review navigation, if any. */
  readonly currentId: string | null;
  readonly decorations: DecorationSet;
}

/** @internal Transaction metadata driving the suggestion plugin. */
type MlvEditorAiSuggestionsMetadata =
  | {
      readonly type: 'init';
      readonly entries: readonly MlvEditorAiSuggestionEntry[];
    }
  | { readonly type: 'drop'; readonly ids: readonly string[] }
  | { readonly type: 'clear' }
  | { readonly type: 'current'; readonly id: string | null };

/**
 * @internal Key identifying the per-session suggestion plugin. Session
 * transactions carry metadata under this key; transactions without it are
 * foreign and subject to the remap-or-drop policy.
 */
const MLV_EDITOR_AI_SUGGESTIONS_KEY =
  new PluginKey<MlvEditorAiSuggestionsPluginState | null>(
    'mlvEditorAiSuggestions',
  );

/**
 * @internal One active review session per editor. Starting a new session
 * tears the previous one down first (its remaining suggestions stay applied —
 * the accepted-by-default rule), so the shared key never registers twice.
 */
const activeSessions = new WeakMap<Editor, () => void>();

/** @internal Monotonic source of session-unique suggestion identifiers. */
let suggestionIdSequence = 0;

/** @internal Allocates the next suggestion identifier. */
const nextSuggestionId = () => `mlv-ai-suggestion-${++suggestionIdSequence}`;

/** @internal Renders the strikethrough widget carrying one removed text. */
const renderDeleteWidget = (oldText: string, current: boolean) => () => {
  const element = document.createElement('span');
  element.className = current
    ? `${MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS} ${MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS}`
    : MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS;
  element.textContent = oldText;
  // Purely visual affordance: the removed text must not be read as document
  // content. The review surface announces outcomes separately.
  element.setAttribute('aria-hidden', 'true');
  return element;
};

/** @internal Builds the decoration set for a fresh entry list. */
const buildDecorations = (
  doc: ProseMirrorNode,
  entries: readonly MlvEditorAiSuggestionEntry[],
  currentId: string | null,
): DecorationSet => {
  const decorations: Decoration[] = [];
  for (const entry of entries) {
    const current = entry.id === currentId;
    if (entry.kind !== 'delete' && entry.from < entry.to) {
      decorations.push(
        Decoration.inline(
          entry.from,
          entry.to,
          {
            class: current
              ? `${MLV_EDITOR_AI_SUGGESTION_INSERT_CLASS} ${MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS}`
              : MLV_EDITOR_AI_SUGGESTION_INSERT_CLASS,
          },
          { id: entry.id },
        ),
      );
    }
    if (entry.kind !== 'insert' && entry.oldText.length > 0) {
      decorations.push(
        Decoration.widget(
          entry.from,
          renderDeleteWidget(entry.oldText, current),
          {
            id: entry.id,
            side: -1,
          },
        ),
      );
    }
  }
  return DecorationSet.create(doc, decorations);
};

/**
 * @internal Remaps one entry through a session-owned transaction. Session
 * edits (rejects) never overlap other entries, so positions map without the
 * drop policy. Collapsed entries map with the same association their widget
 * decoration uses (`side: -1`), keeping entry and decoration in lockstep.
 */
const remapEntryThroughOwn = (
  entry: MlvEditorAiSuggestionEntry,
  mapping: Mapping,
): MlvEditorAiSuggestionEntry => {
  const collapsed = entry.kind === 'delete';
  const from = mapping.map(entry.from, collapsed ? -1 : 1);
  const to = collapsed ? from : mapping.map(entry.to, -1);
  if (from === entry.from && to === entry.to) return entry;
  return { ...entry, from, to };
};

/**
 * @internal Remaps one entry through a foreign transaction, or returns `null`
 * when a step touches it — the concurrent-edit drop policy.
 *
 * A non-collapsed entry is touched by any step whose replaced range strictly
 * overlaps `[from, to)`; a pure insertion strictly inside counts, insertions
 * and deletions that only meet a boundary do not. A collapsed (`'delete'`)
 * entry is touched by a replacement strictly spanning its anchor and by an
 * insertion at exactly the anchor — which is also what makes undoing the
 * original application (it re-inserts the removed text at the anchor) drop
 * the widget along with everything else.
 *
 * Boundary association mirrors the decorations: inline ranges exclude
 * content inserted at either edge (`inclusiveStart`/`inclusiveEnd` false),
 * widgets stay put with `side: -1`.
 */
const remapEntryThroughForeign = (
  entry: MlvEditorAiSuggestionEntry,
  mapping: Mapping,
): MlvEditorAiSuggestionEntry | null => {
  const collapsed = entry.kind === 'delete';
  let from = entry.from;
  let to = entry.to;
  for (const stepMap of mapping.maps) {
    let touched = false;
    stepMap.forEach((oldStart: number, oldEnd: number) => {
      if (collapsed) {
        if (
          (oldStart < from && oldEnd > from) ||
          (oldStart === oldEnd && oldStart === from)
        ) {
          touched = true;
        }
      } else if (oldStart < to && oldEnd > from) {
        touched = true;
      }
    });
    if (touched) return null;
    from = stepMap.map(from, collapsed ? -1 : 1);
    to = collapsed ? from : stepMap.map(to, -1);
  }
  if (from === entry.from && to === entry.to) return entry;
  return { ...entry, from, to };
};

/** @internal Removes every decoration belonging to the given ids. */
const removeDecorationsFor = (
  decorations: DecorationSet,
  ids: ReadonlySet<string>,
): DecorationSet =>
  decorations.remove(
    decorations.find(undefined, undefined, (spec: { id: string }) =>
      ids.has(spec.id),
    ),
  );

/** @internal Creates the per-session suggestion plugin. */
const createSuggestionsPlugin =
  (): Plugin<MlvEditorAiSuggestionsPluginState | null> =>
    new Plugin<MlvEditorAiSuggestionsPluginState | null>({
      key: MLV_EDITOR_AI_SUGGESTIONS_KEY,
      state: {
        init: () => null,
        apply: (transaction, state) => {
          const metadata = transaction.getMeta(
            MLV_EDITOR_AI_SUGGESTIONS_KEY,
          ) as MlvEditorAiSuggestionsMetadata | undefined;
          if (metadata?.type === 'init') {
            // Entry positions were computed against the transaction's result
            // document, so the decorations build against it directly.
            return {
              entries: metadata.entries,
              currentId: null,
              decorations: buildDecorations(
                transaction.doc,
                metadata.entries,
                null,
              ),
            };
          }
          if (!state) return null;

          let entries = state.entries;
          let currentId = state.currentId;
          let decorations = state.decorations;
          if (transaction.docChanged) {
            if (metadata) {
              entries = entries.map((entry) =>
                remapEntryThroughOwn(entry, transaction.mapping),
              );
              decorations = decorations.map(
                transaction.mapping,
                transaction.doc,
              );
            } else {
              const survivors: MlvEditorAiSuggestionEntry[] = [];
              const dropped = new Set<string>();
              for (const entry of entries) {
                const mapped = remapEntryThroughForeign(
                  entry,
                  transaction.mapping,
                );
                if (mapped) survivors.push(mapped);
                else dropped.add(entry.id);
              }
              entries = survivors;
              decorations = decorations.map(
                transaction.mapping,
                transaction.doc,
              );
              if (dropped.size > 0) {
                decorations = removeDecorationsFor(decorations, dropped);
                if (currentId !== null && dropped.has(currentId)) {
                  currentId = null;
                }
              }
            }
          }
          if (metadata?.type === 'drop') {
            const ids = new Set(metadata.ids);
            entries = entries.filter((entry) => !ids.has(entry.id));
            decorations = removeDecorationsFor(decorations, ids);
            if (currentId !== null && ids.has(currentId)) currentId = null;
          }
          if (metadata?.type === 'clear') {
            return {
              entries: [],
              currentId: null,
              decorations: DecorationSet.empty,
            };
          }
          if (metadata?.type === 'current') {
            // The outline moves by rebuilding from the (possibly remapped)
            // entries: entry and decoration positions stay in lockstep, so
            // the rebuild is equivalent to the incrementally mapped set plus
            // the new current marker.
            return {
              entries,
              currentId: metadata.id,
              decorations: buildDecorations(
                transaction.doc,
                entries,
                metadata.id,
              ),
            };
          }
          if (
            entries === state.entries &&
            currentId === state.currentId &&
            decorations === state.decorations
          ) {
            return state;
          }
          return { entries, currentId, decorations };
        },
      },
      props: {
        decorations: (state: EditorState) =>
          MLV_EDITOR_AI_SUGGESTIONS_KEY.getState(state)?.decorations ?? null,
      },
    });

/**
 * @internal True when `[from, to]` lies inside one textblock and contains
 * only unmarked text nodes — the precondition for the token-level word diff,
 * where one character is exactly one document position and inserted plain
 * text can drop no formatting.
 */
const regionIsPlainInline = (
  doc: ProseMirrorNode,
  from: number,
  to: number,
): boolean => {
  const $from = doc.resolve(from);
  const $to = doc.resolve(to);
  if (!$from.sameParent($to) || !$from.parent.isTextblock) return false;
  let plain = true;
  $from.parent.nodesBetween($from.parentOffset, $to.parentOffset, (node) => {
    if (!node.isText || node.marks.length > 0) plain = false;
    return false;
  });
  return plain;
};

/**
 * @internal Extracts the plain text of a parsed replacement that is exactly
 * one paragraph of unmarked text nodes; `null` for anything richer, which
 * routes the application through the whole-region fallback.
 */
const plainParagraphText = (blocks: readonly JSONContent[]): string | null => {
  if (blocks.length !== 1 || blocks[0].type !== 'paragraph') return null;
  const content = blocks[0].content ?? [];
  let text = '';
  for (const child of content) {
    if (
      child.type !== 'text' ||
      typeof child.text !== 'string' ||
      (child.marks?.length ?? 0) > 0
    ) {
      return null;
    }
    text += child.text;
  }
  return text;
};

/**
 * @internal Parses the replacement Markdown into top-level blocks through the
 * editor's Markdown manager; without a manager the raw text becomes one plain
 * paragraph — the same fallback the streaming engine's commit uses. Returns
 * `null` for unusable input.
 */
const parseReplacement = (
  editor: Editor,
  markdown: string,
): readonly JSONContent[] | null => {
  const manager = editor.markdown;
  if (!manager) {
    return [{ type: 'paragraph', content: [{ type: 'text', text: markdown }] }];
  }
  try {
    const parsed = manager.parse(markdown);
    if (!Array.isArray(parsed.content) || parsed.content.length === 0) {
      return null;
    }
    return parsed.content;
  } catch {
    return null;
  }
};

/**
 * @internal Restores one entry's original content into the shared reject
 * transaction. Insert entries delete their exact inline range. Other kinds
 * try the precise `replace` with the stored slice first — exact for every
 * token-diff entry — and fall back to the fitting `replaceRange` for
 * whole-region entries whose paste-fitted boundaries no longer match the
 * slice's open depths. A throwing `replace` adds no step, so the fallback
 * runs against an unchanged transaction.
 */
const applyRestore = (
  tr: Transaction,
  entry: MlvEditorAiSuggestionEntry,
): void => {
  if (entry.kind === 'insert') {
    tr.delete(entry.from, entry.to);
    return;
  }
  try {
    tr.replace(entry.from, entry.to, entry.inverted);
  } catch {
    tr.replaceRange(entry.from, entry.to, entry.inverted);
  }
};

/**
 * Applies an AI replacement for `[from, to]` as reviewable tracked changes —
 * the Phase 2 suggestion engine (storage option B of the design spec).
 *
 * Framework-free: only the editor instance and the replacement Markdown are
 * needed — no Angular, no provider token, no network.
 *
 * Diff granularity (pragmatic, documented rule): when the original region is
 * a single textblock of plain, unmarked text **and** the parsed replacement
 * is a single paragraph of plain text, the two are diffed token-by-token
 * (tokens are whitespace or word runs) over a longest common subsequence,
 * producing individual insert/delete/replace suggestions. Any structural or
 * formatted content on either side falls back to **one** whole-region
 * replace suggestion.
 *
 * Representation: inserted text enters the document immediately and is
 * highlighted by an inline decoration
 * ({@link MLV_EDITOR_AI_SUGGESTION_INSERT_CLASS}); deleted text is removed
 * from the document and re-rendered at its position by a strikethrough
 * `aria-hidden` widget decoration
 * ({@link MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS}). Because both are
 * decorations, `getHTML`/`getMarkdown`/`getJSON` during review serialize the
 * document as-is — inserted text present, removed text absent — the spec's
 * accepted-by-default rule. Hosts gate saves on pending suggestions.
 *
 * The whole application is exactly **one** history-visible transaction:
 * one undo removes every suggested change at once — and, because the undo
 * intersects every suggestion range, it also drops the whole session.
 *
 * Concurrent edits: user transactions remap all suggestion ranges through
 * their step maps; an edit that intersects a suggestion's range drops that
 * one suggestion (decorations removed, the current document text stands,
 * nothing is restored). The session ends when every suggestion is resolved
 * or dropped, and editor destruction cleans up listeners and plugin state.
 * Starting a new session on an editor first ends the previous one, leaving
 * its remaining suggestions applied (accepted-by-default).
 *
 * Undo-step semantics of the returned session are documented on
 * {@link MlvEditorAiSuggestionsSession}.
 *
 * @param editor Live Tiptap editor the suggestions are applied to.
 * @param options Region to rewrite and the replacement Markdown.
 * @returns The review session, or `null` when nothing reviewable results —
 * destroyed editor, out-of-range positions, unusable replacement, or a
 * replacement identical to the region.
 */
export function applyMlvEditorAiSuggestions(
  editor: Editor,
  options: MlvEditorAiSuggestionsOptions,
): MlvEditorAiSuggestionsSession | null {
  const { from, to, replacementMarkdown } = options;
  if (editor.isDestroyed) return null;
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < from ||
    to > editor.state.doc.content.size
  ) {
    return null;
  }
  if (replacementMarkdown.trim().length === 0) return null;

  const blocks = parseReplacement(editor, replacementMarkdown);
  if (!blocks) return null;

  const doc = editor.state.doc;
  const plainReplacement = plainParagraphText(blocks);
  const wordDiff =
    plainReplacement !== null && regionIsPlainInline(doc, from, to)
      ? mlvEditorAiWordDiff(doc.textBetween(from, to), plainReplacement)
      : null;
  // A word-diffable replacement identical to the region changes nothing.
  if (wordDiff !== null && wordDiff.length === 0) return null;

  // One session per editor: the shared plugin key must never register twice.
  activeSessions.get(editor)?.();

  let active = true;

  /** @internal Ends the session exactly once and detaches everything. */
  const teardown = () => {
    if (!active) return;
    active = false;
    editor.off('transaction', onTransaction);
    editor.off('destroy', onDestroy);
    if (!editor.isDestroyed) {
      try {
        editor.unregisterPlugin(MLV_EDITOR_AI_SUGGESTIONS_KEY);
      } catch {
        // A failing reconfigure must not break teardown; the listeners are
        // already detached and the session is inert either way.
      }
    }
    if (activeSessions.get(editor) === teardown) activeSessions.delete(editor);
  };

  /**
   * @internal Ends the session once every suggestion is resolved or dropped —
   * including the drop-all that undoing the original application causes.
   */
  const onTransaction = () => {
    if (!active) return;
    const state = MLV_EDITOR_AI_SUGGESTIONS_KEY.getState(editor.state);
    if (!state || state.entries.length === 0) teardown();
  };

  /** @internal A destroyed editor leaves nothing to unregister. */
  const onDestroy = () => teardown();

  editor.registerPlugin(createSuggestionsPlugin());
  editor.on('transaction', onTransaction);
  editor.on('destroy', onDestroy);
  activeSessions.set(editor, teardown);

  try {
    const tr = editor.state.tr;
    const entries: MlvEditorAiSuggestionEntry[] = [];
    if (wordDiff !== null) {
      // Token path: every run edits plain inline text of one textblock, so a
      // character offset is a document offset and a running delta keeps the
      // positions of later runs exact.
      let delta = 0;
      for (const run of wordDiff) {
        const runFrom = from + run.oldFrom + delta;
        const runTo = from + run.oldTo + delta;
        const inverted =
          run.kind === 'insert'
            ? Slice.empty
            : doc.slice(from + run.oldFrom, from + run.oldTo);
        if (run.kind === 'delete') {
          tr.delete(runFrom, runTo);
        } else {
          tr.replaceWith(runFrom, runTo, editor.schema.text(run.newText));
        }
        entries.push({
          id: nextSuggestionId(),
          kind: run.kind,
          from: runFrom,
          to: run.kind === 'delete' ? runFrom : runFrom + run.newText.length,
          oldText: run.oldText,
          newText: run.newText,
          inverted,
        });
        delta += run.newText.length - run.oldText.length;
      }
    } else {
      // Fallback: one whole-region replace. A single-paragraph replacement
      // lands as inline content so a one-line result never splits the
      // surrounding block (streaming-commit precedent); everything else lands
      // as the block structure the Markdown describes, paste-fitted.
      const inline =
        blocks.length === 1 && blocks[0].type === 'paragraph'
          ? (blocks[0].content ?? [])
          : null;
      const blockReplacement = !inline || inline.length === 0;
      const fragment = Fragment.fromJSON(
        editor.schema,
        blockReplacement ? blocks : inline,
      );
      // Block content replacing a region whose edge sits at a textblock edge
      // grows to that block's boundary; otherwise `replaceRange`'s fitting
      // strands the emptied source block as a shell next to the inserted
      // structure, and that shell would serialize (accepted-by-default) and
      // survive a reject.
      let replaceFrom = from;
      let replaceTo = to;
      if (blockReplacement && from < to) {
        const $from = doc.resolve(from);
        const $to = doc.resolve(to);
        if (
          $from.depth > 0 &&
          $from.parent.isTextblock &&
          $from.parentOffset === 0
        ) {
          replaceFrom = $from.before();
        }
        if (
          $to.depth > 0 &&
          $to.parent.isTextblock &&
          $to.parentOffset === $to.parent.content.size
        ) {
          replaceTo = $to.after();
        }
      }
      const inverted = doc.slice(replaceFrom, replaceTo);
      tr.replaceRange(replaceFrom, replaceTo, new Slice(fragment, 0, 0));
      // A replacement that reproduces the document is the no-changes case —
      // the whole-region counterpart of the empty word diff above. Without
      // this check an echoed formatted or structural region would land as one
      // bogus no-op replace suggestion (and a no-op undo step).
      if (tr.doc.eq(doc)) {
        teardown();
        return null;
      }
      const mappedFrom = tr.mapping.map(replaceFrom, -1);
      const mappedTo = Math.max(mappedFrom, tr.mapping.map(replaceTo, 1));
      entries.push({
        id: nextSuggestionId(),
        kind: 'replace',
        from: mappedFrom,
        to: mappedTo,
        oldText: doc.textBetween(replaceFrom, replaceTo, ' '),
        newText: tr.doc.textBetween(mappedFrom, mappedTo, ' '),
        inverted,
      });
    }
    tr.setMeta(MLV_EDITOR_AI_SUGGESTIONS_KEY, {
      type: 'init',
      entries,
    } satisfies MlvEditorAiSuggestionsMetadata);
    closeHistory(tr);
    editor.view.dispatch(tr);
  } catch {
    teardown();
    return null;
  }

  /** @internal Reads the current entries; empty once the session ended. */
  const currentEntries = (): readonly MlvEditorAiSuggestionEntry[] =>
    active
      ? (MLV_EDITOR_AI_SUGGESTIONS_KEY.getState(editor.state)?.entries ?? [])
      : [];

  return {
    suggestions: () =>
      currentEntries().map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        range: { from: entry.from, to: entry.to },
        oldText: entry.oldText,
        newText: entry.newText,
      })),

    accept: (id) => {
      const entry = currentEntries().find((candidate) => candidate.id === id);
      if (!entry) return false;
      // No document step: the applied change already is the accepted state,
      // so this is a pure plugin-state update and creates no history entry.
      const tr = editor.state.tr;
      tr.setMeta(MLV_EDITOR_AI_SUGGESTIONS_KEY, {
        type: 'drop',
        ids: [id],
      } satisfies MlvEditorAiSuggestionsMetadata);
      editor.view.dispatch(tr);
      return true;
    },

    reject: (id) => {
      const entry = currentEntries().find((candidate) => candidate.id === id);
      if (!entry) return false;
      try {
        const tr = editor.state.tr;
        applyRestore(tr, entry);
        tr.setMeta(MLV_EDITOR_AI_SUGGESTIONS_KEY, {
          type: 'drop',
          ids: [id],
        } satisfies MlvEditorAiSuggestionsMetadata);
        closeHistory(tr);
        editor.view.dispatch(tr);
        return true;
      } catch {
        return false;
      }
    },

    acceptAll: () => {
      if (currentEntries().length === 0) return false;
      const tr = editor.state.tr;
      tr.setMeta(MLV_EDITOR_AI_SUGGESTIONS_KEY, {
        type: 'clear',
      } satisfies MlvEditorAiSuggestionsMetadata);
      editor.view.dispatch(tr);
      return true;
    },

    setCurrent: (id) => {
      if (!active) return false;
      const state = MLV_EDITOR_AI_SUGGESTIONS_KEY.getState(editor.state);
      if (!state) return false;
      if (id !== null && !state.entries.some((entry) => entry.id === id)) {
        return false;
      }
      if (state.currentId === id) return true;
      // No document step: the marker lives in plugin state and decorations
      // only, so this dispatch can never create a history entry.
      const tr = editor.state.tr;
      tr.setMeta(MLV_EDITOR_AI_SUGGESTIONS_KEY, {
        type: 'current',
        id,
      } satisfies MlvEditorAiSuggestionsMetadata);
      editor.view.dispatch(tr);
      return true;
    },

    rejectAll: () => {
      const entries = currentEntries();
      if (entries.length === 0) return false;
      try {
        const tr = editor.state.tr;
        // Descending order keeps every earlier entry's positions valid while
        // later ones are restored.
        for (const entry of [...entries].sort((a, b) => b.from - a.from)) {
          applyRestore(tr, entry);
        }
        tr.setMeta(MLV_EDITOR_AI_SUGGESTIONS_KEY, {
          type: 'clear',
        } satisfies MlvEditorAiSuggestionsMetadata);
        closeHistory(tr);
        editor.view.dispatch(tr);
        return true;
      } catch {
        return false;
      }
    },
  };
}
