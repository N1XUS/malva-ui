import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

/** Accessible and default copy used by the rich-text editor. */
export interface MlvEditorI18n {
  /** Accessible editor label. */ editorLabel: string;
  /** Accessible toolbar label. */ toolbarLabel: string;
  /** Undo action label. */ undo: string;
  /** Redo action label. */ redo: string;
  /** Zoom control label. */ zoom: string;
  /** Fit editor content to its container label. */ fitToContainer: string;
  /** Paragraph style label. */ paragraph: string;
  /** Heading level control label. */ headingLevel: string;
  /** Bullet-list action label. */ bulletList: string;
  /** Ordered-list action label. */ orderedList: string;
  /** Task-list action label. */ taskList: string;
  /** Bold action label. */ bold: string;
  /** Italic action label. */ italic: string;
  /** Strike-through action label. */ strike: string;
  /** Underline action label. */ underline: string;
  /** Text-color control label. */ textColor: string;
  /** Highlight-color control label. */ highlightColor: string;
  /** Text-alignment control label. */ alignment: string;
  /** Align-left action label. */ alignLeft: string;
  /** Align-center action label. */ alignCenter: string;
  /** Align-right action label. */ alignRight: string;
  /** Justify action label. */ alignJustify: string;
  /** Link control label. */ link: string;
  /** Link URL input label. */ linkUrl: string;
  /** Link text input label. */ linkText: string;
  /** Invalid-link validation message. */ invalidLink: string;
  /** Open-link-in-new-tab label. */ openInNewTab: string;
  /** Apply-link action label. */ applyLink: string;
  /** Remove-link action label. */ removeLink: string;
  /** Table control label. */ table: string;
  /** Insert-table action label. */ insertTable: string;
  /** Add-row-before action label. */ addRowBefore: string;
  /** Add-row-after action label. */ addRowAfter: string;
  /** Delete-row action label. */ deleteRow: string;
  /** Add-column-before action label. */ addColumnBefore: string;
  /** Add-column-after action label. */ addColumnAfter: string;
  /** Delete-column action label. */ deleteColumn: string;
  /** Merge-cells action label. */ mergeCells: string;
  /** Split-cell action label. */ splitCell: string;
  /** Toggle-header-row action label. */ toggleHeaderRow: string;
  /** Toggle-header-column action label. */ toggleHeaderColumn: string;
  /** Toggle-header-cell action label. */ toggleHeaderCell: string;
  /** Delete-table action label. */ deleteTable: string;
  /** Row grip label on a hovered table row. */ rowActions: string;
  /** Column grip label on a hovered table column. */ columnActions: string;
  /** Corner grip label addressing the whole table. */ tableActions: string;
  /** Blockquote action label. */ blockquote: string;
  /** Code-block action label. */ codeBlock: string;
  /** Horizontal-rule action label. */ horizontalRule: string;
  /** Image control label. */ image: string;
  /** Upload-image action label. */ uploadImage: string;
  /** Image alt-text input label. */ imageAltText: string;
  /** Image title input label. */ imageTitle: string;
  /** Required-image-alt-text validation message. */ imageAltRequired: string;
  /** Decorative-image option label. */ decorativeImage: string;
  /** Invalid-image-type validation message. */ invalidImageType: string;
  /** Image-size validation message. */ imageTooLarge: string;
  /** Too-many-images validation message. */ tooManyImages: string;
  /** Image-upload failure message. */ imageUploadFailed: string;
  /** Cancel-upload action label. */ cancelUpload: string;
  /** Retry-upload action label. */ retryUpload: string;
  /** Upload-progress message. ICU: "Uploading image: {progress}%". */ uploadProgress: string;
  /** Character-count message. ICU plural with `count`. */ characters: string;
  /** Word-count message. ICU plural with `count`. */ words: string;
  /** Overflow-formatting menu label. */ moreFormatting: string;
  /** Block drag-handle label. */ dragBlock: string;
  /** Block-move announcement. ICU with `type`, `position`, and `total`. */ blockMoved: string;
  /** AI transforms menu label. */ aiMenu: string;
  /** Improve-writing transform label. */ aiImprove: string;
  /** Fix-grammar transform label. */ aiFixGrammar: string;
  /** Shorten transform label. */ aiShorten: string;
  /** Extend transform label. */ aiExtend: string;
  /** Summarize transform label. */ aiSummarize: string;
  /** Change-tone transform label. */ aiTone: string;
  /** Translate transform label. */ aiTranslate: string;
  /** Custom-prompt transform label. */ aiCustom: string;
  /** Custom-prompt input placeholder. */ aiPromptPlaceholder: string;
  /** Output-mode radio-group label. */ aiOutputMode: string;
  /** Replace-selection output-mode label. */ aiReplaceSelection: string;
  /** Insert-below output-mode label. */ aiInsertBelow: string;
  /** Review-changes output-mode label. */ aiReviewChanges: string;
  /** Apply-custom-prompt action label. */ aiApply: string;
  /** Cancel-AI-request action label. */ aiCancel: string;
  /** AI-streaming-started announcement. */ aiStreamingStarted: string;
  /** AI-streaming-finished announcement. */ aiStreamingFinished: string;
  /** AI-streaming-cancelled announcement. */ aiStreamingCancelled: string;
  /** AI-review-started announcement. ICU plural with `count`. */ aiReviewStarted: string;
  /** AI-review-produced-no-changes announcement. */ aiReviewNoChanges: string;
  /** Suggestion-accepted announcement. */ aiSuggestionAccepted: string;
  /** Suggestion-rejected announcement. */ aiSuggestionRejected: string;
  /** All-suggestions-accepted announcement. */ aiAllSuggestionsAccepted: string;
  /** All-suggestions-rejected announcement. */ aiAllSuggestionsRejected: string;
  /** Review-bar group label. */ aiReviewBar: string;
  /** Pending-suggestion count. ICU plural with `count`. */ aiReviewCount: string;
  /** Previous-suggestion navigation label. */ aiPreviousSuggestion: string;
  /** Next-suggestion navigation label. */ aiNextSuggestion: string;
  /** Accept-current-suggestion action label. */ aiAcceptSuggestion: string;
  /** Reject-current-suggestion action label. */ aiRejectSuggestion: string;
  /** Accept-all-suggestions action label. */ aiAcceptAll: string;
  /** Reject-all-suggestions action label. */ aiRejectAll: string;
  /** Stop-AI-generation action label. */ aiStopGeneration: string;
  /** Current-suggestion description for a replacement. ICU with `index`, `count`, `oldText`, `newText`. */ aiCurrentSuggestionReplace: string;
  /** Current-suggestion description for an insertion. ICU with `index`, `count`, `newText`. */ aiCurrentSuggestionInsert: string;
  /** Current-suggestion description for a removal. ICU with `index`, `count`, `oldText`. */ aiCurrentSuggestionDelete: string;
  /**
   * Placeholder of an empty editor, unless `placeholder` is bound.
   *
   * Optional so a hand-written or older pack still type-checks; `mlv-editor`
   * falls back to English when it is missing. Every shipped pack declares it.
   */
  placeholder?: string;
  /**
   * Inline-code mark button label.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  inlineCode?: string;
  /**
   * Subscript mark button label.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  subscript?: string;
  /**
   * Superscript mark button label.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  superscript?: string;
  /**
   * Clear-formatting button label.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  clearFormatting?: string;
  /**
   * Font-family menu label.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  fontFamily?: string;
  /**
   * Font-size menu label.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  fontSize?: string;
  /**
   * Line-height menu label.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  lineHeight?: string;
  /**
   * Default (unset) option label in the font, size and line-height menus.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  defaultStyle?: string;
  /**
   * Built-in sans-serif font family label.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  fontFamilySans?: string;
  /**
   * Built-in serif font family label.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  fontFamilySerif?: string;
  /**
   * Built-in monospace font family label.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  fontFamilyMono?: string;
  /**
   * Copy-link-to-heading button and menu item label.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  copyHeadingLink?: string;
  /**
   * Heading-link-copied announcement.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  headingLinkCopied?: string;
  /**
   * Accessible name of a style menu trigger that shows its current value
   * ("Font size: 16"). ICU with `label` (the menu label) and `value` (the
   * current value, or the default-style label).
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  styleValue?: string;
  /**
   * Collaboration status while the transport connects (`mlv-editor-presence`).
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  collaborationConnecting?: string;
  /**
   * Collaboration status while the first sync of a connection runs.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  collaborationSyncing?: string;
  /**
   * Collaboration status once the document is in sync.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  collaborationSynced?: string;
  /**
   * Collaboration status while disconnected; also announced when a synced session goes offline.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  collaborationOffline?: string;
  /**
   * Collaboration status, and announcement, once the host ended the session.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  collaborationClosed?: string;
  /**
   * Collaboration status, and announcement, once the session failed.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  collaborationFailed?: string;
  /**
   * Visually hidden count of the other people in the document. ICU plural with `count`.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  collaborationPeers?: string;
  /**
   * Accessible name of the `mlv-editor-presence` group.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  collaborationPresenceLabel?: string;
  /**
   * A peer who can only view the document. ICU with `name`.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  collaborationViewing?: string;
  /**
   * Name shown for a peer, or the local user, with no name.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  collaborationAnonymous?: string;
  /**
   * Announcement when a peer's edit cancels an in-progress block drag.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  collaborationMoveCancelled?: string;
  /**
   * Announcement when an offline session is back in sync.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  collaborationBackOnline?: string;
  /**
   * Announcement when the first sync did not arrive in time.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  collaborationSyncTimeout?: string;

  // Clean mode (#516)
  /**
   * Block-type dropdown trigger name prefix ("Block type: Heading level 2").
   * Read through `styleValue` as its `label`.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  blockType?: string;
  /**
   * Block-type dropdown menu label: converts the selected blocks to another
   * type.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  turnInto?: string;
  /**
   * Clean-mode block inserter: the gutter "+" tooltip, the bubble's insert
   * button name and the command menu's label.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  insertBlock?: string;
  /**
   * Command-menu group label for the AI items.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  insertGroupAi?: string;
  /**
   * Command-menu group label for the paragraph, heading, quote and code-block
   * items.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  insertGroupStyle?: string;
  /**
   * Command-menu group label for the bullet, ordered and task list items.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  insertGroupLists?: string;
  /**
   * Command-menu group label for the table, divider and image items.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  insertGroupInsert?: string;
  /**
   * Command-menu item that opens the AI prompt and writes the answer below
   * the block.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  askAi?: string;
  /**
   * Accessible name of the `nav[mlvEditorToc]` landmark, unless the consumer
   * names it with `ariaLabel`.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  tableOfContents?: string;
  /**
   * Text `nav[mlvEditorToc]` shows while the document has no heading it
   * lists.
   *
   * Optional so a hand-written pack still type-checks; the editor falls back
   * to English when it is missing. Every shipped pack declares it.
   */
  tableOfContentsEmpty?: string;
}

