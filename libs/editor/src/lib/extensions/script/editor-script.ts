import {
  isMarkActive,
  Mark,
  mergeAttributes,
  type CommandProps,
} from '@tiptap/core';
import type { TagParseRule } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    subscript: {
      /** Applies the subscript mark, removing superscript. */
      setSubscript: () => ReturnType;
      /** Toggles the subscript mark, removing superscript when applied. */
      toggleSubscript: () => ReturnType;
      /** Removes the subscript mark. */
      unsetSubscript: () => ReturnType;
    };
    superscript: {
      /** Applies the superscript mark, removing subscript. */
      setSuperscript: () => ReturnType;
      /** Toggles the superscript mark, removing subscript when applied. */
      toggleSuperscript: () => ReturnType;
      /** Removes the superscript mark. */
      unsetSuperscript: () => ReturnType;
    };
  }
}

/**
 * @private Applies one script mark and removes the other. Tiptap's `setMark`
 * reports failure over a mark that excludes the new one, and its
 * `unsetMark` changes nothing under `can()`, so neither can express "swap
 * subscript for superscript": the toolbar button would read disabled on
 * subscripted text and the shortcut would go unhandled. Fails where no
 * selected text accepts the mark — inline code excludes every mark.
 */
const applyScriptMark =
  (name: 'subscript' | 'superscript', other: 'subscript' | 'superscript') =>
  ({ state, tr, dispatch }: CommandProps): boolean => {
    const type = state.schema.marks[name];
    const otherType = state.schema.marks[other];
    const { selection } = state;
    const accepts = (marks: readonly { type: typeof type }[]): boolean =>
      !marks.some(
        (mark) => mark.type !== otherType && mark.type.excludes(type),
      );

    if (selection.empty) {
      const { $from } = selection;
      const current = state.storedMarks ?? $from.marks();
      if (!$from.parent.type.allowsMarkType(type) || !accepts(current)) {
        return false;
      }
      if (dispatch) {
        tr.setStoredMarks(
          type.create().addToSet(otherType.removeFromSet(current)),
        );
      }
      return true;
    }

    let allowed = false;
    for (const { $from, $to } of selection.ranges) {
      state.doc.nodesBetween($from.pos, $to.pos, (node, _pos, parent) => {
        if (allowed) return false;
        if (node.isInline && parent?.type.allowsMarkType(type)) {
          allowed = accepts(node.marks);
        }
        return !allowed;
      });
    }
    if (!allowed) return false;
    if (dispatch) {
      for (const { $from, $to } of selection.ranges) {
        tr.removeMark($from.pos, $to.pos, otherType);
        tr.addMark($from.pos, $to.pos, type.create());
      }
    }
    return true;
  };

/**
 * @private Parse rules shared by both script marks: the element itself, and
 * the Docs / Word paste form — a span positioned by `vertical-align`. The span
 * rule does not consume, so a colour or font size on the same span still
 * reaches `textStyle`.
 */
const scriptParseRules = (
  tag: 'sub' | 'sup',
  verticalAlign: 'sub' | 'super',
): TagParseRule[] => [
  { tag },
  {
    tag: 'span[style*="vertical-align"]',
    consuming: false,
    getAttrs: (element) =>
      (element as HTMLElement).style.verticalAlign === verticalAlign
        ? null
        : false,
  },
];

/**
 * Subscript mark (#514, N1-D9): `<sub>`, and a `vertical-align: sub` span on
 * paste. Named `subscript`, like Tiptap's, so JSON from Tiptap content loads.
 * Excludes superscript. `Mod-,` toggles it. Markdown has no syntax for it, so
 * it is written as inline `<sub>` and parsed back through `@tiptap/markdown`'s
 * inline-HTML path — no tokenizer, so the GHSA-j95f allowlist is unchanged.
 */
export const MlvEditorSubscript = Mark.create({
  name: 'subscript',
  excludes: 'superscript',

  parseHTML() {
    return scriptParseRules('sub', 'sub');
  },

  renderHTML({ HTMLAttributes }) {
    return ['sub', mergeAttributes(HTMLAttributes), 0];
  },

  renderMarkdown(node, helpers) {
    return `<sub>${helpers.renderChildren(node)}</sub>`;
  },

  addCommands() {
    return {
      setSubscript: () => applyScriptMark('subscript', 'superscript'),
      toggleSubscript: () => (props) =>
        isMarkActive(props.state, this.name)
          ? props.commands.unsetMark(this.name)
          : applyScriptMark('subscript', 'superscript')(props),
      unsetSubscript:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },

  addKeyboardShortcuts() {
    return { 'Mod-,': () => this.editor.commands.toggleSubscript() };
  },
});

/**
 * Superscript mark (#514, N1-D9): `<sup>`, and a `vertical-align: super` span
 * on paste. Named `superscript`, like Tiptap's, so JSON from Tiptap content
 * loads. Excludes subscript. `Mod-.` toggles it. Markdown writes inline
 * `<sup>`, as for {@link MlvEditorSubscript}.
 */
export const MlvEditorSuperscript = Mark.create({
  name: 'superscript',
  excludes: 'subscript',

  parseHTML() {
    return scriptParseRules('sup', 'super');
  },

  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes), 0];
  },

  renderMarkdown(node, helpers) {
    return `<sup>${helpers.renderChildren(node)}</sup>`;
  },

  addCommands() {
    return {
      setSuperscript: () => applyScriptMark('superscript', 'subscript'),
      toggleSuperscript: () => (props) =>
        isMarkActive(props.state, this.name)
          ? props.commands.unsetMark(this.name)
          : applyScriptMark('superscript', 'subscript')(props),
      unsetSuperscript:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },

  addKeyboardShortcuts() {
    return { 'Mod-.': () => this.editor.commands.toggleSuperscript() };
  },
});
