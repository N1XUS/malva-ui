import type { MlvEditorI18n } from '@malva-ui/i18n';

/**
 * @internal The optional `MlvEditorI18n` keys clean mode added (#516). A
 * hand-written pack may omit them.
 */
export type MlvEditorCleanModeMessageKey =
  | 'blockType'
  | 'turnInto'
  | 'insertBlock'
  | 'insertGroupAi'
  | 'insertGroupStyle'
  | 'insertGroupLists'
  | 'insertGroupInsert'
  | 'askAi'
  | 'tableOfContents'
  | 'tableOfContentsEmpty';

/**
 * @internal English fallbacks of the optional clean-mode keys (#516), the one
 * record every control that reads them falls back to. Kept out of the public
 * barrel; `editor-clean-mode-fallbacks.spec.ts` pins it equal to the English
 * pack, so an English copy edit cannot leave a stale fallback behind.
 */
export const MLV_EDITOR_CLEAN_MODE_FALLBACKS: Readonly<
  Required<Pick<MlvEditorI18n, MlvEditorCleanModeMessageKey>>
> = {
  blockType: 'Block type',
  turnInto: 'Turn into',
  insertBlock: 'Insert block',
  insertGroupAi: 'AI',
  insertGroupStyle: 'Basic blocks',
  insertGroupLists: 'Lists',
  insertGroupInsert: 'Insert',
  askAi: 'Ask AI…',
  tableOfContents: 'Table of contents',
  tableOfContentsEmpty: 'No headings yet',
};
