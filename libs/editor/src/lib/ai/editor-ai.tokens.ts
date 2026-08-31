import { InjectionToken } from '@angular/core';
import { type MlvEditorAiProvider } from './editor-ai.types';

/**
 * Optional dependency-injection token for a host-provided AI transport.
 *
 * The per-editor `aiProvider` input wins over this token, mirroring
 * `MLV_EDITOR_IMAGE_UPLOADER` precedence. Without either, AI UI modules hide
 * and AI commands are unavailable.
 */
export const MLV_EDITOR_AI_PROVIDER = new InjectionToken<MlvEditorAiProvider>(
  'MLV_EDITOR_AI_PROVIDER',
);
