export * from './lib/editor.tokens';
export * from './lib/editor.types';
// The AI toolkit implementation lives in this entry point so `mlv-editor`
// can provide the per-editor context without a package cycle; the
// `@malva-ui/editor/ai` barrel re-exports it as the documented surface.
export * from './lib/ai/editor-ai-actions';
export * from './lib/ai/editor-ai-improve';
export {
  MLV_EDITOR_AI_CONTEXT,
  MlvEditorAiContext,
} from './lib/ai/editor-ai-context';
export type {
  MlvEditorAiStatus,
  MlvEditorAiTransformOptions,
} from './lib/ai/editor-ai-context';
export * from './lib/ai/editor-ai-menu';
export * from './lib/ai/editor-ai-review-bar';
export * from './lib/ai/editor-ai-stream';
// The word-diff helper and its run type stay out of the public barrels on
// purpose: they are implementation detail of the suggestion engine.
export {
  applyMlvEditorAiSuggestions,
  MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS,
  MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS,
  MLV_EDITOR_AI_SUGGESTION_INSERT_CLASS,
} from './lib/ai/editor-ai-suggestions';
export type {
  MlvEditorAiSuggestion,
  MlvEditorAiSuggestionKind,
  MlvEditorAiSuggestionRange,
  MlvEditorAiSuggestionsOptions,
  MlvEditorAiSuggestionsSession,
} from './lib/ai/editor-ai-suggestions';
export * from './lib/ai/editor-ai.tokens';
export * from './lib/ai/editor-ai.types';
export { MLV_EDITOR_TOOLBAR_CONTEXT } from './lib/editor-toolbar-context';
export type { MlvEditorToolbarContext } from './lib/editor-toolbar-context';
export * from './lib/editor/editor';
// `@internal`: the contract `@malva-ui/editor/collaboration` (same package,
// same version) implements. Not a consumer extension point; outside semver.
// The editor registry and the position tracker stay unexported.
export { MLV_EDITOR_COLLABORATION } from './lib/editor/editor-collaboration.contract';
export type {
  MlvEditorCollaborationAttachContext,
  MlvEditorCollaborationBinding,
} from './lib/editor/editor-collaboration.contract';
export * from './lib/editor/editor-heading-links';
export * from './lib/extensions/block-id/editor-block-id';
export * from './lib/extensions/editor-block-handle';
export * from './lib/extensions/heading-anchors/editor-heading-anchors';
export * from './lib/extensions/editor-extensions';
export * from './lib/extensions/editor-upload-placeholder';
export * from './lib/extensions/script/editor-script';
export * from './lib/extensions/text-style/editor-block-line-height';
export * from './lib/extensions/text-style/editor-reset-formatting';
export * from './lib/insert/editor-insert-items';
export * from './lib/insert/editor-insert.types';
export * from './lib/status/editor-status';
export * from './lib/toc/editor-toc';
export * from './lib/toolbar/editor-alignment';
export * from './lib/toolbar/editor-block-insert';
export * from './lib/toolbar/editor-block-type';
export * from './lib/toolbar/editor-clear-formatting';
export * from './lib/toolbar/editor-font-family';
export * from './lib/toolbar/editor-font-size';
export * from './lib/toolbar/editor-heading';
export * from './lib/toolbar/editor-highlight';
export * from './lib/toolbar/editor-inline-marks';
export * from './lib/toolbar/editor-insert-menu-button';
export * from './lib/toolbar/editor-line-height';
export * from './lib/toolbar/editor-list';
export * from './lib/toolbar/editor-link';
export { MlvEditorImageUpload } from './lib/toolbar/editor-image-upload';
export * from './lib/toolbar/editor-table';
export * from './lib/toolbar/editor-text-styles';
export * from './lib/table/editor-table-controls';
export * from './lib/table/editor-table-geometry';
export * from './lib/toolbar/editor-toolbar.defs';
export { MlvEditorToolbar } from './lib/toolbar/editor-toolbar';
export * from './lib/toolbar/editor-toolbar-widget';
export * from './lib/toolbar/editor-undo-redo';
export * from './lib/toolbar/editor-zoom';
export * from './lib/toolbar/editor-text-color';
export type {
  Editor,
  EditorOptions,
  Extension,
  Extensions,
} from '@tiptap/core';