/** Signal token for the rich-text editor's translated copy. */
export const MLV_EDITOR_I18N = new InjectionToken<Signal<MlvEditorI18n>>(
  'MLV_EDITOR_I18N',
);

/** Translation metadata for rich-text editor copy. */
export const MLV_EDITOR_I18N_CONTEXT: Record<
  keyof MlvEditorI18n,
  MlvTranslationContext
> = {
  editorLabel: {
    component: 'mlv-editor',
    usage: 'aria-label',
    description: 'Accessible label for the editor content area',
  },
  toolbarLabel: {
    component: 'mlv-editor-toolbar',
    usage: 'aria-label',
    description: 'Accessible label for the editor toolbar',
  },
  undo: {
    component: 'mlv-editor-undo-redo',
    usage: 'aria-label',
    description: 'Undo button',
  },
  redo: {
    component: 'mlv-editor-undo-redo',
    usage: 'aria-label',
    description: 'Redo button',
  },
  zoom: {
    component: 'mlv-editor-zoom',
    usage: 'aria-label',
    description: 'View-only zoom control',
  },
  fitToContainer: {
    component: 'mlv-editor-zoom',
    usage: 'label',
    description: 'Option that fits editor content to its container',
  },
  paragraph: {
    component: 'mlv-editor-heading',
    usage: 'label',
    description: 'Paragraph block style',
  },
  headingLevel: {
    component: 'mlv-editor-heading',
    usage: 'aria-label',
    description: 'Heading level control',
  },
  bulletList: {
    component: 'mlv-editor-list',
    usage: 'aria-label',
    description: 'Bullet list button',
  },
  orderedList: {
    component: 'mlv-editor-list',
    usage: 'aria-label',
    description: 'Ordered list button',
  },
  taskList: {
    component: 'mlv-editor-list',
    usage: 'aria-label',
    description: 'Task list button',
  },
  bold: {
    component: 'mlv-editor-inline-marks',
    usage: 'aria-label',
    description: 'Bold button',
  },
  italic: {
    component: 'mlv-editor-inline-marks',
    usage: 'aria-label',
    description: 'Italic button',
  },
  strike: {
    component: 'mlv-editor-inline-marks',
    usage: 'aria-label',
    description: 'Strike-through button',
  },
  underline: {
    component: 'mlv-editor-inline-marks',
    usage: 'aria-label',
    description: 'Underline button',
  },
  textColor: {
    component: 'mlv-editor-text-color',
    usage: 'aria-label',
    description: 'Text color picker trigger',
  },
  highlightColor: {
    component: 'mlv-editor-highlight',
    usage: 'aria-label',
    description: 'Highlight color picker trigger',
  },
  alignment: {
    component: 'mlv-editor-alignment',
    usage: 'aria-label',
    description: 'Text alignment control',
  },
  alignLeft: {
    component: 'mlv-editor-alignment',
    usage: 'aria-label',
    description: 'Align text left',
  },
  alignCenter: {
    component: 'mlv-editor-alignment',
    usage: 'aria-label',
    description: 'Center text',
  },
  alignRight: {
    component: 'mlv-editor-alignment',
    usage: 'aria-label',
    description: 'Align text right',
  },
  alignJustify: {
    component: 'mlv-editor-alignment',
    usage: 'aria-label',
    description: 'Justify text',
  },
  link: {
    component: 'mlv-editor-link',
    usage: 'aria-label',
    description: 'Link control',
  },
  linkUrl: {
    component: 'mlv-editor-link',
    usage: 'label',
    description: 'Link URL input',
  },
  linkText: {
    component: 'mlv-editor-link',
    usage: 'label',
    description: 'Link text input',
  },
  invalidLink: {
    component: 'mlv-editor-link',
    usage: 'message',
    description: 'Invalid link validation message',
  },
  openInNewTab: {
    component: 'mlv-editor-link',
    usage: 'label',
    description: 'Open link in new tab option',
  },
  applyLink: {
    component: 'mlv-editor-link',
    usage: 'button-text',
    description: 'Apply link button',
  },
  removeLink: {
    component: 'mlv-editor-link',
    usage: 'button-text',
    description: 'Remove link button',
  },
  table: {
    component: 'mlv-editor-table',
    usage: 'aria-label',
    description: 'Table control',
  },
  insertTable: {
    component: 'mlv-editor-table',
    usage: 'button-text',
    description: 'Insert table button',
  },
  addRowBefore: {
    component: 'mlv-editor-table',
    usage: 'button-text',
    description: 'Add row before button',
  },
  addRowAfter: {
    component: 'mlv-editor-table',
    usage: 'button-text',
    description: 'Add row after button',
  },
  deleteRow: {
    component: 'mlv-editor-table',
    usage: 'button-text',
    description: 'Delete row button',
  },
  addColumnBefore: {
    component: 'mlv-editor-table',
    usage: 'button-text',
    description: 'Add column before button',
  },
  addColumnAfter: {
    component: 'mlv-editor-table',
    usage: 'button-text',
    description: 'Add column after button',
  },
  deleteColumn: {
    component: 'mlv-editor-table',
    usage: 'button-text',
    description: 'Delete column button',
  },
  mergeCells: {
    component: 'mlv-editor-table',
    usage: 'button-text',
    description: 'Merge selected cells button',
  },
  splitCell: {
    component: 'mlv-editor-table',
    usage: 'button-text',
    description: 'Split cell button',
  },
  toggleHeaderRow: {
    component: 'mlv-editor-table',
    usage: 'button-text',
    description: 'Toggle header row button',
  },
  toggleHeaderColumn: {
    component: 'mlv-editor-table',
    usage: 'button-text',
    description: 'Toggle header column button',
  },
  toggleHeaderCell: {
    component: 'mlv-editor-table',
    usage: 'button-text',
    description: 'Toggle header cell button',
  },
  deleteTable: {
    component: 'mlv-editor-table',
    usage: 'button-text',
    description: 'Delete table button',
  },
  rowActions: {
    component: 'mlv-editor-table-controls',
    usage: 'aria-label',
    description: "Row grip opening the hovered row's table commands",
  },
  columnActions: {
    component: 'mlv-editor-table-controls',
    usage: 'aria-label',
    description: "Column grip opening the hovered column's table commands",
  },
  tableActions: {
    component: 'mlv-editor-table-controls',
    usage: 'aria-label',
    description: 'Corner grip opening the whole-table commands',
  },
  blockquote: {
    component: 'mlv-editor-block-insert',
    usage: 'aria-label',
    description: 'Blockquote button',
  },
  codeBlock: {
    component: 'mlv-editor-block-insert',
    usage: 'aria-label',
    description: 'Code block button',
  },
  horizontalRule: {
    component: 'mlv-editor-block-insert',
    usage: 'aria-label',
    description: 'Horizontal rule button',
  },
  image: {
    component: 'mlv-editor-image-upload',
    usage: 'aria-label',
    description: 'Image upload control',
  },
  uploadImage: {
    component: 'mlv-editor-image-upload',
    usage: 'button-text',
    description: 'Upload image button',
  },
  imageAltText: {
    component: 'mlv-editor-image-upload',
    usage: 'label',
    description: 'Image alternative text input',
  },
  imageTitle: {
    component: 'mlv-editor-image-upload',
    usage: 'label',
    description: 'Image title input',
  },
  imageAltRequired: {
    component: 'mlv-editor-image-upload',
    usage: 'message',
    description: 'Required image alternative text message',
  },
  decorativeImage: {
    component: 'mlv-editor-image-upload',
    usage: 'label',
    description: 'Decorative image option',
  },
  invalidImageType: {
    component: 'mlv-editor-image-upload',
    usage: 'message',
    description: 'Invalid image file type message',
  },
  imageTooLarge: {
    component: 'mlv-editor-image-upload',
    usage: 'message',
    description: 'Image file too large message',
  },
  tooManyImages: {
    component: 'mlv-editor-image-upload',
    usage: 'message',
    description: 'Too many images selected message',
  },
  imageUploadFailed: {
    component: 'mlv-editor-image-upload',
    usage: 'message',
    description: 'Image upload failure message',
  },
  cancelUpload: {
    component: 'mlv-editor-image-upload',
    usage: 'button-text',
    description: 'Cancel image upload button',
  },
  retryUpload: {
    component: 'mlv-editor-image-upload',
    usage: 'button-text',
    description: 'Retry image upload button',
  },
  uploadProgress: {
    component: 'mlv-editor-image-upload',
    usage: 'message',
    icuParams: ['progress'],
    description: 'Image upload progress announcement',
  },
  characters: {
    component: 'mlv-editor-status',
    usage: 'message',
    icuParams: ['count'],
    description: 'Character count',
  },
  words: {
    component: 'mlv-editor-status',
    usage: 'message',
    icuParams: ['count'],
    description: 'Word count',
  },
  moreFormatting: {
    component: 'mlv-editor-toolbar',
    usage: 'aria-label',
    description: 'Overflow formatting menu',
  },
  dragBlock: {
    component: 'mlv-editor',
    usage: 'aria-label',
    description:
      'Label for the gutter handle that drags a block to a new position',
  },
  blockMoved: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    icuParams: ['type', 'position', 'total'],
    description:
      'Polite screen-reader announcement after a block moves. `type` is the raw ProseMirror node type name, `position` is one-based, `total` is the top-level block count.',
  },
  aiMenu: {
    component: 'mlv-editor-ai-menu',
    usage: 'aria-label',
    description: 'AI transforms menu trigger',
  },
  aiImprove: {
    component: 'mlv-editor-ai-menu',
    usage: 'label',
    description: 'Improve-writing transform menu item',
  },
  aiFixGrammar: {
    component: 'mlv-editor-ai-menu',
    usage: 'label',
    description: 'Fix-grammar transform menu item',
  },
  aiShorten: {
    component: 'mlv-editor-ai-menu',
    usage: 'label',
    description: 'Shorten transform menu item',
  },
  aiExtend: {
    component: 'mlv-editor-ai-menu',
    usage: 'label',
    description: 'Extend transform menu item',
  },
  aiSummarize: {
    component: 'mlv-editor-ai-menu',
    usage: 'label',
    description: 'Summarize transform menu item',
  },
  aiTone: {
    component: 'mlv-editor-ai-menu',
    usage: 'label',
    description: 'Change-tone transform menu item',
  },
  aiTranslate: {
    component: 'mlv-editor-ai-menu',
    usage: 'label',
    description: 'Translate transform menu item',
  },
  aiCustom: {
    component: 'mlv-editor-ai-menu',
    usage: 'label',
    description: 'Custom-prompt transform menu item',
  },
  aiPromptPlaceholder: {
    component: 'mlv-editor-ai-menu',
    usage: 'placeholder',
    description: 'Custom AI prompt input placeholder',
  },
  aiOutputMode: {
    component: 'mlv-editor-ai-menu',
    usage: 'label',
    description:
      'Label naming the output-mode radio group in the custom AI prompt',
  },
  aiReplaceSelection: {
    component: 'mlv-editor-ai-menu',
    usage: 'label',
    description: 'Output mode that replaces the current selection',
  },
  aiInsertBelow: {
    component: 'mlv-editor-ai-menu',
    usage: 'label',
    description: 'Output mode that inserts the result below the selection',
  },
  aiReviewChanges: {
    component: 'mlv-editor-ai-menu',
    usage: 'label',
    description:
      'Output mode that lands the result as reviewable tracked suggestions',
  },
  aiApply: {
    component: 'mlv-editor-ai-menu',
    usage: 'button-text',
    description: 'Apply custom AI prompt button',
  },
  aiCancel: {
    component: 'mlv-editor-ai-menu',
    usage: 'button-text',
    description: 'Cancel AI request button',
  },
  aiStreamingStarted: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    description:
      'Polite screen-reader announcement when AI output starts streaming into the document',
  },
  aiStreamingFinished: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    description:
      'Polite screen-reader announcement when AI output finishes streaming',
  },
  aiStreamingCancelled: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    description:
      'Polite screen-reader announcement when an AI request is cancelled and the document is restored',
  },
  aiReviewStarted: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    icuParams: ['count'],
    description:
      'Polite screen-reader announcement when AI suggestions are applied for review. `count` is the number of pending suggestions.',
  },
  aiReviewNoChanges: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    description:
      'Polite screen-reader announcement when an AI review produced output identical to the original, so nothing needs reviewing',
  },
  aiSuggestionAccepted: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    description:
      'Polite screen-reader announcement after one AI suggestion is accepted',
  },
  aiSuggestionRejected: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    description:
      'Polite screen-reader announcement after one AI suggestion is rejected',
  },
  aiAllSuggestionsAccepted: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    description:
      'Polite screen-reader announcement after every pending AI suggestion is accepted at once',
  },
  aiAllSuggestionsRejected: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    description:
      'Polite screen-reader announcement after every pending AI suggestion is rejected at once',
  },
  aiReviewBar: {
    component: 'mlv-editor-ai-review-bar',
    usage: 'aria-label',
    description: 'Group label naming the AI suggestion review bar',
  },
  aiReviewCount: {
    component: 'mlv-editor-ai-review-bar',
    usage: 'message',
    icuParams: ['count'],
    description:
      'Visible pending-suggestion count in the review bar. `count` is the number of unresolved suggestions.',
  },
  aiPreviousSuggestion: {
    component: 'mlv-editor-ai-review-bar',
    usage: 'aria-label',
    description: 'Button that navigates to the previous pending AI suggestion',
  },
  aiNextSuggestion: {
    component: 'mlv-editor-ai-review-bar',
    usage: 'aria-label',
    description: 'Button that navigates to the next pending AI suggestion',
  },
  aiAcceptSuggestion: {
    component: 'mlv-editor-ai-review-bar',
    usage: 'aria-label',
    description: 'Button that accepts the current AI suggestion',
  },
  aiRejectSuggestion: {
    component: 'mlv-editor-ai-review-bar',
    usage: 'aria-label',
    description: 'Button that rejects the current AI suggestion',
  },
  aiAcceptAll: {
    component: 'mlv-editor-ai-review-bar',
    usage: 'button-text',
    description: 'Button that accepts every pending AI suggestion',
  },
  aiRejectAll: {
    component: 'mlv-editor-ai-review-bar',
    usage: 'button-text',
    description: 'Button that rejects every pending AI suggestion',
  },
  aiStopGeneration: {
    component: 'mlv-editor-ai-review-bar',
    usage: 'button-text',
    description:
      'Button that stops the in-flight AI generation while the review bar shows its running state',
  },
  aiCurrentSuggestionReplace: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    icuParams: ['index', 'count', 'oldText', 'newText'],
    description:
      'Non-visual description of the current AI replace suggestion, announced politely on reveal and exposed to the review controls. `index` is one-based, `count` is the pending total, `oldText`/`newText` are the swapped texts.',
  },
  aiCurrentSuggestionInsert: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    icuParams: ['index', 'count', 'newText'],
    description:
      'Non-visual description of the current AI insert suggestion. `index` is one-based, `count` is the pending total, `newText` is the added text.',
  },
  aiCurrentSuggestionDelete: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    icuParams: ['index', 'count', 'oldText'],
    description:
      'Non-visual description of the current AI delete suggestion. `index` is one-based, `count` is the pending total, `oldText` is the removed text.',
  },
  placeholder: {
    component: 'mlv-editor',
    usage: 'placeholder',
    description:
      'Placeholder shown in an empty rich-text editor, inviting the user to write',
  },
  inlineCode: {
    component: 'mlv-editor-inline-marks',
    usage: 'aria-label',
    description: 'Inline-code mark button',
  },
  subscript: {
    component: 'mlv-editor-inline-marks',
    usage: 'aria-label',
    description: 'Subscript mark button',
  },
  superscript: {
    component: 'mlv-editor-inline-marks',
    usage: 'aria-label',
    description: 'Superscript mark button',
  },
  clearFormatting: {
    component: 'mlv-editor-clear-formatting',
    usage: 'aria-label',
    description:
      'Button that removes every text mark except links from the selection',
  },
  fontFamily: {
    component: 'mlv-editor-font-family',
    usage: 'aria-label',
    description:
      'Font family menu; the trigger name also carries the current family',
  },
  fontSize: {
    component: 'mlv-editor-font-size',
    usage: 'aria-label',
    description:
      'Font size menu; the trigger name also carries the current size',
  },
  lineHeight: {
    component: 'mlv-editor-line-height',
    usage: 'aria-label',
    description: 'Block line-height menu',
  },
  defaultStyle: {
    component: 'mlv-editor-font-family',
    usage: 'label',
    description:
      'First item of the font, size and line-height menus; it removes the explicit value so the default applies',
  },
  fontFamilySans: {
    component: 'mlv-editor-font-family',
    usage: 'label',
    description: 'Built-in sans-serif font family option',
  },
  fontFamilySerif: {
    component: 'mlv-editor-font-family',
    usage: 'label',
    description: 'Built-in serif font family option',
  },
  fontFamilyMono: {
    component: 'mlv-editor-font-family',
    usage: 'label',
    description: 'Built-in monospace font family option',
  },
  copyHeadingLink: {
    component: 'mlv-editor',
    usage: 'aria-label',
    description:
      'Button beside a heading, and heading-menu item, that copies a link to that heading',
  },
  headingLinkCopied: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    description:
      'Polite screen-reader announcement after a heading link is copied to the clipboard',
  },
  styleValue: {
    component: 'mlv-editor-font-size',
    usage: 'aria-label',
    description:
      'Name of the font family, font size and line-height menu triggers: the menu label followed by the value the trigger shows; keep the value last so the visible text stays part of the name',
    icuParams: ['label', 'value'],
  },
  collaborationConnecting: {
    component: 'mlv-editor-presence',
    usage: 'label',
    description:
      'Collaboration status while the connection to the shared document is being set up',
  },
  collaborationSyncing: {
    component: 'mlv-editor-presence',
    usage: 'label',
    description:
      'Collaboration status while the shared document is being synchronised after connecting',
  },
  collaborationSynced: {
    component: 'mlv-editor-presence',
    usage: 'label',
    description:
      'Collaboration status once every change is synchronised with the other people',
  },
  collaborationOffline: {
    component: 'mlv-editor-presence',
    usage: 'live-announcement',
    description:
      'Collaboration status while offline, also announced politely when a synchronised session loses its connection; local edits keep working and sync later',
  },
  collaborationClosed: {
    component: 'mlv-editor-presence',
    usage: 'live-announcement',
    description:
      'Collaboration status, also announced politely, once the host application ended the shared session; the document becomes read-only',
  },
  collaborationFailed: {
    component: 'mlv-editor-presence',
    usage: 'live-announcement',
    description:
      'Collaboration status, also announced politely, once the shared session failed; the document becomes read-only',
  },
  collaborationPeers: {
    component: 'mlv-editor-presence',
    usage: 'label',
    description:
      'Visually hidden count of the other people currently in the document',
    icuParams: ['count'],
  },
  collaborationPresenceLabel: {
    component: 'mlv-editor-presence',
    usage: 'aria-label',
    description:
      'Accessible name of the group listing the people in a shared document and the connection status',
  },
  collaborationViewing: {
    component: 'mlv-editor-presence',
    usage: 'label',
    description:
      'Name of a person who can only view, not edit, the shared document',
    icuParams: ['name'],
  },
  collaborationAnonymous: {
    component: 'mlv-editor-presence',
    usage: 'label',
    description: 'Name shown for a person in a shared document who has no name',
  },
  collaborationMoveCancelled: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    description:
      'Polite announcement when someone else changed the document while the user was dragging a block, so the move was cancelled',
  },
  collaborationBackOnline: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    description:
      'Polite announcement when an offline shared document is connected and synchronised again',
  },
  collaborationSyncTimeout: {
    component: 'mlv-editor',
    usage: 'live-announcement',
    description:
      'Polite announcement when the shared document did not synchronise in time; editing starts once it does',
  },
  // Clean mode (#516)
  blockType: {
    component: 'mlv-editor-block-type',
    usage: 'aria-label',
    description:
      'First half of the block-type dropdown trigger name, before the current block type the trigger shows (the label of the styleValue template); a short noun phrase',
  },
  turnInto: {
    component: 'mlv-editor-block-type',
    usage: 'label',
    description:
      'Label of the block-type dropdown menu, whose items convert the selected blocks to a paragraph, heading, list, quote or code block',
  },
  insertBlock: {
    component: 'mlv-editor',
    usage: 'label',
    description:
      'Name of the clean-mode block inserter: the tooltip of the "+" beside a block, the insert button in the selection bubble and the label of the menu of blocks to insert; an imperative verb phrase',
  },
  insertGroupAi: {
    component: 'mlv-editor',
    usage: 'label',
    description:
      'Heading of the insert-menu group holding the AI items; keep the abbreviation "AI" unless the locale has an established short form',
  },
  insertGroupStyle: {
    component: 'mlv-editor',
    usage: 'label',
    description:
      'Heading of the insert-menu group holding the paragraph, heading, quote and code-block items; a short noun phrase such as "Basic blocks"',
  },
  insertGroupLists: {
    component: 'mlv-editor',
    usage: 'label',
    description:
      'Heading of the insert-menu group holding the bullet, numbered and checklist items',
  },
  insertGroupInsert: {
    component: 'mlv-editor',
    usage: 'label',
    description:
      'Heading of the insert-menu group holding the table, divider and image items; a short word for inserting objects',
  },
  askAi: {
    component: 'mlv-editor',
    usage: 'label',
    description:
      'Insert-menu item that opens an AI prompt whose answer is written below the block; ends with an ellipsis because it opens a dialog',
  },
  tableOfContents: {
    component: 'mlv-editor',
    usage: 'aria-label',
    description:
      'Screen-reader name of the navigation landmark listing the headings of the document',
  },
  tableOfContentsEmpty: {
    component: 'mlv-editor',
    usage: 'label',
    description:
      'Text shown in the table of contents while the document has no headings yet',
  },
};
