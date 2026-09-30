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
    // A pack's top-level `locale` is its BCP 47 tag (#306), not a message:
    // it is never translated and never compiled as ICU.
    if (!prefix && key === 'locale') continue;
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

// #370: the date-range picker renders `clear` / `apply` as its footer buttons'
// visible text and keeps `clearDateRange` / `applyDateRange` as their
// `aria-label`. WCAG 2.5.3 (Label in Name) needs each name to contain its
// visible label, so a speech-input user can say what they see.
it.each(Object.entries(packs))(
  '%s date-range picker names contain their visible labels (WCAG 2.5.3)',
  (locale, pack) => {
    const picker = pack.dateRangePicker;
    for (const [visible, name] of [
      [picker.clear, picker.clearDateRange],
      [picker.apply, picker.applyDateRange],
    ] as const) {
      expect(visible, `${locale}: visible label`).toBeTruthy();
      expect(name.toLocaleLowerCase(locale), `${locale}: "${name}"`).toContain(
        (visible ?? '').toLocaleLowerCase(locale),
      );
    }
  },
);

// #370: `[mlvAutocomplete]` mirrors `mlv-combobox`'s empty state, loading text
// and result-count announcement, and the dropdown panel's own loading default
// is the same "loading" affordance — so each pack words them identically.
it.each(Object.entries(packs))(
  '%s words autocomplete and the dropdown panel as it words the combobox',
  (locale, pack) => {
    expect(pack.autocomplete, locale).toEqual({
      noResults: pack.combobox.noResults,
      loading: pack.combobox.loading,
      resultsAvailable: pack.combobox.resultsAvailable,
    });
    expect(pack.dropdownPanel, locale).toEqual({
      loading: pack.combobox.loading,
    });
  },
);

// #371: the English literals moved into i18n keys. The English pack must keep
// every rendered string byte-identical, except the pin-side items, which were
// "Pin left" / "Pin right" although the sides are logical and mirror in RTL
// (`MlvPinSide`), so they say "start" / "end" now.
it('keeps the #371 English strings byte-identical to the old literals', () => {
  expect(en.dataTable).toMatchObject({
    selectRow: 'Select row {index}',
    loadingMore: 'Loading more rows',
    loadingData: 'Loading table data',
    noData: 'No data available',
    pinStart: 'Pin to start',
    pinEnd: 'Pin to end',
    actionsHeader: 'Actions',
  });
  expect(en.copyToClipboard).toMatchObject({
    copied: 'Copied to clipboard',
    copyTooltip: 'Copy',
    copiedTooltip: 'Copied',
  });
  expect(en.fileUpload).toMatchObject({
    dropFiles: 'Drag & drop files here',
    browseFiles: 'Browse files',
  });
  expect(en.editor.placeholder).toBe('Write something…');
  expect(en.tree).toEqual({
    expandNode: 'Expand {label}',
    collapseNode: 'Collapse {label}',
    loadingChildren: 'Loading children',
    selectNode: 'Select {label}',
  });
  expect(en.viewVariant).toMatchObject({
    newTeamView: 'New team view',
    newPersonalView: 'New personal view',
    systemViews: 'System',
    teamViews: 'Team',
    personalViews: 'My views',
    moreActions: 'More actions for {name}',
    variantActions: 'Actions for {name}',
  });
  expect(Object.keys(en.viewVariant ?? {})).toHaveLength(25);
});

// #371: the view-variant bands reuse words each pack already has for the same
// action, so a page shows one "Retry", one "Dismiss", one "Reset".
it.each(Object.entries(packs))(
  '%s words the view-variant actions as it words the same actions elsewhere',
  (locale, pack) => {
    expect(pack.viewVariant?.retry, locale).toBe(pack.dataTable.retry);
    expect(pack.viewVariant?.dismiss, locale).toBe(pack.notification.dismiss);
    expect(pack.viewVariant?.reset, locale).toBe(pack.filter.reset);
  },
);

/**
 * #371 keys a pack may word exactly as English does, because the word is the
 * same in that language.
 */
const englishHomographs: Record<string, readonly string[]> = {
  fr: ['dataTable.actionsHeader'],
  de: ['viewVariant.systemViews', 'viewVariant.teamViews'],
  it: ['viewVariant.teamViews'],
  nl: ['viewVariant.teamViews'],
};

