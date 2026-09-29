import { Extension } from '@tiptap/core';
import { Plugin, type Transaction } from '@tiptap/pm/state';
import { ReplaceStep } from '@tiptap/pm/transform';
import { DecorationSet } from '@tiptap/pm/view';
import { yCursorPlugin, ySyncPluginKey } from '@tiptap/y-tiptap';
import type { Awareness } from 'y-protocols/awareness';
import { mlvEditorCollaborationLabelColor } from './collaboration-palette';
import { readMlvEditorCollaborationPeer } from './collaboration-peers';
import type { MlvEditorCollaborationPeer } from './collaboration.types';

/** @internal Class of a remote peer's caret widget. */
export const MLV_EDITOR_CARET_CLASS = 'mlv-editor__caret';

/** @internal Class of the name label inside a caret. */
export const MLV_EDITOR_CARET_LABEL_CLASS = 'mlv-editor__caret-label';

/** @internal Class of a remote peer's selection highlight. */
export const MLV_EDITOR_CARET_SELECTION_CLASS = 'mlv-editor__caret-selection';

/** @private The awareness state y-tiptap sees: `user` replaced by the validated peer. */
interface CaretState {
  readonly cursor?: unknown;
  readonly user: MlvEditorCollaborationPeer;
}

/** @internal Options of {@link createMlvEditorCollaborationCarets}. */
export interface MlvEditorCollaborationCaretOptions {
  /** The session's awareness. */
  readonly awareness: Awareness;
  /** The name shown for a peer with none; read on every render. */
  readonly anonymous: () => string;
}

/**
 * @private The subset of `Awareness` that `yCursorPlugin` calls, over copies of
 * the states whose `user` is the validated peer (F-D17): y-tiptap renders
 * `user.name` / `user.color` straight into the DOM and writes defaults
 * (`'User: <id>'`, `'#ffa500'`) back into the state object it reads, which
 * would otherwise leak into `peers()`.
 */
function validatedAwareness(options: MlvEditorCollaborationCaretOptions) {
  const { awareness } = options;
  return {
    getStates: (): Map<number, CaretState | null> => {
      const anonymous = options.anonymous();
      const out = new Map<number, CaretState | null>();
      awareness.getStates().forEach((state, clientId) => {
        out.set(
          clientId,
          state
            ? {
                ...state,
                user: readMlvEditorCollaborationPeer(
                  clientId,
                  state,
                  anonymous,
                ),
              }
            : null,
        );
      });
      return out;
    },
    getLocalState: () => awareness.getLocalState(),
    setLocalStateField: (field: string, value: unknown) =>
      awareness.setLocalStateField(field, value),
    on: (event: 'change', listener: () => void) =>
      awareness.on(event, listener),
    off: (event: 'change', listener: () => void) =>
      awareness.off(event, listener),
  };
}

/** @private Sets the two caret colour custom properties on `element`. */
function paint(element: HTMLElement, color: string): void {
  element.style.setProperty('--mlv-editor-caret-color', color);
  element.style.setProperty(
    '--mlv-editor-caret-label-color',
    mlvEditorCollaborationLabelColor(color),
  );
}

/**
 * @private A caret widget (F-D18). `aria-hidden`: it sits inside the
 * `role="textbox"` content, where a screen reader would read the name as
 * document text; presence reaches AT through `mlv-editor-presence`. The
 * word joiners keep a line from breaking at the caret, as y-tiptap's own
 * widget does.
 */
function buildCaret(user: MlvEditorCollaborationPeer): HTMLElement {
  const caret = document.createElement('span');
  caret.className = MLV_EDITOR_CARET_CLASS;
  caret.setAttribute('aria-hidden', 'true');
  caret.dataset['clientId'] = String(user.clientId);
  paint(caret, user.color);
  const label = document.createElement('span');
  label.className = MLV_EDITOR_CARET_LABEL_CLASS;
  label.textContent = user.name;
  caret.append('⁠', label, '⁠');
  return caret;
}

/**
 * @private y-tiptap 3.0.9's `isStructuralTransaction`, with each step
 * resolved in the document it applies to (`tr.docs[index]`). Upstream
 * resolves every step in the transaction's start document, so a deletion
 * after another step that reaches past that document's end throws
 * `RangeError` from the plugin's `apply` — the character limit's paste trim
 * (insert, then delete) is one such transaction.
 */
function isStructuralTransaction(tr: Transaction): boolean {
  if (tr.doc.childCount !== tr.before.childCount) return true;
  return tr.steps.some((step, index) => {
    if (!(step instanceof ReplaceStep)) return false;
    const doc = tr.docs[index];
    if (step.from === 0 && step.to === doc.content.size) return true;
    if (step.slice.content.size > 0) {
      let hasBlock = false;
      step.slice.content.forEach((node) => {
        if (node.isBlock) hasBlock = true;
      });
      return hasBlock;
    }
    if (step.to <= step.from) return false;
    const $from = doc.resolve(step.from);
    const $to = doc.resolve(step.to);
    return (
      $from.depth === 0 && $to.depth === 0 && $from.index() !== $to.index()
    );
  });
}

/**
 * @private `plugin` with its state `apply` answering a multi-step local
 * transaction itself, with the corrected check: hidden when structural (as
 * upstream: the document leads the Yjs mapping until peers republish),
 * otherwise mapped. A single-step or remote transaction, where upstream is
 * correct, still goes to upstream. y-tiptap's own awareness repaints are
 * separate, doc-unchanged transactions, so none is lost here.
 */
function withMultiStepGuard(
  plugin: Plugin<DecorationSet>,
): Plugin<DecorationSet> {
  const state = plugin.spec.state;
  if (!state) return plugin;
  return new Plugin<DecorationSet>({
    ...plugin.spec,
    state: {
      ...state,
      apply(tr, previous, oldState, newState) {
        if (
          tr.docChanged &&
          tr.steps.length > 1 &&
          !ySyncPluginKey.getState(newState)?.isChangeOrigin
        ) {
          return isStructuralTransaction(tr)
            ? DecorationSet.empty
            : previous.map(tr.mapping, tr.doc);
        }
        return state.apply.call(plugin, tr, previous, oldState, newState);
      },
    },
  });
}

/**
 * @internal Remote carets and selections (F-D18): wraps y-tiptap's
 * `yCursorPlugin` with Malva's DOM and classes. Hides this client's own
 * caret and the carets of peers who only view the document (y-tiptap
 * publishes a cursor on focus even for a non-editable view, so the filter
 * runs on the receiving side), and guards upstream's structural check
 * against multi-step transactions ({@link withMultiStepGuard}).
 */
export function createMlvEditorCollaborationCarets(
  options: MlvEditorCollaborationCaretOptions,
): Extension {
  return Extension.create({
    name: 'mlvEditorCollaborationCarets',
    addProseMirrorPlugins() {
      return [
        withMultiStepGuard(
          yCursorPlugin(validatedAwareness(options) as unknown as Awareness, {
            awarenessStateFilter: (
              localClientId: number,
              clientId: number,
              state: CaretState | null,
            ) =>
              localClientId !== clientId &&
              state !== null &&
              state.user.mode !== 'viewing',
            cursorBuilder: (user: MlvEditorCollaborationPeer) =>
              buildCaret(user),
            selectionBuilder: (user: MlvEditorCollaborationPeer) => ({
              class: MLV_EDITOR_CARET_SELECTION_CLASS,
              style: `--mlv-editor-caret-color: ${user.color}`,
            }),
          }),
        ),
      ];
    },
  });
}
