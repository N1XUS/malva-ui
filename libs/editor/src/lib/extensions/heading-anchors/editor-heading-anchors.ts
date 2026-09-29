import { Extension } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { MLV_EDITOR_CREATE_NORMALIZATION_META } from '../editor-create-normalization';
import {
  memoizeSlug,
  type MlvHeadingAnchorAssignment,
  planHeadingAnchors,
  slugifyHeading,
} from './editor-heading-anchors-derive';
import { createHeadingLinkButton } from './editor-heading-link-widget';

/**
 * Options of {@link MlvEditorHeadingAnchors}.
 */
export interface MlvEditorHeadingAnchorOptions {
  /**
   * Prepended to the anchor in the heading's DOM / HTML `id` and in the
   * copied link (`attrs.anchor` stays unprefixed). Give each editor on a page
   * its own prefix: two editors with a heading of the same text otherwise
   * render the same `id`.
   */
  idPrefix: string;

  /**
   * Turns heading text into its anchor; an empty result means no anchor and
   * no `id`. The default NFKC-normalizes, lower-cases without a locale, keeps
   * letters, marks, numbers, whitespace and `-`, and joins words with `-`
   * (`"Getting started"` → `getting-started`, `"Привет мир"` → `привет-мир`).
   */
  slugify: (text: string) => string;

  /**
   * Return `false` to leave a transaction alone: its changes do not
   * recompute anchors (a remote collaboration step, a change before the
   * first sync). Applied to a root transaction and to every transaction
   * another plugin appends to it. The next local edit recomputes every
   * anchor, as does `ensureHeadingAnchors()`. `null` allows all.
   */
  filterTransaction: ((tr: Transaction) => boolean) | null;
}

/**
 * The link a copy-link activation hands to the host: the heading's anchor and
 * the DOM `id` it renders (the anchor with `idPrefix`).
 */
export interface MlvEditorHeadingLink {
  /** The derived, unprefixed anchor (`attrs.anchor`). */
  readonly anchor: string;
  /** The rendered element `id`: `idPrefix` + `anchor`. */
  readonly id: string;
}

/**
 * Callbacks the copy-link widget and `copyHeadingLink()` run. `MlvEditor`
 * fills them for every editor it creates that has this extension, including a
 * consumer extension array; without them no widget renders.
 */
export interface MlvEditorHeadingAnchorStorage {
  /** Copies the link; returns whether the copy succeeded. `null`: unwired. */
  copy: ((link: MlvEditorHeadingLink) => boolean) | null;
  /** Announces a successful copy to assistive technology. */
  announce: (() => void) | null;
  /** The button's accessible name. */
  label: () => string;
  /** `true` while the host is disabled; the widget is hidden then. */
  disabled: () => boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mlvEditorHeadingAnchors: {
      /**
       * Copies the link of the heading holding the caret and announces it.
       * Fails outside a heading, for a heading with no anchor, and while no
       * host has wired the copy callback.
       */
      copyHeadingLink: () => ReturnType;
      /**
       * Recomputes every heading anchor in one transaction that is not added
       * to the undo history (a collaborative editor after its first sync).
       * Always succeeds.
       */
      ensureHeadingAnchors: () => ReturnType;
    };
  }

  interface Storage {
    headingAnchors: MlvEditorHeadingAnchorStorage;
  }
}

/** @private English fallback for the button's accessible name. */
const DEFAULT_LABEL = 'Copy link to heading';

/** @private Key of the anchor plugin; its meta marks the plugin's own writes. */
const headingAnchorsPluginKey = new PluginKey('mlvEditorHeadingAnchors');

/** @private Writes anchors through `setNodeAttribute` only and keeps stored marks. */
const applyAnchors = (
  tr: Transaction,
  assignments: readonly MlvHeadingAnchorAssignment[],
): Transaction => {
  const storedMarks = tr.storedMarks;
  for (const { pos, anchor } of assignments) {
    tr.setNodeAttribute(pos, 'anchor', anchor);
  }
  if (storedMarks) tr.setStoredMarks(storedMarks);
  return tr.setMeta(headingAnchorsPluginKey, true);
};

/** @private The link of the heading holding the selection head, if any. */
const headingLinkAt = (
  state: EditorState,
  idPrefix: string,
): MlvEditorHeadingLink | null => {
  const { $head } = state.selection;
  for (let depth = $head.depth; depth > 0; depth--) {
    const node = $head.node(depth);
    if (node.type.name !== 'heading') continue;
    const anchor: unknown = node.attrs['anchor'];
    return typeof anchor === 'string' && anchor !== ''
      ? { anchor, id: `${idPrefix}${anchor}` }
      : null;
  }
  return null;
};

/** @private Position of the heading holding the selection head, or `-1`. */
const caretHeadingPos = (state: EditorState): number => {
  const { $head } = state.selection;
  for (let depth = $head.depth; depth > 0; depth--) {
    if ($head.node(depth).type.name === 'heading') return $head.before(depth);
  }
  return -1;
};

/** @private Inputs the decoration set was last built from. */
interface DecorationInputs {
  readonly doc: EditorState['doc'];
  /** Whether copy-link widgets render: a host wired the copy and is enabled. */
  readonly widgets: boolean;
  readonly editable: boolean;
  readonly label: string;
  readonly caret: number;
}

