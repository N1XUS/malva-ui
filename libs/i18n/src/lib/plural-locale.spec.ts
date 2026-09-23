import {
  ApplicationInitStatus,
  Component,
  computed,
  LOCALE_ID,
  type Provider,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import IntlMessageFormat from 'intl-messageformat';
import en from '../../en/src/lib/en';
import pl from '../../pl/src/lib/pl';
import uk from '../../uk/src/lib/uk';
import { MlvI18nResolverService } from './i18n-resolver.service';
import { MlvI18nService } from './i18n.service';
import { provideMlvI18n } from './provide-i18n';
import { MlvTranslatePipe } from './translate.pipe';
import type { MlvLanguage } from './types';

/**
 * #306 — ICU plurals pick their CLDR categories from the active pack's locale
 * (`MLV_LOCALE`), not from the runtime default locale `intl-messageformat`
 * falls back to when it is handed none.
 */

/**
 * The same template under two locales whose CLDR rules disagree on zero:
 * `pt` (Brazil) puts 0 in `one`, `pt-PT` puts it in `other`. One template and
 * one slice object, so the only thing that differs between the two packs is
 * the `locale` field — which is what the resolver's cache and signal tracking
 * have to notice.
 */
const FILES = '{count, plural, one {# ficheiro} other {# ficheiros}}';
const SHARED_SLICE = { dismiss: FILES };
const PT_BR = { locale: 'pt', alert: SHARED_SLICE } as unknown as MlvLanguage;
const PT_PT = {
  locale: 'pt-PT',
  alert: SHARED_SLICE,
} as unknown as MlvLanguage;

/**
 * Pins the runtime default locale `intl-messageformat` falls back to when it is
 * given none — the "browser language" of the audit's failure scenarios — so the
 * suite does not depend on the machine it runs on.
 */
function runtimeDefaultLocale(locale: string): void {
  vi.spyOn(IntlMessageFormat, 'defaultLocale', 'get').mockReturnValue(locale);
}

async function setup(
  providers: Provider[] = [],
  withI18n = true,
): Promise<void> {
  TestBed.configureTestingModule({
    providers: [
      ...(withI18n ? [provideMlvI18n(async () => ({ default: en }))] : []),
      ...providers,
    ],
  });
  // Let provideMlvI18n()'s APP_INITIALIZER land its `en` pack first; left
  // pending, it lands at the next await and overwrites the pack a test set.
  await TestBed.inject(ApplicationInitStatus).donePromise;
}

function members(total: number): string {
  const i18n = TestBed.inject(MlvI18nService).select('avatarGroup');
  return TestBed.inject(MlvI18nResolverService).resolve(
    i18n() as unknown as Record<string, string>,
    'memberCount',
    { total },
  );
}

afterEach(() => vi.restoreAllMocks());

describe('MlvI18nResolverService plural locale', () => {
  it('picks Ukrainian plural categories for the uk pack on an en-US runtime', async () => {
    runtimeDefaultLocale('en-US');
    await setup();
    TestBed.inject(MlvI18nService).setLanguage(uk);

    expect([members(1), members(3), members(5), members(21)]).toEqual([
      '1 учасник', // one
      '3 учасники', // few
      '5 учасників', // many
      '21 учасник', // one
    ]);
  });

  it('picks Polish plural categories for the pl pack on an en-US runtime', async () => {
    runtimeDefaultLocale('en-US');
    await setup();
    TestBed.inject(MlvI18nService).setLanguage(pl);

    // 21 is `many` in Polish but `one` in Ukrainian: the categories come from
    // the pack's own locale, not from a shared Slavic default.
    expect([
      members(1),
      members(3),
      members(5),
      members(21),
      members(22),
    ]).toEqual([
      '1 członek', // one
      '3 członkowie', // few
      '5 członków', // many
      '21 członków', // many
      '22 członkowie', // few
    ]);
  });

  it('keeps English plural categories for the en pack on a uk runtime', async () => {
    runtimeDefaultLocale('uk');
    await setup();
    TestBed.inject(MlvI18nService).setLanguage(en);

    expect([members(1), members(21), members(0)]).toEqual([
      '1 member',
      '21 members',
      '0 members',
    ]);
  });

  it("lets the pack's locale win over LOCALE_ID", async () => {
    runtimeDefaultLocale('en-US');
    await setup([{ provide: LOCALE_ID, useValue: 'uk' }]);
    TestBed.inject(MlvI18nService).setLanguage(en);

    expect(members(21)).toBe('21 members');
  });

  it('uses LOCALE_ID when provideMlvI18n() is absent', async () => {
    runtimeDefaultLocale('en-US');
    await setup([{ provide: LOCALE_ID, useValue: 'uk' }], false);
    const resolver = TestBed.inject(MlvI18nResolverService);
    const template = { members: uk.avatarGroup.memberCount };

    expect(
      [3, 5].map((total) => resolver.resolve(template, 'members', { total })),
    ).toEqual(['3 учасники', '5 учасників']);
  });

  it('re-formats a computed when only the locale changes under an unchanged template', async () => {
    runtimeDefaultLocale('en-US');
    await setup();
    const service = TestBed.inject(MlvI18nService);
    const resolver = TestBed.inject(MlvI18nResolverService);
    service.setLanguage(PT_BR);
    const alert = service.select('alert');
    const text = computed(() =>
      resolver.resolve(
        alert() as unknown as Record<string, string>,
        'dismiss',
        { count: 0 },
      ),
    );
    expect(text()).toBe('0 ficheiro');

    // Same slice object, same template: only `locale` moved. A cache keyed by
    // the template alone, or a resolver that does not read the locale signal,
    // leaves this at the Brazilian form.
    service.setLanguage(PT_PT);
    expect(text()).toBe('0 ficheiros');

    service.setLanguage(PT_BR);
    expect(text()).toBe('0 ficheiro');
  });
});

@Component({
  imports: [MlvTranslatePipe],
  template: `<span>{{ template | mlvTranslate: { count: 0 } }}</span>`,
})
class PipeHost {
  readonly template = FILES;
}

describe('MlvTranslatePipe plural locale', () => {
  it('re-formats in the template when only the locale changes', async () => {
    runtimeDefaultLocale('en-US');
    await setup();
    const service = TestBed.inject(MlvI18nService);
    service.setLanguage(PT_BR);
    const fixture = TestBed.createComponent(PipeHost);
    await fixture.whenStable();
    const text = (): string =>
      (fixture.nativeElement as HTMLElement).textContent?.trim() ?? '';
    expect(text()).toBe('0 ficheiro');

    service.setLanguage(PT_PT);
    await fixture.whenStable();
    expect(text()).toBe('0 ficheiros');
  });
});
