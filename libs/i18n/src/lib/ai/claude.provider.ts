import type {
  MlvTranslationProvider,
  MlvTranslationRequest,
  MlvTranslationResult,
} from '../types';

/**
 * Configuration for `claudeProvider()`.
 *
 * @deprecated since 0.2.0 — removed in 1.0, with `claudeProvider()` and the
 * rest of the runtime AI translation API. There is no replacement.
 */
export interface MlvClaudeProviderConfig {
  /**
   * Anthropic API key, sent with every request from whatever runtime calls the
   * provider. Registered in an application configuration that reaches the
   * browser, the key ships to every visitor and is readable by any of them —
   * never pass a real key there.
   */
  apiKey: string;
  /**
   * Model to use (default: `claude-sonnet-4-5-20241022`). That default is not a
   * published Anthropic model id, so every request made without an explicit
   * `model` fails.
   */
  model?: string;
}

/**
 * Creates a Claude-backed translation provider that calls the Anthropic API
 * directly with `config.apiKey`.
 *
 * The provider sends the key from whatever runtime calls it. Registered with
 * `provideMlvAiTranslation()` in an application configuration that reaches the
 * browser, the key ships to every visitor and is readable by any of them, and
 * no option on this function can protect a key once it is there.
 *
 * @deprecated since 0.2.0 — removed in 1.0, with the rest of the runtime AI
 * translation API. There is no replacement. Nothing in the library calls
 * `MlvAiTranslationService`, and this provider sends a secret API key from
 * whatever runtime calls it. Ship translated strings in a language pack
 * (`provideMlvI18n()`), or call the Anthropic API (or any translation API)
 * from a server you control.
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
