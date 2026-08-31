import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  inject,
  signal,
} from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvEditor } from '@malva-ui/editor';
import {
  MLV_EDITOR_AI_CONTEXT,
  MlvEditorAiMenu,
  MlvEditorAiReviewBar,
  type MlvEditorAiProvider,
  type MlvEditorAiRequest,
} from '@malva-ui/editor/ai';

/**
 * Deterministic "proofread" corrections the mock provider applies to the
 * selection. Three separated regions produce three distinct suggestions in
 * the review word diff: one replace, one delete, and one insert.
 */
const CORRECTIONS: readonly (readonly [RegExp, string])[] = [
  [/\bTeh\b/g, 'The'],
  [/\bteh\b/g, 'the'],
  [/\bbasically\s+/g, ''],
  [/(?<!expert )\breviewers\b/g, 'expert reviewers'],
];

/** Applies every correction to the selection; a canned hint without one. */
function proofread(selection: string | null): string {
  if (selection === null || selection.trim().length === 0) {
    return 'Select the draft paragraph first, then rerun the review.';
  }
  return CORRECTIONS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    selection,
  );
}

/** Resolves after one chunk delay, or immediately once the request aborts. */
function nextChunkDelay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const settle = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', settle);
      resolve();
    };
    const timer = setTimeout(settle, 60);
    signal.addEventListener('abort', settle, { once: true });
  });
}

/**
 * A network-free `MlvEditorAiProvider` that proofreads the selection instead
 * of returning canned text. Because the result shares most words with the
 * selection, the `review` output mode word-diffs it into several individual
 * suggestions rather than one whole-region replacement.
 */
class DocsProofreadAiProvider implements MlvEditorAiProvider {
  async *stream(request: MlvEditorAiRequest): AsyncIterable<string> {
    const chunks = proofread(request.context.selection).match(/\S+\s*/g) ?? [];
    for (const chunk of chunks) {
      await nextChunkDelay(request.signal);
      if (request.signal.aborted) return;
      yield chunk;
    }
  }
}

/**
 * Bridges the editor's per-instance AI context to the page template. The
 * documented sharp edge: serializing while `status() === 'reviewing'`
 * captures the accepted-by-default state, so hosts gate saves on
 * `hasPendingSuggestions`.
 */
@Directive({
  selector: '[docsAiReviewGate]',
  exportAs: 'docsAiReviewGate',
})
export class DocsAiReviewGate {
  /** The nearest editor's AI command and review context. */
  readonly ai = inject(MLV_EDITOR_AI_CONTEXT);
}

@Component({
  selector: 'docs-editor-ai-review-example',
  imports: [
    DocsAiReviewGate,
    MlvButton,
    MlvEditor,
    MlvEditorAiMenu,
    MlvEditorAiReviewBar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorAiReviewExample {
  readonly aiProvider: MlvEditorAiProvider = new DocsProofreadAiProvider();
  readonly value = signal<string | null>(
    '<h2>Review draft</h2><p>Teh review flow gives basically every writer feedback from reviewers.</p><p>Select the paragraph above, open the sparkles menu, choose Custom prompt, and pick the Review changes output.</p>',
  );
  readonly savedValue = signal<string | null>(null);

  /** Simulates the host save the review gate protects. */
  save(): void {
    this.savedValue.set(this.value());
  }
}
