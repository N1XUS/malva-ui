import { ApplicationInitStatus, LOCALE_ID, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import en from '../../en/src/lib/en';
import uk from '../../uk/src/lib/uk';
import { MlvI18nResolverService } from './i18n-resolver.service';
import { MlvI18nService } from './i18n.service';
import { MLV_LOCALE } from './locale';
import { provideMlvI18n } from './provide-i18n';
import type { MlvLanguage } from './types';

/** A pack written before `MlvLanguage.locale` existed. */
const NO_LOCALE = { alert: { dismiss: 'x' } } as unknown as MlvLanguage;

/**
 * Configures the test module. A pack is what `provideMlvI18n()` loads, and the
 * APP_INITIALIZER that sets it is awaited; `'pending'` provides the i18n system
 * with a pack that never arrives; `null` omits `provideMlvI18n()` altogether.
 */
async function setup(
  providers: Provider[],
  pack: MlvLanguage | 'pending' | null,
): Promise<void> {
  const loader =
    pack === 'pending'
      ? () => new Promise<never>(() => undefined)
      : async () => ({ default: pack as MlvLanguage });
  TestBed.configureTestingModule({
    providers: [...(pack ? [provideMlvI18n(loader)] : []), ...providers],
  });
  if (pack !== 'pending') {
    await TestBed.inject(ApplicationInitStatus).donePromise;
  }
}

describe('MLV_LOCALE', () => {
  it("is the active pack's locale, and follows a runtime switch", async () => {
    await setup([], uk);
    const service = TestBed.inject(MlvI18nService);
    const locale = TestBed.inject(MLV_LOCALE);
    expect(locale()).toBe('uk');

    await service.switchLanguage(async () => ({ default: en }));
    expect(locale()).toBe('en');
  });

  it('falls back to LOCALE_ID while no pack is active', async () => {
    await setup([{ provide: LOCALE_ID, useValue: 'de' }], 'pending');
    expect(TestBed.inject(MLV_LOCALE)()).toBe('de');
  });

  it('falls back to LOCALE_ID when the pack declares no locale', async () => {
    await setup([{ provide: LOCALE_ID, useValue: 'de' }], NO_LOCALE);
    expect(TestBed.inject(MLV_LOCALE)()).toBe('de');
  });

  it('is LOCALE_ID when provideMlvI18n() is absent', async () => {
    await setup([{ provide: LOCALE_ID, useValue: 'fr-CA' }], null);
    expect(TestBed.inject(MLV_LOCALE)()).toBe('fr-CA');
  });

  it("is Angular's default LOCALE_ID when nothing is configured", async () => {
    await setup([], null);
    expect(TestBed.inject(MLV_LOCALE)()).toBe('en-US');
  });

  // Review #306 F3: the value reaches `new IntlMessageFormat()` and
  // `Intl.DateTimeFormat`, which throw `RangeError` on a malformed tag. A pack
  // is hand-written data, so a typo must degrade to the fallback rather than
  // take every plural and date down with it.
  describe('canonicalisation', () => {
    const PLURAL = { files: '{n, plural, one {# Datei} other {# Dateien}}' };

    function plural(n: number): string {
      return TestBed.inject(MlvI18nResolverService).resolve(PLURAL, 'files', {
        n,
      });
    }

    it("falls back to LOCALE_ID when the pack's locale is malformed, instead of throwing", async () => {
      await setup([{ provide: LOCALE_ID, useValue: 'de' }], {
        ...uk,
        locale: 'not a locale',
      });
      expect(TestBed.inject(MLV_LOCALE)()).toBe('de');
      expect(plural(2)).toBe('2 Dateien');
    });

    it("canonicalises the pack's locale", async () => {
      await setup([], { ...uk, locale: 'zh-hans' });
      expect(TestBed.inject(MLV_LOCALE)()).toBe('zh-Hans');
    });

    // Angular itself accepts `de_AT` as a `LOCALE_ID` (its locale-data lookup
    // folds `_` to `-`), and before #306 nothing handed `LOCALE_ID` to `Intl`.
    it('repairs an underscore LOCALE_ID the way Angular reads one', async () => {
      await setup([{ provide: LOCALE_ID, useValue: 'de_AT' }], null);
      expect(TestBed.inject(MLV_LOCALE)()).toBe('de-AT');
      expect(plural(1)).toBe('1 Datei');
    });

    it('falls back to en-US when LOCALE_ID is malformed as well', async () => {
      await setup([{ provide: LOCALE_ID, useValue: 'not a locale' }], {
        ...uk,
        locale: '',
      });
      expect(TestBed.inject(MLV_LOCALE)()).toBe('en-US');
    });
  });
});
