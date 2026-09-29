import { Extension } from '@tiptap/core';
import type { Mark } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mlvEditorResetFormatting: {
      /**
       * Removes every mark except `link` from the selection. At a bare caret it
       * clears the stored marks, or the marks the caret would inherit, keeping a
       * link. Block type, alignment and line height are untouched.
       */
      resetFormatting: () => ReturnType;
    };
  }
}

/** @private The one mark `resetFormatting()` keeps: a link is content, not styling. */
const KEPT_MARK = 'link';

/**
 * Reset formatting (#514, N1-D10): `resetFormatting()` removes every mark but
 * `link` — bold, italic, underline, strike, code, sub / superscript, colour,
 * highlight, font family and font size, and any consumer mark — and leaves the
 * block alone. Tiptap's `unsetAllMarks` also drops the link, which is why this
 * is not an alias for it.
 */
export const MlvEditorResetFormatting = Extension.create({
  name: 'resetFormatting',

  addCommands() {
    return {
      resetFormatting:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const removable = Object.values(state.schema.marks).filter(
            (type) => type.name !== KEPT_MARK,
          );

          if (selection.empty) {
            const inherited: readonly Mark[] =
              state.storedMarks ?? selection.$from.marks();
            if (dispatch) {
              tr.setStoredMarks(
                inherited.filter((mark) => mark.type.name === KEPT_MARK),
              );
            }
            return true;
          }

          if (dispatch) {
            for (const { $from, $to } of selection.ranges) {
              for (const type of removable) {
                tr.removeMark($from.pos, $to.pos, type);
              }
            }
          }
          return true;
        },
    };
  },
});
