import { enLanguage } from '@malva-ui/i18n/en';
import { MLV_EDITOR_CLEAN_MODE_FALLBACKS } from './editor-clean-mode-fallbacks';

/*
 * #516 R8: the optional clean-mode keys fall back to one component record.
 * It must equal the English pack, so an English copy edit — or a fallback
 * edit — that touches only one side goes red here.
 */
describe('MlvEditor — clean-mode message fallbacks', () => {
  it('equals the English pack for every clean-mode key', () => {
    const keys = Object.keys(MLV_EDITOR_CLEAN_MODE_FALLBACKS);
    const english = Object.fromEntries(
      keys.map((key) => [
        key,
        (enLanguage.editor as unknown as Record<string, unknown>)[key],
      ]),
    );
    expect(keys).toHaveLength(10);
    expect(MLV_EDITOR_CLEAN_MODE_FALLBACKS).toEqual(english);
  });
});
