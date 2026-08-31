export * from './lib/editor.tokens';
export * from './lib/editor.types';
// The AI toolkit implementation lives in this entry point so `mlv-editor`
// can provide the per-editor context without a package cycle; the
// `@malva-ui/editor/ai` barrel re-exports it as the documented surface.
export * from './lib/ai/editor-ai-actions';
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
export * from './lib/extensions/editor-block-handle';
export * from './lib/extensions/editor-extensions';
export * from './lib/extensions/editor-upload-placeholder';
export * from './lib/status/editor-status';
export * from './lib/toolbar/editor-alignment';
export * from './lib/toolbar/editor-block-insert';
export * from './lib/toolbar/editor-heading';
export * from './lib/toolbar/editor-highlight';
export * from './lib/toolbar/editor-inline-marks';
export * from './lib/toolbar/editor-list';
export * from './lib/toolbar/editor-link';
export { MlvEditorImageUpload } from './lib/toolbar/editor-image-upload';
export * from './lib/toolbar/editor-table';
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