it.each(Object.entries(packs).filter(([locale]) => locale !== 'en'))(
  '%s translates every #371 key instead of copying English',
  (locale, pack) => {
    const english = flattenMessages(en);
    const translated = flattenMessages(pack);
    const keys = [
      ...[
        'selectRow',
        'loadingMore',
        'loadingData',
        'noData',
        'pinStart',
        'pinEnd',
        'actionsHeader',
      ].map((key) => `dataTable.${key}`),
      'copyToClipboard.copied',
      'copyToClipboard.copyTooltip',
      'copyToClipboard.copiedTooltip',
      'fileUpload.dropFiles',
      'fileUpload.browseFiles',
      'editor.placeholder',
      ...Object.keys(english).filter(
        (key) => key.startsWith('tree.') || key.startsWith('viewVariant.'),
      ),
    ];
    const allowed = englishHomographs[locale] ?? [];
    for (const key of keys) {
      expect(translated[key], `${locale}:${key}`).toBeTruthy();
      if (allowed.includes(key)) continue;
      expect(translated[key], `${locale}:${key}`).not.toBe(english[key]);
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
  'editor.subscript',
  'editor.superscript',
  'editor.styleValue',
  // #516: the command menu's AI group heading, the acronym as in English.
  'editor.insertGroupAi',
  'filter.filters',
  'pagination.items',
  'pagination.itemCount',
  'scheduler.week',
  // #371: the team-owned view group heading, spelt as in English.
  'viewVariant.teamViews',
] as const;

it.each([
  // `editor.styleValue` is `{label}: {value}` — punctuation and ICU
  // arguments only, written the same way in these languages.
  // `editor.insertGroupAi` (#516) is the acronym "AI", which these packs
  // already use in their own AI strings (`aiMenu`, `askAi`).
  ['ja', ja, ['editor.styleValue', 'editor.insertGroupAi']],
  ['nl', nl, dutchEnglishMatches],
  ['pl', pl, ['editor.styleValue', 'editor.insertGroupAi']],
  ['tr', tr, ['editor.styleValue']],
  ['zh-Hans', zhHans, ['editor.insertGroupAi']],
  ['id', id, ['editor.styleValue', 'editor.insertGroupAi']],
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

// #306: `MLV_LOCALE` reports the active pack's `locale`, and plurals and
// dates format in it. A pack without one would silently format in the host
// app's `LOCALE_ID` instead — the exact defect #306 fixes — so every shipped
// pack must declare its tag. `pt` is Portuguese (Portugal) — "ficheiro", not
// Brazilian "arquivo" — and the region matters to formatting: CLDR puts 0 in
// `one` for `pt` and in `other` for `pt-PT`.
const packLocales: Record<keyof typeof packs, string> = {
  en: 'en',
  de: 'de',
  fr: 'fr',
  it: 'it',
  es: 'es',
  pt: 'pt-PT',
  uk: 'uk',
  ro: 'ro',
  ja: 'ja',
  nl: 'nl',
  pl: 'pl',
  tr: 'tr',
  'zh-Hans': 'zh-Hans',
  id: 'id',
};

it.each(Object.entries(packs))(
  '%s declares its own canonical BCP 47 locale',
  (dir, pack) => {
    const expected = packLocales[dir as keyof typeof packs];
    expect(pack.locale).toBe(expected);
    expect(Intl.getCanonicalLocales(expected)).toEqual([expected]);
    // The runtime carries plural and date data for the exact tag, so the pack
    // formats in its own locale rather than a negotiated fallback.
    expect(Intl.PluralRules.supportedLocalesOf(expected)).toEqual([expected]);
    expect(Intl.DateTimeFormat.supportedLocalesOf(expected)).toEqual([
      expected,
    ]);
  },
);

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

// #514: optional on `MlvEditorI18n` so a hand-written pack still compiles,
// but every shipped pack translates them (the key-set check above then pins
// the other thirteen packs to English's set).
const editorN1Keys = [
  'inlineCode',
  'subscript',
  'superscript',
  'clearFormatting',
  'fontFamily',
  'fontSize',
  'lineHeight',
  'defaultStyle',
  'fontFamilySans',
  'fontFamilySerif',
  'fontFamilyMono',
  'copyHeadingLink',
  'headingLinkCopied',
  'styleValue',
] as const;

it.each(Object.entries(packs))(
  '%s declares every optional text-style and heading-link editor key',
  (locale, pack) => {
    const editor = pack.editor as Record<string, unknown>;
    for (const key of editorN1Keys) {
      expect(typeof editor[key], `${locale}:editor.${key}`).toBe('string');
      expect(
        (editor[key] as string).trim().length,
        `${locale}:editor.${key}`,
      ).toBeGreaterThan(0);
    }
  },
);

// #515 (F-D19): the collaboration status, presence and announcement copy.
// Optional on `MlvEditorI18n` like the keys above; every shipped pack
// translates them.
const editorCollaborationKeys = [
  'collaborationConnecting',
  'collaborationSyncing',
  'collaborationSynced',
  'collaborationOffline',
  'collaborationClosed',
  'collaborationFailed',
  'collaborationPeers',
  'collaborationPresenceLabel',
  'collaborationViewing',
  'collaborationAnonymous',
  'collaborationMoveCancelled',
  'collaborationBackOnline',
  'collaborationSyncTimeout',
] as const;

it.each(Object.entries(packs))(
  '%s declares every optional collaboration editor key',
  (locale, pack) => {
    const editor = pack.editor as Record<string, unknown>;
    for (const key of editorCollaborationKeys) {
      expect(typeof editor[key], `${locale}:editor.${key}`).toBe('string');
      expect(
        (editor[key] as string).trim().length,
        `${locale}:editor.${key}`,
      ).toBeGreaterThan(0);
    }
    expect(
      new IntlMessageFormat(
        editor['collaborationViewing'] as string,
        locale,
      ).format({ name: 'Ada' }),
      locale,
    ).toContain('Ada');
    expect(
      new IntlMessageFormat(
        editor['collaborationPeers'] as string,
        locale,
      ).format({ count: 3 }),
      locale,
    ).toContain('3');
  },
);

// #516: the clean-mode keys, optional on `MlvEditorI18n` for the same reason.
// That the English pack words them exactly as the component fallbacks is
// pinned where those live, `libs/editor/src/lib/editor-clean-mode-fallbacks.spec.ts`:
// this project cannot import the editor.
const editorCleanModeKeys = [
  'blockType',
  'turnInto',
  'insertBlock',
  'insertGroupAi',
  'insertGroupStyle',
  'insertGroupLists',
  'insertGroupInsert',
  'askAi',
  'tableOfContents',
  'tableOfContentsEmpty',
] as const;

it.each(Object.entries(packs))(
  '%s declares every optional clean-mode editor key',
  (locale, pack) => {
    const editor = pack.editor as Record<string, unknown>;
    for (const key of editorCleanModeKeys) {
      expect(typeof editor[key], `${locale}:editor.${key}`).toBe('string');
      expect(
        (editor[key] as string).trim().length,
        `${locale}:editor.${key}`,
      ).toBeGreaterThan(0);
    }
  },
);