/**
 * Derived heading anchors and a copy-link affordance, opt-in
 * (`headingAnchors` on `MlvEditor`, or this extension in a consumer array).
 *
 * Every heading gets `attrs.anchor`, derived from its text and deduplicated
 * in document order, and renders it as its `id` (with `idPrefix`). Anchors
 * are never parsed from input: loading HTML, JSON or Markdown re-derives the
 * same values. They are recomputed in `appendTransaction` through
 * `setNodeAttribute` only, so they undo with the edit and never move an AI
 * suggestion range.
 *
 * Each anchored heading shows a copy-link button at its inline end — on
 * hover, on focus and while the caret is in the heading — once a host has
 * wired {@link MlvEditorHeadingAnchorStorage}. It is a tab stop only while
 * the editor is not editable; in an editable editor the keyboard path is the
 * heading menu's "Copy link to heading" item (`copyHeadingLink()`).
 *
 * In a mounted view every heading carries the `mlv-editor__heading` class, and
 * the one holding the caret also `mlv-editor__heading--caret`.
 */
export const MlvEditorHeadingAnchors = Extension.create<
  MlvEditorHeadingAnchorOptions,
  MlvEditorHeadingAnchorStorage
>({
  name: 'headingAnchors',

  addOptions() {
    return { idPrefix: '', slugify: slugifyHeading, filterTransaction: null };
  },

  addStorage() {
    return {
      copy: null,
      announce: null,
      label: () => DEFAULT_LABEL,
      disabled: () => false,
    };
  },

  addGlobalAttributes() {
    const { idPrefix } = this.options;
    return [
      {
        types: ['heading'],
        attributes: {
          anchor: {
            default: null,
            keepOnSplit: false,
            // Derived, never read from input (a pasted or loaded `id`).
            parseHTML: () => null,
            renderHTML: (attributes: Record<string, unknown>) =>
              typeof attributes['anchor'] === 'string' &&
              attributes['anchor'] !== ''
                ? { id: `${idPrefix}${attributes['anchor']}` }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    const slug = memoizeSlug(this.options.slugify);
    return {
      copyHeadingLink:
        () =>
        ({ state, dispatch }) => {
          const link = headingLinkAt(state, this.options.idPrefix);
          const { copy, announce } = this.storage;
          if (!link || !copy) return false;
          if (dispatch && copy(link)) announce?.();
          return true;
        },
      ensureHeadingAnchors:
        () =>
        ({ tr, dispatch }) => {
          if (!dispatch) return true;
          applyAnchors(tr, planHeadingAnchors(tr.doc, slug));
          tr.setMeta('addToHistory', false);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const { idPrefix, filterTransaction } = this.options;
    const slug = memoizeSlug(this.options.slugify);
    const storage = this.storage;
    const editor = this.editor;
    // Only this plugin's own writes are skipped; a transaction another plugin
    // appends to one of them can still change heading text.
    const relevant = (tr: Transaction): boolean => {
      if (!tr.docChanged || tr.getMeta(headingAnchorsPluginKey)) return false;
      const root = tr.getMeta('appendedTransaction') as Transaction | undefined;
      if (!filterTransaction) return true;
      return filterTransaction(tr) && (!root || filterTransaction(root));
    };
    const activate = (link: MlvEditorHeadingLink): void => {
      if (storage.copy?.(link)) storage.announce?.();
    };
    let built: { inputs: DecorationInputs; set: DecorationSet } | null = null;
    const decorations = (state: EditorState): DecorationSet => {
      const inputs: DecorationInputs = {
        doc: state.doc,
        widgets: !!storage.copy && !storage.disabled(),
        editable: editor.options.editable !== false,
        label: storage.label() || DEFAULT_LABEL,
        caret: caretHeadingPos(state),
      };
      if (
        built &&
        built.inputs.doc === inputs.doc &&
        built.inputs.widgets === inputs.widgets &&
        built.inputs.editable === inputs.editable &&
        built.inputs.label === inputs.label &&
        built.inputs.caret === inputs.caret
      ) {
        return built.set;
      }
      const items: Decoration[] = [];
      state.doc.descendants((node, pos) => {
        if (node.type.name !== 'heading') return !node.isTextblock;
        // The BEM element every heading carries, so the caret modifier always
        // sits beside its base class and consumers get one hook per heading.
        items.push(
          Decoration.node(pos, pos + node.nodeSize, {
            class:
              pos === inputs.caret
                ? 'mlv-editor__heading mlv-editor__heading--caret'
                : 'mlv-editor__heading',
          }),
        );
        if (!inputs.widgets) return false;
        const anchor: unknown = node.attrs['anchor'];
        if (typeof anchor !== 'string' || anchor === '') return false;
        const link: MlvEditorHeadingLink = {
          anchor,
          id: `${idPrefix}${anchor}`,
        };
        items.push(
          Decoration.widget(
            pos + node.nodeSize - 1,
            (view) =>
              createHeadingLinkButton(view.dom.ownerDocument, {
                label: inputs.label,
                editable: inputs.editable,
                activate: () => activate(link),
              }),
            {
              side: 1,
              ignoreSelection: true,
              stopEvent: () => true,
              key: `mlv-heading-link:${link.id}:${inputs.editable}:${inputs.label}`,
            },
          ),
        );
        return false;
      });
      built = { inputs, set: DecorationSet.create(state.doc, items) };
      return built.set;
    };
    return [
      new Plugin({
        key: headingAnchorsPluginKey,
        appendTransaction: (trs, _oldState, newState) => {
          if (!trs.some(relevant)) return null;
          const plan = planHeadingAnchors(newState.doc, slug);
          return plan.length === 0 ? null : applyAnchors(newState.tr, plan);
        },
        props: { decorations },
      }),
    ];
  },

  onCreate() {
    const { state, view } = this.editor;
    const plan = planHeadingAnchors(state.doc, this.options.slugify);
    if (plan.length === 0) return;
    view.dispatch(
      applyAnchors(state.tr, plan)
        .setMeta('addToHistory', false)
        .setMeta(MLV_EDITOR_CREATE_NORMALIZATION_META, true),
    );
  },
});
