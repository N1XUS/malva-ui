import type { MlvLanguage } from './types';

/**
 * @private The named export a published `@malva-ui/i18n/<locale>` entry point
 * carries.
 *
 * Each locale's source `index.ts` exports its pack twice — once by name and
 * once as `export default` — but ng-packagr keeps only the named one when it
 * flattens the entry point, so the published `.d.ts` and `.mjs` expose
 * `enLanguage` / `zhHansLanguage` / … and no default at all (#227).
 *
 * **Deliberately not exported.** Its members are the names ng-packagr happens
 * to emit, and a barrel export would make them public API — `VERSIONING.md` §2
 * (anything reachable from a published entry point is public), §3 (adding one
 * is a minor), §5 (removing one needs a released deprecation window landing on
 * a major). Versioning the library against a build tool's naming is the very
 * change `tests/published-package.spec.ts` exists to *detect*, not to promise.
 * The declaration still reaches the published `.d.ts` as a referenced type, the
 * way `MlvNamedLanguageModule` below does; only the name is not a consumer's to
 * import. {@link MlvLanguageModule} is the public type.
 *
 * `libs/i18n/tests/published-package.spec.ts` derives the locale set from the
 * built package — the `exports` map of `dist/libs/i18n/package.json` and the
 * `*Language` name each entry point's `.d.ts` emits — and asserts that derived
 * set matches this union **in both directions**. So a fifteenth locale added
 * without a name here fails that gate, and so does a name here that no longer
 * names a published locale.
 */
type MlvLanguageExportName =
  | 'deLanguage'
  | 'enLanguage'
  | 'esLanguage'
  | 'frLanguage'
  | 'idLanguage'
  | 'itLanguage'
  | 'jaLanguage'
  | 'nlLanguage'
  | 'plLanguage'
  | 'ptLanguage'
  | 'roLanguage'
  | 'trLanguage'
  | 'ukLanguage'
  | 'zhHansLanguage';

/**
 * @private One `{ <name>Language: MlvLanguage }` shape per published locale.
 *
 * Distributing over the union is what makes the property **required**, and that
 * is the whole point of enumerating the names instead of writing the obvious
 * template-literal index signature `{ [key: \`${string}Language\`]: MlvLanguage }`.
 * An index signature only constrains keys that exist, so a module carrying no
 * matching key at all satisfies it vacuously — `@malva-ui/i18n/testing`, which
 * exports two provider functions and no language, type-checks against it
 * (measured, not assumed). That would make the parameter type accept every
 * module in existence, which is worse than the bug it is fixing.
 *
 * The cost is that a consumer's own pack cannot invent a new `*Language` export
 * name; it uses `export default`, which is the documented shape for
 * hand-written packs and is what every bundler emits unchanged.
 */
type MlvNamedLanguageModule<
  K extends MlvLanguageExportName = MlvLanguageExportName,
> = K extends unknown ? { readonly [P in K]: MlvLanguage } : never;

/**
 * A lazily-imported language-pack module, in either shape `provideMlvI18n()`
 * and `MlvI18nService.switchLanguage()` accept:
 *
 * - `{ default: MlvLanguage }` — a hand-written pack, and what the locale
 *   entry points resolve to inside this workspace, where the tsconfig path
 *   mappings point at source.
 * - `{ <locale>Language: MlvLanguage }` — what the **published** package
 *   emits, because ng-packagr drops `export default` from every entry point.
 *
 * `default` wins whenever it is there and is returned **unread** — so a pack may
 * hold whatever keys it likes, and the in-workspace shape
 * `{ default, enLanguage }` resolves through `default`. With no `default`, the
 * module must carry exactly **one** `<something>Language` export: two — a
 * barrel that `export *`s two locales, say — throws rather than letting
 * declaration order pick a language. See {@link resolveMlvLanguage}.
 *
 * Use it to type a loader you hold yourself:
 *
 * @example
 * ```ts
 * const loader: () => Promise<MlvLanguageModule> = () =>
 *   import('@malva-ui/i18n/en');
 * ```
 */
export type MlvLanguageModule =
  | { readonly default: MlvLanguage }
  | MlvNamedLanguageModule;

/** @private Narrows to an indexable object, excluding `null`. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * @private Reads an opaque module member back as the pack it is.
 *
 * A loaded module is `Record<string, unknown>` at runtime and nothing about a
 * `MlvLanguage`'s 41 slices is checked here — the caller's argument type is
 * what carries that guarantee, so this is the one place the assertion is made,
 * named, and confined.
 */
const asLanguage = (value: Record<string, unknown>): MlvLanguage =>
  value as unknown as MlvLanguage;

