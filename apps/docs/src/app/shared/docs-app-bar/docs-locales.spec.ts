import {
  DOCS_LOCALE_CODES,
  DOCS_LOCALE_METADATA,
  docsLocaleToOption,
} from './docs-locales';

describe('docs locales', () => {
  it('lists every locale with its native name and requested flag', () => {
    expect(
      DOCS_LOCALE_CODES.map((code) => [
        code,
        DOCS_LOCALE_METADATA[code].name,
        DOCS_LOCALE_METADATA[code].flag,
      ]),
    ).toEqual([
      ['en', 'English', 'gb'],
      ['de', 'Deutsch', 'de'],
      ['fr', 'Français', 'fr'],
      ['it', 'Italiano', 'it'],
      ['es', 'Español', 'es'],
      ['pt', 'Português', 'pt'],
      ['uk', 'Українська', 'ua'],
      ['ro', 'Română', 'ro'],
      ['ja', '日本語', 'jp'],
      ['nl', 'Nederlands', 'nl'],
      ['pl', 'Polski', 'pl'],
      ['tr', 'Türkçe', 'tr'],
      ['zh-Hans', '简体中文', 'cn'],
      ['id', 'Bahasa Indonesia', 'id'],
    ]);
  });

  it('does not repeat locale codes', () => {
    expect(new Set(DOCS_LOCALE_CODES).size).toBe(DOCS_LOCALE_CODES.length);
  });

  it.each(['ja', 'nl', 'pl', 'tr', 'zh-Hans', 'id'] as const)(
    'loads the %s language pack',
    async (locale) => {
      const module = await DOCS_LOCALE_METADATA[locale].load();
      expect(module.default.dialog.closeDialog).toBeTruthy();
    },
  );

  it('maps locale codes to select options without changing their value', () => {
    expect(docsLocaleToOption('zh-Hans')).toEqual({
      label: '简体中文',
      value: 'zh-Hans',
    });
  });
});
