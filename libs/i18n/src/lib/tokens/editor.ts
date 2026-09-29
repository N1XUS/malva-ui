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
};
