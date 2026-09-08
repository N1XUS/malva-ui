import { resolveMlvLanguage, type MlvLanguageModule } from './language-module';
import type { MlvLanguage } from './types';

const en = {
  alert: { dismiss: 'Dismiss alert' },
  dialog: { closeDialog: 'Close dialog' },
} as MlvLanguage;

const de = {
  alert: { dismiss: 'Verwerfen' },
  dialog: { closeDialog: 'Dialog schliessen' },
} as MlvLanguage;

describe('resolveMlvLanguage', () => {
  it('reads the `default` export a hand-written pack uses', () => {
    expect(resolveMlvLanguage({ default: en })).toBe(en);
  });

  it('reads the `<locale>Language` export the published package emits', () => {
    // The exact shape of dist/libs/i18n/types/malva-ui-i18n-en.d.ts, which
    // carries no default at all.
    expect(resolveMlvLanguage({ enLanguage: en })).toBe(en);
  });

  it('prefers `default` when a module carries both, as the sources do', () => {
    const sourceShape = { default: en, enLanguage: de } as MlvLanguageModule;
    expect(resolveMlvLanguage(sourceShape)).toBe(en);
  });

  // A real ESM namespace of each published shape is resolved in
  // `libs/i18n/tests/published-package.spec.ts`, against the built `.mjs`.

  describe('a `default` that is a module namespace, not a pack', () => {
    // An interop layer may synthesise `default` as the namespace itself. The
    // language is then the named export, never the namespace. Each marker below
    // is something a namespace *is* — a pack object has none of them, which is
    // what keeps a pack whose slice happens to end in `Language` intact.

    it('unwraps a `default` that points back at the module', () => {
      const namespace: Record<string, unknown> = { zhHansLanguage: de };
      namespace['default'] = namespace;

      expect(
        resolveMlvLanguage(namespace as unknown as MlvLanguageModule),
      ).toBe(de);
    });

    it('unwraps a `default` tagged `Symbol.toStringTag === "Module"`', () => {
      const namespace = {
        [Symbol.toStringTag]: 'Module',
        frLanguage: de,
      };
      const wrapper = { ...namespace, default: namespace };

      expect(resolveMlvLanguage(wrapper as unknown as MlvLanguageModule)).toBe(
        de,
      );
    });

    it('unwraps a `default` marked `__esModule`, reading inside it', () => {
      // The wrapped form: the interop layer kept the namespace whole under
      // `default` instead of copying its keys out, so the only place the pack
      // can be read from is inside it.
      const namespace = { __esModule: true, ukLanguage: de };

      expect(
        resolveMlvLanguage({
          default: namespace,
        } as unknown as MlvLanguageModule),
      ).toBe(de);
    });
  });

  it('returns a `default` pack untouched when a slice name ends in "Language"', () => {
    // Regression: the namespace check used to be "has a key ending in
    // `Language`", so a consumer pack with any such slice was replaced by that
    // slice and every later lookup came back `undefined`. TypeScript cannot
    // catch it — the excess-property check does not fire through a variable.
    const pack = {
      ...en,
      contractLanguage: { code: 'en-GB' },
    } as unknown as MlvLanguage;

    expect(resolveMlvLanguage({ default: pack })).toBe(pack);
  });

  it('throws rather than letting declaration order pick between two languages', () => {
    const deFirst = { deLanguage: de, enLanguage: en } as MlvLanguageModule;
    const enFirst = { enLanguage: en, deLanguage: de } as MlvLanguageModule;

    // Both orders are refused: neither is "the" language, and the old
    // first-match scan silently returned whichever the barrel declared first.
    expect(() => resolveMlvLanguage(deFirst)).toThrowError(
      /more than one language[\s\S]*deLanguage, enLanguage/,
    );
    expect(() => resolveMlvLanguage(enFirst)).toThrowError(
      /more than one language[\s\S]*enLanguage, deLanguage/,
    );
  });

  it('throws naming the problem when the module carries no language', () => {
    // `@malva-ui/i18n/testing` is the real published module of this shape.
    const notAPack = {
      provideMlvI18nTesting: () => undefined,
      i18nTestProvider: () => undefined,
    } as unknown as MlvLanguageModule;

    expect(() => resolveMlvLanguage(notAPack)).toThrowError(
      /exports no MlvLanguage[\s\S]*provideMlvI18nTesting, i18nTestProvider/,
    );
  });

  it('throws rather than returning undefined for an empty module', () => {
    const empty = {} as MlvLanguageModule;
    expect(() => resolveMlvLanguage(empty)).toThrowError(/<nothing>/);
  });

  it('does not mistake a nullish `default` for a language', () => {
    const nulled = {
      default: null,
      frLanguage: de,
    } as unknown as MlvLanguageModule;
    expect(resolveMlvLanguage(nulled)).toBe(de);
  });
});
