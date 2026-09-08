import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

  it('offers every locale @malva-ui/i18n ships', () => {
    // `DOCS_LOCALE_CODES` is hand-maintained, and ng-packagr auto-discovers a
    // locale entry point from its own `ng-package.json` — so a fifteenth locale
    // ships whether or not this list is edited, and the language switcher would
    // simply never offer it. Derived from the library's source directories,
    // which is the same set `libs/i18n/tests/published-package.spec.ts` derives
    // from `dist/` one build step later.
    const workspaceRoot = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../../..',
    );
    const i18nRoot = join(workspaceRoot, 'libs', 'i18n');
    const shipped = readdirSync(i18nRoot, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name !== 'testing' &&
          existsSync(join(i18nRoot, entry.name, 'ng-package.json')),
      )
      .map((entry) => entry.name);

    expect([...DOCS_LOCALE_CODES].sort()).toEqual(shipped.sort());
  });

  it('does not repeat locale codes', () => {
    expect(new Set(DOCS_LOCALE_CODES).size).toBe(DOCS_LOCALE_CODES.length);
  });

  it.each(['ja', 'nl', 'pl', 'tr', 'zh-Hans', 'id'] as const)(
    'loads the %s language pack',
    async (locale) => {
      // Read through `resolveMlvLanguage`, not `module.default`: the loader is
      // typed `MlvLanguageModule`, so `default` exists only on the source-shaped
      // half of the union — which is exactly the assumption #227 was about.
      //
      // Imported dynamically, like every other `@malva-ui/i18n` reference in
      // `apps/docs`: `@nx/enforce-module-boundaries` forbids a static import of
      // a library this project lazy-loads, from a file that does not lazy-load
      // it itself.
      const { resolveMlvLanguage } = await import('@malva-ui/i18n');
      const module = await DOCS_LOCALE_METADATA[locale].load();
      expect(resolveMlvLanguage(module).dialog.closeDialog).toBeTruthy();
    },
  );

  it('maps locale codes to select options without changing their value', () => {
    expect(docsLocaleToOption('zh-Hans')).toEqual({
      label: '简体中文',
      value: 'zh-Hans',
    });
  });
});
