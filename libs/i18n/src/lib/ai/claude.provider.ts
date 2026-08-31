import type {
  MlvTranslationProvider,
  MlvTranslationRequest,
  MlvTranslationResult,
} from '../types';

export interface MlvClaudeProviderConfig {
  /** Anthropic API key. */
  apiKey: string;
  /** Model to use (default: claude-sonnet-4-5-20241022). */
  model?: string;
}

/**
 * Creates a Claude-backed translation provider.
 *
 * @example
 * ```ts
 * provideMlvAiTranslation({
 *   provider: claudeProvider({ apiKey: env.CLAUDE_API_KEY }),
 *   targetLocale: 'de',
 *   cache: 'indexeddb',
 *   enabled: false,
 * })
 * ```
 */
export function claudeProvider(
  config: MlvClaudeProviderConfig,
): MlvTranslationProvider {
  const model = config.model ?? 'claude-sonnet-4-5-20241022';

  return {
    async translate(
      requests: MlvTranslationRequest[],
    ): Promise<MlvTranslationResult[]> {
      const prompt = requests
        .map(
          (r) =>
            `Key: ${r.key}\nSource (${r.context.usage}): "${r.sourceText}"\nComponent: ${r.context.component}\nDescription: ${r.context.description ?? 'N/A'}\nICU params to preserve: ${r.context.icuParams?.join(', ') ?? 'none'}`,
        )
        .join('\n\n---\n\n');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: `Translate the following UI strings to ${requests[0]?.targetLocale ?? 'en'}. Return ONLY a JSON array of objects with "key" and "translatedText" fields. Each translatedText must be valid ICU MessageFormat. Preserve all {parameter} placeholders exactly.\n\n${prompt}`,
            },
          ],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text ?? '[]';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    },
  };
}
