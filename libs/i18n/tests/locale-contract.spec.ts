import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import IntlMessageFormat from 'intl-messageformat';
import en from '../en/src/lib/en';
import de from '../de/src/lib/de';
import fr from '../fr/src/lib/fr';
import itLanguage from '../it/src/lib/it';
import es from '../es/src/lib/es';
import pt from '../pt/src/lib/pt';
import uk from '../uk/src/lib/uk';
import ro from '../ro/src/lib/ro';
import ja from '../ja/src/lib/ja';
import nl from '../nl/src/lib/nl';
import pl from '../pl/src/lib/pl';
import tr from '../tr/src/lib/tr';
import zhHans from '../zh-Hans/src/lib/zh-Hans';
import id from '../id/src/lib/id';

interface AstNode {
  type: number;
  value?: string;
  options?: Record<string, { value: AstNode[] }>;
  children?: AstNode[];
}

const packs = {
  en,
  de,
  fr,
  it: itLanguage,
  es,
  pt,
  uk,
  ro,
  ja,
  nl,
  pl,
  tr,
  'zh-Hans': zhHans,
  id,
} as const;

const dataTableSortTranslations = {
  en: ['Sort', 'Sort rows', 'Ascending', 'Descending', 'Clear sort'],
  de: [
    'Sortieren',
    'Zeilen sortieren',
    'Aufsteigend',
    'Absteigend',
    'Sortierung löschen',
  ],
  es: ['Ordenar', 'Ordenar filas', 'Ascendente', 'Descendente', 'Borrar orden'],
  fr: [
    'Trier',
    'Trier les lignes',
    'Croissant',
    'Décroissant',
    'Effacer le tri',
  ],
  id: ['Urutkan', 'Urutkan baris', 'Menaik', 'Menurun', 'Hapus pengurutan'],
  it: [
    'Ordina',
    'Ordina righe',
    'Crescente',
    'Decrescente',
    'Cancella ordinamento',
  ],
  ja: ['並べ替え', '行を並べ替え', '昇順', '降順', '並べ替えを解除'],
  nl: [
    'Sorteren',
    'Rijen sorteren',
    'Oplopend',
    'Aflopend',
    'Sortering wissen',
  ],
  pl: ['Sortuj', 'Sortuj wiersze', 'Rosnąco', 'Malejąco', 'Wyczyść sortowanie'],
  pt: [
    'Ordenar',
    'Ordenar linhas',
    'Crescente',
    'Decrescente',
    'Limpar ordenação',
  ],
  ro: [
    'Sortează',
    'Sortează rândurile',
    'Crescător',
    'Descrescător',
    'Șterge sortarea',
  ],
  tr: ['Sırala', 'Satırları sırala', 'Artan', 'Azalan', 'Sıralamayı temizle'],
  uk: [
    'Сортувати',
    'Сортувати рядки',
    'За зростанням',
    'За спаданням',
    'Очистити сортування',
  ],
  'zh-Hans': ['排序', '对行排序', '升序', '降序', '清除排序'],
} as const;

const queryFilterControlKeys = [
  'addFilter',
  'removeFilter',
  'clearAll',
  'noFiltersAvailable',
] as const;

function flattenMessages(value: object, prefix = ''): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') {
      messages[path] = child;
    } else {
      Object.assign(messages, flattenMessages(child as object, path));
    }
  }
  return messages;
}

function argumentSignature(message: string, locale: string): string[] {
  const argumentsFound = new Set<string>();

  const visit = (nodes: AstNode[]): void => {
    for (const node of nodes) {
      if (node.type >= 1 && node.type <= 6 && node.value) {
        argumentsFound.add(`${node.type}:${node.value}`);
      }
      if (node.options) {
        for (const option of Object.values(node.options)) visit(option.value);
      }
      if (node.children) visit(node.children);
    }
  };

  visit(new IntlMessageFormat(message, locale).getAst() as AstNode[]);
  return [...argumentsFound].sort();
}

