import { InjectionToken } from '@angular/core';
import type { MlvEditorI18n } from '@malva-ui/i18n';
import type { MlvEditorErrorCode } from '../editor.types';
// The public AI surface: the `@malva-ui/editor/ai` barrel re-exports the
// modules living in this directory, so identity must hold through it.
import * as editorAi from '@malva-ui/editor/ai';
import { MLV_EDITOR_AI_PROVIDER } from './editor-ai.tokens';
import type {
  MlvEditorAiAction,
  MlvEditorAiOutputMode,
  MlvEditorAiProvider,
  MlvEditorAiRequest,
  MlvEditorAiTransformKind,
} from './editor-ai.types';

describe('editor AI entry point', () => {
  it('exports the provider token from the barrel', () => {
    expect(editorAi.MLV_EDITOR_AI_PROVIDER).toBe(MLV_EDITOR_AI_PROVIDER);
    expect(MLV_EDITOR_AI_PROVIDER).toBeInstanceOf(InjectionToken);
    expect(String(MLV_EDITOR_AI_PROVIDER)).toContain('MLV_EDITOR_AI_PROVIDER');
  });

  it('accepts a minimal literal provider implementation', async () => {
    // Compile-time contract: a literal single-chunk provider satisfies the
    // interface without any streaming infrastructure.
    const provider: MlvEditorAiProvider = {
      async *stream(request: MlvEditorAiRequest): AsyncIterable<string> {
        yield `${request.kind}:${request.context.selection ?? ''}`;
      },
    };

    const controller = new AbortController();
    const request: MlvEditorAiRequest = {
      kind: 'improve',
      context: { selection: 'Some text', document: null },
      signal: controller.signal,
    };

    const chunks: string[] = [];
    for await (const chunk of provider.stream(request)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['improve:Some text']);
  });

  it('shapes requests with instruction, meta, and autocomplete kind', () => {
    const controller = new AbortController();
    const request: MlvEditorAiRequest = {
      kind: 'autocomplete',
      instruction: undefined,
      context: { selection: null, document: '# Draft' },
      signal: controller.signal,
      meta: { conversationId: 'session-1' },
    };

    expect(request.kind).toBe('autocomplete');
    expect(request.context.document).toBe('# Draft');
    expect(request.meta).toEqual({ conversationId: 'session-1' });
  });

  it('pins the transform-kind and output-mode unions', () => {
    // The built-in alias is the closed list; it must reach the facade too, so
    // hosts can name it when they switch over the kinds the library ships.
    const kinds: readonly editorAi.MlvEditorAiBuiltInTransformKind[] = [
      'improve',
      'fix-grammar',
      'shorten',
      'extend',
      'summarize',
      'tone',
      'translate',
      'custom',
    ];
    const modes: readonly MlvEditorAiOutputMode[] = [
      'replace-selection',
      'insert-below',
      'review',
    ];

    expect(kinds).toHaveLength(8);
    expect(modes).toHaveLength(3);
  });

  it('admits host-authored transform kinds alongside the built-ins', () => {
    // Compile-time contract: the open union accepts any string, so a host can
    // name a kind its own provider understands.
    const custom: MlvEditorAiTransformKind = 'legal-review';
    const builtIn: MlvEditorAiTransformKind = 'improve';
    const kinds: readonly MlvEditorAiTransformKind[] = [builtIn, custom];

    expect(kinds).toEqual(['improve', 'legal-review']);
  });

  it('accepts declarative actions and actions owning their own behaviour', () => {
    const declarative: MlvEditorAiAction = {
      kind: 'translate',
      label: 'Translate to German',
      instruction: 'German',
      output: 'review',
    };

    const calls: string[] = [];
    const imperative: MlvEditorAiAction = {
      kind: 'legal-review',
      label: 'Legal review',
      // The callback owns the action: it receives the live context, so the
      // structural minimum this test needs is the surface it reads.
      run: (context) => calls.push(context.status()),
    };

    expect(declarative.output).toBe('review');
    imperative.run?.({
      status: () => 'idle',
    } as unknown as editorAi.MlvEditorAiContext);
    expect(calls).toEqual(['idle']);
  });

  it('exports the default action factory from the barrel', () => {
    const actions = editorAi.mlvEditorAiDefaultActions(null);

    expect(actions.map((action) => action.kind)).toEqual([
      'improve',
      'fix-grammar',
      'shorten',
      'extend',
      'summarize',
      'tone',
      'translate',
    ]);
    expect(actions.map((action) => action.label)).toEqual([
      'Improve writing',
      'Fix grammar',
      'Shorten',
      'Extend',
      'Summarize',
      'Change tone',
      'Translate',
    ]);

    // Supplied copy wins per key; missing keys keep the English fallback.
    const localized = editorAi.mlvEditorAiDefaultActions({
      aiImprove: 'Améliorer',
    } as MlvEditorI18n);
    expect(localized[0].label).toBe('Améliorer');
    expect(localized[1].label).toBe('Fix grammar');
  });

  it('extends the editor error-code union with the AI categories', () => {
    const transport: MlvEditorErrorCode = 'ai-transport';
    const result: MlvEditorErrorCode = 'ai-result';

    expect(transport).toBe('ai-transport');
    expect(result).toBe('ai-result');
  });
});
