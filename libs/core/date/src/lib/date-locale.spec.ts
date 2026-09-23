import {
  ApplicationInitStatus,
  computed,
  LOCALE_ID,
  type Provider,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  MlvI18nService,
  provideMlvI18n,
  type MlvLanguage,
} from '@malva-ui/i18n';
import {
  MLV_DATE_ADAPTER,
  MLV_DATE_LOCALE,
  provideMlvDateAdapter,
} from './date-adapter';
import { MlvNativeDateAdapter } from './native-date-adapter';

/**
 * #306 — dates format in the active language pack's locale (`MLV_LOCALE`,
 * falling back to `LOCALE_ID`), not in `navigator.language`.
 */

/** Minimal packs: only the `locale` field matters to date formatting. */
const pack = (locale: string): MlvLanguage =>
  ({ locale }) as unknown as MlvLanguage;
const DE = pack('de');
const UK = pack('uk');

const JUNE = new Date(2026, 5, 5);

/**
 * Configures the test module with `active` as the pack `provideMlvI18n()`
 * loads, and waits for its APP_INITIALIZER to set it — so the initializer can
 * never land mid-test on top of a later switch. `null` omits
 * `provideMlvI18n()` altogether.
 */
async function setup(
  providers: Provider[] = [],
  active: MlvLanguage | null = DE,
): Promise<void> {
  TestBed.configureTestingModule({
    providers: [
      ...(active ? [provideMlvI18n(async () => ({ default: active }))] : []),
      ...providers,
    ],
  });
  await TestBed.inject(ApplicationInitStatus).donePromise;
}

afterEach(() => vi.restoreAllMocks());

describe('MLV_DATE_LOCALE default', () => {
  it("is the active pack's locale", async () => {
    await setup();
    expect(TestBed.inject(MLV_DATE_LOCALE)).toBe('de');
    expect(TestBed.inject(MlvNativeDateAdapter).getMonthYearLabel(JUNE)).toBe(
      'Juni 2026',
    );
  });

  it('is LOCALE_ID when no language pack is provided', async () => {
    await setup([{ provide: LOCALE_ID, useValue: 'fr' }], null);
    expect(TestBed.inject(MLV_DATE_LOCALE)).toBe('fr');
  });

  it('never reads navigator.language, so the server and the browser agree', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ja-JP');
    await setup([], null);
    expect(TestBed.inject(MLV_DATE_LOCALE)).toBe('en-US');
  });
});

describe('MlvNativeDateAdapter locale', () => {
  it('follows a runtime language switch, re-formatting reactively', async () => {
    await setup();
    const adapter = TestBed.inject(MlvNativeDateAdapter);
    const label = computed(() => adapter.getMonthYearLabel(JUNE));
    expect([adapter.locale(), label()]).toEqual(['de', 'Juni 2026']);

    await TestBed.inject(MlvI18nService).switchLanguage(async () => ({
      default: UK,
    }));
    expect([adapter.locale(), label()]).toEqual(['uk', 'червень 2026 р.']);
  });

  it('follows the pack when the MLV_DATE_LOCALE default was read before the pack loaded', async () => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18n(() => new Promise<never>(() => undefined))],
    });
    // Something reads the token during bootstrap, before APP_INITIALIZER has
    // set the pack: the default snapshots LOCALE_ID.
    expect(TestBed.inject(MLV_DATE_LOCALE)).toBe('en-US');
    TestBed.inject(MlvI18nService).setLanguage(DE);

    // A snapshot is not an explicit locale, so it must not pin the adapter.
    expect(TestBed.inject(MlvNativeDateAdapter).locale()).toBe('de');
  });

  it('keeps an MLV_DATE_LOCALE that differs from the pack across a switch', async () => {
    await setup([...provideMlvDateAdapter(MlvNativeDateAdapter, 'ro-RO')]);
    const adapter = TestBed.inject(MLV_DATE_ADAPTER);
    expect(adapter.locale()).toBe('ro-RO');

    await TestBed.inject(MlvI18nService).switchLanguage(async () => ({
      default: UK,
    }));
    expect(adapter.locale()).toBe('ro-RO');
  });

  it('keeps a setLocale() that differs from the pack across a switch', async () => {
    await setup();
    const adapter = TestBed.inject(MlvNativeDateAdapter);
    adapter.setLocale('ja');

    await TestBed.inject(MlvI18nService).switchLanguage(async () => ({
      default: UK,
    }));
    expect(adapter.locale()).toBe('ja');
  });

  // Review #306 F1: a pin is state, not a value comparison. Before, a pinned
  // locale was released by any switch that passed through it, and only when
  // something happened to read `locale()` while the two coincided — which a
  // rendered calendar always does. Both probes read between every switch.
  it('keeps an explicit MLV_DATE_LOCALE when a switch passes through it', async () => {
    await setup(
      [...provideMlvDateAdapter(MlvNativeDateAdapter, 'de')],
      pack('en'),
    );
    const adapter = TestBed.inject(MLV_DATE_ADAPTER);
    const service = TestBed.inject(MlvI18nService);
    const seen = [adapter.locale()];

    await service.switchLanguage(async () => ({ default: DE }));
    seen.push(adapter.locale());
    await service.switchLanguage(async () => ({ default: UK }));
    seen.push(adapter.locale());

    expect(seen).toEqual(['de', 'de', 'de']);
  });

  it('keeps a setLocale() pin when a switch passes through it', async () => {
    await setup();
    const adapter = TestBed.inject(MlvNativeDateAdapter);
    const service = TestBed.inject(MlvI18nService);
    adapter.setLocale('ja');

    await service.switchLanguage(async () => ({ default: pack('ja') }));
    const seen = [adapter.locale()];
    await service.switchLanguage(async () => ({ default: UK }));
    seen.push(adapter.locale());

    expect(seen).toEqual(['ja', 'ja']);
  });

  it('keeps an explicit MLV_DATE_LOCALE that equals the pack at construction', async () => {
    await setup([...provideMlvDateAdapter(MlvNativeDateAdapter, 'de')]);
    const adapter = TestBed.inject(MLV_DATE_ADAPTER);
    expect(adapter.locale()).toBe('de');

    await TestBed.inject(MlvI18nService).switchLanguage(async () => ({
      default: UK,
    }));
    expect(adapter.locale()).toBe('de');
  });

  it('follows the pack again once setLocale() puts it back in step', async () => {
    await setup();
    const adapter = TestBed.inject(MlvNativeDateAdapter);
    adapter.setLocale('ja');
    adapter.setLocale('de');

    await TestBed.inject(MlvI18nService).switchLanguage(async () => ({
      default: UK,
    }));
    expect(adapter.locale()).toBe('uk');
  });
});