function branchSignature(
  message: string,
  locale: string,
): Record<string, string[]> {
  const branches: Record<string, string[]> = {};

  const visit = (nodes: AstNode[]): void => {
    for (const node of nodes) {
      if ((node.type === 5 || node.type === 6) && node.value && node.options) {
        branches[`${node.type}:${node.value}`] = Object.keys(
          node.options,
        ).sort();
      }
      if (node.options) {
        for (const option of Object.values(node.options)) visit(option.value);
      }
      if (node.children) visit(node.children);
    }
  };

  visit(new IntlMessageFormat(message, locale).getAst() as AstNode[]);
  return branches;
}

describe.each(Object.entries(packs))('%s language pack', (locale, pack) => {
  it('provides the editor message slice', () => {
    expect(pack).toHaveProperty('editor');
  });

  it('matches the English key set exactly', () => {
    expect(Object.keys(flattenMessages(pack))).toEqual(
      Object.keys(flattenMessages(en)),
    );
  });

  it('preserves every ICU named argument and compiles every message', () => {
    const english = flattenMessages(en);
    const translated = flattenMessages(pack);

    for (const [key, source] of Object.entries(english)) {
      expect(
        argumentSignature(translated[key], locale),
        `${locale}:${key}`,
      ).toEqual(argumentSignature(source, 'en'));
      expect(
        () => new IntlMessageFormat(translated[key], locale),
        `${locale}:${key}`,
      ).not.toThrow();

      const englishBranches = branchSignature(source, 'en');
      const translatedBranches = branchSignature(translated[key], locale);
      for (const [argument, branches] of Object.entries(englishBranches)) {
        if (argument.startsWith('5:')) {
          expect(translatedBranches[argument], `${locale}:${key}`).toEqual(
            branches,
          );
        } else if (key === 'editor.characters' || key === 'editor.words') {
          expect(translatedBranches[argument], `${locale}:${key}`).toEqual(
            [
              ...new Intl.PluralRules(locale).resolvedOptions()
                .pluralCategories,
            ].sort(),
          );
        } else {
          expect(translatedBranches[argument], `${locale}:${key}`).toEqual(
            expect.arrayContaining(branches),
          );
        }
      }
    }
  });
});

it.each(Object.entries(packs))(
  '%s provides the complete Data Table Sort menu contract',
  (locale, pack) => {
    const dataTable = pack.dataTable as Record<string, string>;
    expect(
      [
        dataTable['sort'],
        dataTable['sortMenu'],
        dataTable['ascending'],
        dataTable['descending'],
        dataTable['clearSort'],
      ],
      locale,
    ).toEqual(
      dataTableSortTranslations[
        locale as keyof typeof dataTableSortTranslations
      ],
    );
  },
);

it.each(Object.entries(packs).filter(([locale]) => locale !== 'en'))(
  '%s translates each query filter control instead of falling back to English',
  (locale, pack) => {
    for (const key of queryFilterControlKeys) {
      expect(pack.filter[key], `${locale}:filter.${key}`).not.toBe(
        en.filter[key],
      );
    }
  },
);

it('defines parameterized English Tile keyboard accessibility messages', () => {
  expect(en.tile).toEqual(
    expect.objectContaining({
      tileLabel: 'tile',
      moveTile: 'Move {label}',
      keyboardInstructions:
        'Use Alt+ArrowUp and Alt+ArrowDown to reorder tiles. Use Alt+ArrowLeft to move a tile out one level. Use Alt+ArrowRight to move a tile into the nearest eligible container.',
      movedUp: 'Moved {label} up.',
      movedDown: 'Moved {label} down.',
      movedOut: 'Moved {label} out one level.',
      movedInto: 'Moved {label} into the nearest eligible container.',
      moveRejected: '{label} cannot move in that direction.',
      emptyTarget: 'Drop tiles here',
      restrictedTarget: 'Restricted',
    }),
  );
});

// These Dutch cognates have the same spelling and ICU syntax as English.
const dutchEnglishMatches = [
  'dataTable.filters',
  'dataTable.columnWidthPixels',
  'filter.filters',
  'pagination.items',
  'pagination.itemCount',
  'scheduler.week',
] as const;

