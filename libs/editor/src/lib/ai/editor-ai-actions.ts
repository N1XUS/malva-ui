import type { MlvEditorI18n } from '@malva-ui/i18n';
import type { MlvEditorAiAction } from './editor-ai.types';

/**
 * @internal English fallbacks for the built-in action labels, used when no
 * `MLV_EDITOR_I18N` copy is supplied — the same strings the English pack
 * ships. Kept beside the factory so the label table exists exactly once: the
 * menu builds its own default list through {@link mlvEditorAiDefaultActions}.
 */
const BUILT_IN_LABEL_FALLBACKS = {
  aiImprove: 'Improve writing',
  aiFixGrammar: 'Fix grammar',
  aiShorten: 'Shorten',
  aiExtend: 'Extend',
  aiSummarize: 'Summarize',
  aiTone: 'Change tone',
  aiTranslate: 'Translate',
} as const;

/**
 * Builds the seven built-in AI menu actions, labelled from the supplied
 * editor copy.
 *
 * This is the exact list `MlvEditorAiMenu` renders when its `actions` input is
 * omitted, so a host that wants to *extend* rather than replace the built-ins
 * spreads the result instead of retyping it:
 *
 * ```ts
 * private readonly _copy = inject(MLV_EDITOR_I18N, { optional: true });
 *
 * readonly actions = computed<readonly MlvEditorAiAction[]>(() => [
 *   ...mlvEditorAiDefaultActions(this._copy?.()),
 *   { kind: 'legal-review', label: 'Legal review', output: 'review' },
 * ]);
 * ```
 *
 * The custom-prompt entry is not part of this list: the menu renders it
 * separately and it is dropped with `showCustomPrompt="false"`.
 *
 * @param copy Resolved editor copy, typically `inject(MLV_EDITOR_I18N)()`.
 *   `null`/`undefined`, or any missing key, falls back to the English label.
 * @returns A fresh array of the seven built-in actions, in menu order.
 */
export function mlvEditorAiDefaultActions(
  copy: MlvEditorI18n | null | undefined,
): readonly MlvEditorAiAction[] {
  return [
    {
      kind: 'improve',
      label: copy?.aiImprove ?? BUILT_IN_LABEL_FALLBACKS.aiImprove,
    },
    {
      kind: 'fix-grammar',
      label: copy?.aiFixGrammar ?? BUILT_IN_LABEL_FALLBACKS.aiFixGrammar,
    },
    {
      kind: 'shorten',
      label: copy?.aiShorten ?? BUILT_IN_LABEL_FALLBACKS.aiShorten,
    },
    {
      kind: 'extend',
      label: copy?.aiExtend ?? BUILT_IN_LABEL_FALLBACKS.aiExtend,
    },
    {
      kind: 'summarize',
      label: copy?.aiSummarize ?? BUILT_IN_LABEL_FALLBACKS.aiSummarize,
    },
    { kind: 'tone', label: copy?.aiTone ?? BUILT_IN_LABEL_FALLBACKS.aiTone },
    {
      kind: 'translate',
      label: copy?.aiTranslate ?? BUILT_IN_LABEL_FALLBACKS.aiTranslate,
    },
  ];
}
