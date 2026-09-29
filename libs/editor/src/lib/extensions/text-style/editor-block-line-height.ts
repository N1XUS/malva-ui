import { Extension, getStyleProperty, type CommandProps } from '@tiptap/core';

/** Options of {@link MlvEditorBlockLineHeight}. */
export interface MlvEditorBlockLineHeightOptions {
  /**
   * Textblock node types that accept a line height. Defaults to headings and
   * paragraphs, like `textAlignTypes`.
   */
  types: readonly string[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mlvEditorBlockLineHeight: {
      /**
       * Sets `lineHeight` on every selected textblock of a configured type.
       * Fails when the selection reaches none.
       */
      setBlockLineHeight: (lineHeight: string) => ReturnType;
      /**
       * Removes `lineHeight` from every selected textblock of a configured
       * type. Fails when the selection reaches none.
       */
      unsetBlockLineHeight: () => ReturnType;
    };
  }
}

/**
 * Block line height (#514, N1-D7): a `lineHeight` attribute on whole
 * textblocks, rendered as `style="line-height: <value>"` on the block
 * element — the Docs / Word paragraph setting.
 *
 * Deliberately not Tiptap's `LineHeight`, which puts the value on an inline
 * `textStyle` span: an inline `line-height` can grow a line box but never
 * shrink it below the block's own. The extension name and commands differ
 * from Tiptap's, so a consumer can still add that one as well.
 *
 * In Markdown a block carrying a line height falls back to whole-node HTML,
 * the path aligned blocks take, and the attribute travels in that HTML.
 */
export const MlvEditorBlockLineHeight =
  Extension.create<MlvEditorBlockLineHeightOptions>({
    name: 'blockLineHeight',

    addOptions() {
      return { types: ['heading', 'paragraph'] };
    },

    addGlobalAttributes() {
      return [
        {
          types: [...this.options.types],
          attributes: {
            lineHeight: {
              default: null,
              // The raw inline value, not the canonicalized `style.lineHeight`.
              parseHTML: (element) =>
                getStyleProperty(element, 'line-height') ??
                (element.style.lineHeight || null),
              renderHTML: (attributes) =>
                attributes['lineHeight']
                  ? { style: `line-height: ${attributes['lineHeight']}` }
                  : {},
            },
          },
        },
      ];
    },

    addCommands() {
      const types = (): readonly string[] => this.options.types;
      const write =
        (lineHeight: string | null) =>
        ({ tr, state, dispatch }: CommandProps): boolean => {
          const allowed = types();
          let touched = false;
          for (const { $from, $to } of state.selection.ranges) {
            state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
              if (!node.isTextblock) return true;
              if (allowed.includes(node.type.name)) {
                touched = true;
                if (dispatch && node.attrs['lineHeight'] !== lineHeight) {
                  tr.setNodeAttribute(pos, 'lineHeight', lineHeight);
                }
              }
              return false;
            });
          }
          return touched;
        };
      return {
        setBlockLineHeight: (lineHeight) => write(lineHeight),
        unsetBlockLineHeight: () => write(null),
      };
    },
  });