it.each([
  ['ja', ja, []],
  ['nl', nl, dutchEnglishMatches],
  ['pl', pl, []],
  ['tr', tr, []],
  ['zh-Hans', zhHans, []],
  ['id', id, []],
] as const)(
  '%s contains no unexpected English fallback messages',
  (locale, pack, expectedEnglishMatches) => {
    const english = flattenMessages(en);
    const translated = flattenMessages(pack);

    expect(
      Object.keys(translated).filter((key) => translated[key] === english[key]),
      locale,
    ).toEqual(expectedEnglishMatches);
  },
);

it.each([
  [
    'de',
    de.dialog.closeDialog,
    de.pagination.page,
    de.pagination.itemCount,
    de.calendar.switchView,
    ['Dialog schließen', 'Seite 3', '2 Elemente', 'Zur Jahresansicht wechseln'],
  ],
  [
    'fr',
    fr.dialog.closeDialog,
    fr.pagination.page,
    fr.pagination.itemCount,
    fr.calendar.switchView,
    [
      'Fermer la boîte de dialogue',
      'Page 3',
      '2 éléments',
      'Passer à la vue année',
    ],
  ],
  [
    'it',
    itLanguage.dialog.closeDialog,
    itLanguage.pagination.page,
    itLanguage.pagination.itemCount,
    itLanguage.calendar.switchView,
    [
      'Chiudi finestra di dialogo',
      'Pagina 3',
      '2 elementi',
      'Passa alla vista anno',
    ],
  ],
  [
    'pt',
    pt.dialog.closeDialog,
    pt.pagination.page,
    pt.pagination.itemCount,
    pt.calendar.switchView,
    ['Fechar diálogo', 'Página 3', '2 itens', 'Mudar para a vista de ano'],
  ],
  [
    'uk',
    uk.dialog.closeDialog,
    uk.pagination.page,
    uk.pagination.itemCount,
    uk.calendar.switchView,
    [
      'Закрити діалогове вікно',
      'Сторінка 3',
      '2 елементи',
      'Перейти до перегляду року',
    ],
  ],
  [
    'ro',
    ro.dialog.closeDialog,
    ro.pagination.page,
    ro.pagination.itemCount,
    ro.calendar.switchView,
    [
      'Închide dialogul',
      'Pagina 3',
      '2 elemente',
      'Comută la vizualizarea anuală',
    ],
  ],
  [
    'ja',
    ja.dialog.closeDialog,
    ja.pagination.page,
    ja.pagination.itemCount,
    ja.calendar.switchView,
    ['ダイアログを閉じる', 'ページ 3', '2 件', '年表示に切り替え'],
  ],
  [
    'nl',
    nl.dialog.closeDialog,
    nl.pagination.page,
    nl.pagination.itemCount,
    nl.calendar.switchView,
    [
      'Dialoog sluiten',
      'Pagina 3',
      '2 items',
      'Overschakelen naar jaarweergave',
    ],
  ],
  [
    'pl',
    pl.dialog.closeDialog,
    pl.pagination.page,
    pl.pagination.itemCount,
    pl.calendar.switchView,
    [
      'Zamknij okno dialogowe',
      'Strona 3',
      '2 elementy',
      'Przełącz na widok roku',
    ],
  ],
  [
    'tr',
    tr.dialog.closeDialog,
    tr.pagination.page,
    tr.pagination.itemCount,
    tr.calendar.switchView,
    ['İletişim kutusunu kapat', 'Sayfa 3', '2 öğe', 'Yıl görünümüne geç'],
  ],
  [
    'zh-Hans',
    zhHans.dialog.closeDialog,
    zhHans.pagination.page,
    zhHans.pagination.itemCount,
    zhHans.calendar.switchView,
    ['关闭对话框', '第 3 页', '2 个项目', '切换到年视图'],
  ],
  [
    'id',
    id.dialog.closeDialog,
    id.pagination.page,
    id.pagination.itemCount,
    id.calendar.switchView,
    ['Tutup dialog', 'Halaman 3', '2 item', 'Beralih ke tampilan tahun'],
  ],
] as const)(
  'formats representative plain, interpolated, plural, and select %s strings',
  (locale, plain, interpolated, plural, select, output) => {
    expect([
      plain,
      new IntlMessageFormat(interpolated, locale).format({ page: 3 }),
      new IntlMessageFormat(plural, locale).format({ count: 2 }),
      new IntlMessageFormat(select, locale).format({ view: 'year' }),
    ]).toEqual(output);
  },
);