/**
 * @private Whether `value` is a module namespace rather than a language pack.
 *
 * Asked only of a `default` export, so that an interop layer which synthesises
 * `default` as the namespace itself is not mistaken for the pack. It tests what
 * a namespace *is*, never what it happens to contain:
 *
 * - `value === module` — the self-reference an interop layer produces by
 *   assigning `default` back onto the namespace it belongs to;
 * - `__esModule` — the marker every ESM→CJS transpile stamps on its exports;
 * - `Symbol.toStringTag === 'Module'` — an ESM namespace object's own tag.
 *
 * A language pack has none of the three. The previous shape of this check —
 * "has a key ending in `Language`" — had two failure modes a consumer could hit
 * with no warning, because TypeScript's excess-property check does not fire
 * through a variable: a legitimate pack carrying a slice named e.g.
 * `contractLanguage` was silently replaced by that slice, making every later
 * lookup `undefined`; and the check ran over pack objects it had no business
 * inspecting at all.
 */
const isModuleNamespace = (
  value: Record<string, unknown>,
  module: Record<string, unknown>,
): boolean =>
  value === module ||
  value['__esModule'] === true ||
  (value as { [Symbol.toStringTag]?: unknown })[Symbol.toStringTag] ===
    'Module';

/**
 * @private Every `<something>Language` export of `source` whose value is an
 * object, in declaration order.
 *
 * Only ever reached with a module object, never with a pack — `default` is
 * returned unread — so a pack's own slice names cannot arrive here.
 */
const namedLanguageExports = (
  source: Record<string, unknown>,
): readonly (readonly [name: string, value: Record<string, unknown>])[] =>
  Object.entries(source).filter(
    (entry): entry is [string, Record<string, unknown>] =>
      entry[0] !== 'Language' &&
      entry[0].endsWith('Language') &&
      isRecord(entry[1]),
  );

/**
 * @private The one `<locale>Language` export of `source`, or `undefined` when
 * there is none.
 *
 * @throws Error when there is more than one. Every published locale entry point
 * carries exactly one — asserted per entry point by
 * `libs/i18n/tests/published-package.spec.ts` — so two means a module the
 * consumer assembled, typically a barrel that `export *`s two locales. The only
 * alternative to throwing is returning whichever `Object.entries` yields first,
 * which makes the active language depend on the order the barrel was written
 * in.
 */
const soleNamedLanguage = (
  source: Record<string, unknown>,
): MlvLanguage | undefined => {
  const matches = namedLanguageExports(source);
  if (matches.length === 0) return undefined;
  if (matches.length > 1) {
    throw new Error(
      'resolveMlvLanguage: the loaded module exports more than one language — ' +
        `${matches.map(([name]) => name).join(', ')}. Which one is meant is ` +
        'declaration order, so it is refused rather than guessed. Import the ' +
        'single locale entry point you want, or re-wrap it as ' +
        '`{ default: pack.enLanguage }`.',
    );
  }
  return asLanguage(matches[0][1]);
};

/**
 * Unwraps the `MlvLanguage` out of a loaded language-pack module, whichever of
 * the two shapes in {@link MlvLanguageModule} it arrived in.
 *
 * `default` wins when it is present, and is returned **unread** — so a consumer
 * who deliberately re-wraps a pack
 * (`import('…').then((pack) => ({ default: pack.enLanguage }))`) keeps the
 * behaviour they had, whatever that pack's slices are named. The one case where
 * `default` is not the language is an interop layer that synthesises it as the
 * module namespace, recognised by the namespace markers `__esModule`,
 * `Symbol.toStringTag` and a self-reference; the language is then the named
 * export, on the module or inside that namespace.
 *
 * @param module The resolved value of a language-pack dynamic import.
 * @returns The language pack.
 * @throws Error when the module carries no language under either shape. It
 * throws rather than returning `undefined` because the caller's next move is
 * `setLanguage()`, and an `undefined` there fails later, somewhere else, as an
 * unrelated-looking crash in the first component that reads a translation.
 * @throws Error when the module carries more than one `<locale>Language`
 * export, since choosing one would be choosing by declaration order.
 */
export function resolveMlvLanguage(module: MlvLanguageModule): MlvLanguage {
  const exported = module as Record<string, unknown>;
  const fromDefault = exported['default'];

  if (isRecord(fromDefault) && !isModuleNamespace(fromDefault, exported)) {
    return asLanguage(fromDefault);
  }

  // `default` is absent, nullish, or an interop namespace: the pack is the
  // module's own `<locale>Language` export — or, when the interop layer wrapped
  // the namespace rather than copying it out, the one inside that namespace.
  const named =
    soleNamedLanguage(exported) ??
    (isRecord(fromDefault) ? soleNamedLanguage(fromDefault) : undefined);
  if (named) return named;

  const keys = Object.keys(exported);
  throw new Error(
    'resolveMlvLanguage: the loaded module exports no MlvLanguage. A language ' +
      "pack must expose it as the module's `default` export, or as a " +
      '`<locale>Language` named export — which is what the published ' +
      '@malva-ui/i18n locale entry points emit. The module exported: ' +
      `${keys.length > 0 ? keys.join(', ') : '<nothing>'}.`,
  );
}
