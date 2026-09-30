/**
 * Public surface of `@malva-ui/editor/ai`.
 *
 * The implementation lives in the primary entry point: `mlv-editor` provides
 * the per-editor AI context, and the primary entry importing this secondary
 * one (which already depends on the primary) would be a package cycle. This
 * barrel re-exports the toolkit under its documented import path, so
 * consumers keep importing `@malva-ui/editor/ai` and symbol identity is a
 * single module in every build.
 */
export {
  applyMlvEditorAiSuggestions,
  MLV_EDITOR_AI_CARET_CLASS,
  MLV_EDITOR_AI_CONTEXT,
  MLV_EDITOR_AI_PROVIDER,
  MLV_EDITOR_AI_STREAMING_CHUNK_CLASS,
  MLV_EDITOR_AI_STREAMING_CLASS,
  MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS,
  MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS,
  MLV_EDITOR_AI_SUGGESTION_INSERT_CLASS,
  MlvEditorAiContext,
  mlvEditorAiDefaultActions,
  MlvEditorAiImprove,
  MlvEditorAiMenu,
  MlvEditorAiReviewBar,
  runMlvEditorAiStream,
} from '@malva-ui/editor';
export type {
  MlvEditorAiAction,
  MlvEditorAiBuiltInTransformKind,
  MlvEditorAiFrameScheduler,
  MlvEditorAiOutputMode,
  MlvEditorAiProvider,
  MlvEditorAiRequest,
  MlvEditorAiReviewSuggestion,
  MlvEditorAiStatus,
  MlvEditorAiStreamErrorCode,
  MlvEditorAiStreamHandle,
  MlvEditorAiStreamOptions,
  MlvEditorAiStreamOutputMode,
  MlvEditorAiStreamResult,
  MlvEditorAiStreamStatus,
  MlvEditorAiSuggestion,
  MlvEditorAiSuggestionKind,
  MlvEditorAiSuggestionRange,
  MlvEditorAiSuggestionsOptions,
  MlvEditorAiSuggestionsSession,
  MlvEditorAiTransformKind,
  MlvEditorAiTransformOptions,
} from '@malva-ui/editor';