it.each([
  ['en', en.editor.characters, { count: 1 }, '1 character'],
  ['en', en.editor.characters, { count: 2 }, '2 characters'],
  ['en', en.editor.words, { count: 1 }, '1 word'],
  ['en', en.editor.words, { count: 2 }, '2 words'],
  ['pl', pl.editor.characters, { count: 1 }, '1 znak'],
  ['pl', pl.editor.characters, { count: 2 }, '2 znaki'],
  ['pl', pl.editor.characters, { count: 5 }, '5 znaków'],
  ['pl', pl.editor.words, { count: 1 }, '1 słowo'],
  ['pl', pl.editor.words, { count: 2 }, '2 słowa'],
  ['pl', pl.editor.words, { count: 5 }, '5 słów'],
  ['uk', uk.editor.characters, { count: 1 }, '1 символ'],
  ['uk', uk.editor.characters, { count: 2 }, '2 символи'],
  ['uk', uk.editor.characters, { count: 5 }, '5 символів'],
  ['uk', uk.editor.words, { count: 1 }, '1 слово'],
  ['uk', uk.editor.words, { count: 2 }, '2 слова'],
  ['uk', uk.editor.words, { count: 5 }, '5 слів'],
] as const)(
  'formats editor count message for %s',
  (locale, message, values, expected) => {
    expect(new IntlMessageFormat(message, locale).format(values)).toBe(
      expected,
    );
  },
);

it('preserves every Polish cardinal plural category', () => {
  const messages = flattenMessages(pl);

  for (const [key, message] of Object.entries(messages)) {
    const branches = branchSignature(message, 'pl');
    for (const [argument, categories] of Object.entries(branches)) {
      if (argument.startsWith('6:')) {
        // An `=N` branch is an ICU exact match, not a CLDR plural category:
        // ICU consults it before the plural rules, so it neither satisfies
        // nor replaces `one`/`few`/`many`/`other`. Drop those before
        // comparing, so a message that pins a literal count (English
        // `taskboard.selectionCount` pins `=0`) is still held to all four
        // Polish categories.
        expect(
          categories.filter((category) => !category.startsWith('=')),
          `pl:${key}:${argument}`,
        ).toEqual(['few', 'many', 'one', 'other']);
      }
    }
  }
});

it('covers every locale entry point the library ships', () => {
  // `packs` above is hand-maintained, and it is one of four locale lists
  // (`MlvLanguageExportName`, this, `DOCS_LOCALE_CODES`, and the set
  // `tests/published-package.spec.ts` derives from `dist/`). ng-packagr
  // auto-discovers an entry point from its own `ng-package.json`, so a
  // fifteenth locale ships whether or not anybody edits a list — this is what
  // makes the omission fail here rather than quietly leave a pack unvalidated.
  //
  // Derived from the source directories, not from `dist/`: this suite asserts
  // translation content and should not acquire a dependency on the library's
  // build. It is the same set one build step earlier, and
  // `published-package.spec.ts` covers the built half.
  const libraryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const shipped = readdirSync(libraryRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== 'testing' &&
        existsSync(join(libraryRoot, entry.name, 'ng-package.json')),
    )
    .map((entry) => entry.name);

  expect(Object.keys(packs).sort()).toEqual(shipped.sort());
});

it.each(Object.entries(packs))(
  'keeps %s free of a top-level key ending in "Language"',
  (_locale, pack) => {
    // `resolveMlvLanguage` finds a pack by scanning a *module* object for a
    // `<locale>Language` key (see language-module.ts). It never scans a pack —
    // `default` is returned unread — so this is not what makes the happy path
    // correct. What it buys is that the scan can never meet a pack slice: a
    // pack handed in where a module was expected, or reached through an interop
    // namespace, surfaces as the "no MlvLanguage" error rather than as a slice
    // masquerading as a language.
    expect(Object.keys(pack).filter((key) => key.endsWith('Language'))).toEqual(
      [],
    );
  },
);
