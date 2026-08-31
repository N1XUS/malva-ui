import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
// The @malva-ui/i18n main entry is imported statically by design: only the
// language packs (@malva-ui/i18n/<lang>) are lazy-loaded, in app.config.ts.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { MlvEditor, type MlvEditorError } from '@malva-ui/editor';
import {
  MlvEditorAiMenu,
  mlvEditorAiDefaultActions,
  type MlvEditorAiAction,
  type MlvEditorAiBuiltInTransformKind,
  type MlvEditorAiProvider,
  type MlvEditorAiRequest,
} from '@malva-ui/editor/ai';

/** Every kind this provider has a canned answer for out of the box. */
type DocsCannedKind = MlvEditorAiBuiltInTransformKind | 'autocomplete';

/**
 * Canned Markdown per built-in kind. A real host would call its own backend
 * here; the docs provider never leaves the page and needs no API key.
 */
const CANNED_MARKDOWN: Record<DocsCannedKind, string> = {
  improve:
    'This paragraph now reads clearly and confidently, with every sentence pulling in the same direction.',
  'fix-grammar':
    'The corrected sentence agrees in number, keeps one tense, and ends with exactly one period.',
  shorten: 'One tight sentence keeps the point.',
  extend:
    'The original thought continues here with a second, fuller paragraph.\n\nIt adds one supporting example and a closing remark, so the section feels finished rather than cut off.',
  summarize:
    '- Key point one, in a single line\n- Key point two, equally short\n- One action item to close',
  tone: 'We are delighted to share this update and would welcome your feedback at your earliest convenience.',
  translate:
    'Voici la même phrase, traduite en français pour la démonstration.',
  custom:
    'Here is the canned answer the mock provider returns for a custom prompt.',
  autocomplete: ' and the sentence finishes itself.',
};

/** Own enumerable keys only, so the lookup below cannot hit `Object.prototype`. */
const CANNED_KINDS = Object.keys(CANNED_MARKDOWN) as readonly string[];

/**
 * A kind this page invented for its extra menu action. `MlvEditorAiTransformKind`
 * is an open string type, so a host names whatever its own provider answers.
 */
const HEADLINE_KIND = 'docs-headline';

/** Canned answer for the host-authored action. */
const HEADLINE_MARKDOWN = '## Streaming edits, one undo step';

/**
 * Answer for kinds this provider does not recognize. `request.kind` is not a
 * closed union — any host action list can name a new one — so a provider must
 * always have a graceful branch instead of assuming exhaustiveness.
 */
const UNKNOWN_KIND_MARKDOWN =
  'This mock provider has no answer for that transform kind, so it says so instead of failing.';

/** Picks the canned response, echoing the custom-prompt instruction. */
function cannedResponse(request: MlvEditorAiRequest): string {
  if (request.kind === 'custom' && request.instruction) {
    return `**${request.instruction}** — ${CANNED_MARKDOWN.custom}`;
  }
  if (request.kind === HEADLINE_KIND) return HEADLINE_MARKDOWN;
  return CANNED_KINDS.includes(request.kind)
    ? CANNED_MARKDOWN[request.kind as DocsCannedKind]
    : UNKNOWN_KIND_MARKDOWN;
}

/** Resolves after one chunk delay, or immediately once the request aborts. */
function nextChunkDelay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const settle = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', settle);
      resolve();
    };
    const timer = setTimeout(settle, 90);
    signal.addEventListener('abort', settle, { once: true });
  });
}

/**
 * A network-free `MlvEditorAiProvider` streaming canned Markdown word by
 * word. Honouring `request.signal` is what makes the toolbar stop button and
 * Escape end the stream mid-sentence.
 */
class DocsMockAiProvider implements MlvEditorAiProvider {
  async *stream(request: MlvEditorAiRequest): AsyncIterable<string> {
    const chunks = cannedResponse(request).match(/\S+\s*/g) ?? [];
    for (const chunk of chunks) {
      await nextChunkDelay(request.signal);
      if (request.signal.aborted) return;
      yield chunk;
    }
  }
}

@Component({
  selector: 'docs-editor-ai-assistant-example',
  imports: [MlvEditor, MlvEditorAiMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorAiAssistantExample {
  /** Editor copy for the current docs language, used to label the defaults. */
  private readonly editorCopy = inject(MLV_EDITOR_I18N, { optional: true });

  readonly aiProvider: MlvEditorAiProvider = new DocsMockAiProvider();

  /**
   * `actions` replaces the menu's built-in list literally, so keeping the
   * built-ins means spreading `mlvEditorAiDefaultActions()` — the same
   * localized list the menu builds for itself — and appending to it.
   */
  readonly aiActions = computed<readonly MlvEditorAiAction[]>(() => [
    ...mlvEditorAiDefaultActions(this.editorCopy?.()),
    {
      kind: HEADLINE_KIND,
      label: 'Suggest a headline',
      output: 'insert-below',
    },
  ]);

  readonly value = signal<string | null>(
    '<h2>Draft</h2><p>Select this sentence, then open the sparkles menu in the toolbar to transform it.</p><p>While a transform streams, the same trigger becomes a stop button.</p>',
  );
  readonly lastError = signal<MlvEditorError | null>(null);
}
