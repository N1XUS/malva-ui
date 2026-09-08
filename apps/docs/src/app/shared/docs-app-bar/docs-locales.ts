import type { MlvLanguageModule } from '@malva-ui/i18n';
import type { MlvSelectOptionTransform } from '@malva-ui/core/select';

export type DocsLocale =
  | 'en'
  | 'de'
  | 'fr'
  | 'it'
  | 'es'
  | 'pt'
  | 'uk'
  | 'ro'
  | 'ja'
  | 'nl'
  | 'pl'
  | 'tr'
  | 'zh-Hans'
  | 'id';

interface DocsLocaleMetadata {
  readonly name: string;
  readonly flag: string;
  /**
   * Loads the pack. Typed `MlvLanguageModule`, not `{ default: MlvLanguage }`:
   * the narrow shape only compiled because `tsconfig.base.json` maps
   * `@malva-ui/i18n/<locale>` to source, where each entry point still carries a
   * `default`. The published package carries `<locale>Language` instead, so the
   * narrow annotation was the same latent break as #227, one layer up.
   */
  readonly load: () => Promise<MlvLanguageModule>;
}

export const DOCS_LOCALE_CODES: readonly DocsLocale[] = [
  'en',
  'de',
  'fr',
  'it',
  'es',
  'pt',
  'uk',
  'ro',
  'ja',
  'nl',
  'pl',
  'tr',
  'zh-Hans',
  'id',
];

export const DOCS_LOCALE_METADATA: Readonly<
  Record<DocsLocale, DocsLocaleMetadata>
> = {
  en: { name: 'English', flag: 'gb', load: () => import('@malva-ui/i18n/en') },
  de: { name: 'Deutsch', flag: 'de', load: () => import('@malva-ui/i18n/de') },
  fr: { name: 'Français', flag: 'fr', load: () => import('@malva-ui/i18n/fr') },
  it: { name: 'Italiano', flag: 'it', load: () => import('@malva-ui/i18n/it') },
  es: { name: 'Español', flag: 'es', load: () => import('@malva-ui/i18n/es') },
  pt: {
    name: 'Português',
    flag: 'pt',
    load: () => import('@malva-ui/i18n/pt'),
  },
  uk: {
    name: 'Українська',
    flag: 'ua',
    load: () => import('@malva-ui/i18n/uk'),
  },
  ro: { name: 'Română', flag: 'ro', load: () => import('@malva-ui/i18n/ro') },
  ja: { name: '日本語', flag: 'jp', load: () => import('@malva-ui/i18n/ja') },
  nl: {
    name: 'Nederlands',
    flag: 'nl',
    load: () => import('@malva-ui/i18n/nl'),
  },
  pl: { name: 'Polski', flag: 'pl', load: () => import('@malva-ui/i18n/pl') },
  tr: { name: 'Türkçe', flag: 'tr', load: () => import('@malva-ui/i18n/tr') },
  'zh-Hans': {
    name: '简体中文',
    flag: 'cn',
    load: () => import('@malva-ui/i18n/zh-Hans'),
  },
  id: {
    name: 'Bahasa Indonesia',
    flag: 'id',
    load: () => import('@malva-ui/i18n/id'),
  },
};

export const docsLocaleToOption: MlvSelectOptionTransform<DocsLocale> = (
  locale,
) => ({
  label: DOCS_LOCALE_METADATA[locale].name,
  value: locale,
});
