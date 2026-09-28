import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { ApplicationRef, Component, signal } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Subject } from 'rxjs';
import type { MlvLanguage } from '@malva-ui/i18n';
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { deLanguage } from '@malva-ui/i18n/de';
import { enLanguage } from '@malva-ui/i18n/en';
import { plLanguage } from '@malva-ui/i18n/pl';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvAutocompleteSearchFn } from './autocomplete';
import { MlvAutocomplete } from './autocomplete';

/**
 * #370: `[mlvAutocomplete]` had no i18n slice. Its loading row read the English
 * `loadingText` default, an empty result list rendered a blank panel, and
 * nothing told a screen-reader user how many suggestions a query produced —
 * while `mlv-combobox` announces `noResults` / `resultsAvailable` politely.
 * The directive now reads the optional `autocomplete` slice (English fallback
 * for each key), renders a no-results row and announces the count through the
 * CDK `LiveAnnouncer`.
 */
@Component({
  imports: [MlvAutocomplete],
  template: `<input
    aria-label="Fruit"
    [mlvAutocomplete]="options()"
    [mlvAutocompleteSearch]="search()"
    [mlvAutocompleteDebounce]="0"
    [mlvAutocompleteMinLength]="minLength()"
    [mlvAutocompleteLoadingText]="loadingText()"
  />`,
})
class AutocompleteHost {
  readonly options = signal<string[]>([
    'Apple',
    'Apricot',
    'Avocado',
    'Cherry',
  ]);
  readonly search = signal<MlvAutocompleteSearchFn<string> | null>(null);
  readonly minLength = signal(0);
  readonly loadingText = signal<string | undefined>(undefined);
}

describe('MlvAutocomplete — i18n, no-results row and announcement (#370)', () => {
  let fixture: ComponentFixture<AutocompleteHost>;
  let input: HTMLInputElement;
  let overlay: HTMLElement;
  let announce: ReturnType<typeof vi.spyOn>;

  async function render(
    providers: (Provider | EnvironmentProviders)[],
    pack?: MlvLanguage,
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AutocompleteHost],
      providers,
    }).compileComponents();
    if (pack) TestBed.inject(MlvI18nService).setLanguage(pack);
    announce = vi
      .spyOn(TestBed.inject(LiveAnnouncer), 'announce')
      .mockResolvedValue(undefined);
    fixture = TestBed.createComponent(AutocompleteHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    input = (fixture.nativeElement as HTMLElement).querySelector(
      'input',
    ) as HTMLInputElement;
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  }

  async function withPack(pack: MlvLanguage): Promise<void> {
    await render([provideMlvI18n(async () => ({ default: pack }))], pack);
  }

  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  /** Flushes the debounce, the directive's effects and the portaled panel. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    await fixture.whenStable();
  }

  async function type(value: string): Promise<void> {
    input.value = value;
    input.setSelectionRange(value.length, value.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  function emptyRow(): string | null {
    const el = overlay.querySelector('.mlv-dropdown-panel__empty');
    return el ? (el.textContent ?? '').trim() : null;
  }

  function loadingRow(): string | null {
    const el = overlay.querySelector(
      '.mlv-dropdown-panel__loading .mlv-dropdown-panel__loading-text',
    );
    return el ? (el.textContent ?? '').trim() : null;
  }

  /** Announcement texts in call order, each with its politeness. */
  function announcements(): string[] {
    return announce.mock.calls.map(
      ([message, politeness]) => `${String(message)} | ${String(politeness)}`,
    );
  }

  describe('English under the testing pack', () => {
    beforeEach(async () => {
      await render([provideMlvI18nTesting()]);
    });

    it('announces the result count politely, as mlv-combobox words it', async () => {
      await type('a');
      expect(announcements().at(-1)).toBe('3 results available | polite');

      await type('avo');
      expect(announcements().at(-1)).toBe('1 result available | polite');
    });

    it('renders and announces "No results found" for a query with no match', async () => {
      await type('zzz');
      expect(overlay.querySelectorAll('[role="option"]').length).toBe(0);
      expect(emptyRow()).toBe('No results found');
      expect(announcements().at(-1)).toBe('No results found | polite');
      // Outside the listbox: a listbox may own only options and groups.
      const row = overlay.querySelector('.mlv-dropdown-panel__empty');
      expect(row?.closest('[role="listbox"]') ?? null).toBeNull();
      expect(overlay.querySelector('[role="listbox"]')).not.toBeNull();
    });

    it('announces nothing new when the same count repeats', async () => {
      await type('ap');
      const before = announce.mock.calls.length;
      await type('apr');
      await type('ap');
      // "ap" (2) → "apr" (1) → "ap" (2): each change is announced once.
      expect(announce.mock.calls.length).toBe(before + 2);
    });

    it('keeps the English loading text byte-identical', async () => {
      fixture.componentInstance.search.set(() =>
        new Subject<string[]>().asObservable(),
      );
      fixture.detectChanges();
      await type('ap');
      expect(loadingRow()).toBe('Loading…');
    });

    it('does not announce "No results found" while a search is in flight', async () => {
      const results = new Subject<string[]>();
      fixture.componentInstance.search.set(() => results.asObservable());
      fixture.detectChanges();
      await type('ap');
      expect(emptyRow()).toBeNull();
      expect(announcements()).not.toContain('No results found | polite');

      results.next(['Apple', 'Apricot']);
      results.complete();
      await settle();
      expect(announcements().at(-1)).toBe('2 results available | polite');
    });

    it('is axe-clean with results', async () => {
      await type('a');
      expect(overlay.querySelectorAll('[role="option"]').length).toBe(3);
      await expectNoAxeViolations(document.body);
    });

    it('is axe-clean with the no-results row', async () => {
      await type('zzz');
      expect(emptyRow()).toBe('No results found');
      await expectNoAxeViolations(document.body);
    });
  });

  it('works with no i18n provider, in English', async () => {
    await render([]);
    await type('zzz');
    expect(emptyRow()).toBe('No results found');
    expect(announcements().at(-1)).toBe('No results found | polite');
  });

  describe('with the de pack', () => {
    beforeEach(async () => {
      await withPack(deLanguage);
    });

    it('reads the announcement, no-results row and loading text from the pack', async () => {
      await type('a');
      expect(announcements().at(-1)).toBe('3 Ergebnisse verfügbar | polite');

      await type('zzz');
      expect(emptyRow()).toBe('Keine Ergebnisse gefunden');
      expect(announcements().at(-1)).toBe('Keine Ergebnisse gefunden | polite');

      fixture.componentInstance.search.set(() =>
        new Subject<string[]>().asObservable(),
      );
      fixture.detectChanges();
      await type('ap');
      expect(loadingRow()).toBe('Wird geladen…');
    });

    it('lets an explicit loading text win over the pack', async () => {
      fixture.componentInstance.loadingText.set('Suche läuft…');
      fixture.componentInstance.search.set(() =>
        new Subject<string[]>().asObservable(),
      );
      fixture.detectChanges();
      await type('ap');
      expect(loadingRow()).toBe('Suche läuft…');
    });

    it('is axe-clean with the localized no-results row', async () => {
      await type('zzz');
      await expectNoAxeViolations(document.body);
    });
  });

  it("uses the pack locale's plural category (pl: few)", async () => {
    await withPack(plLanguage);
    await type('ap');
    expect(announcements().at(-1)).toBe('2 wyniki dostępne | polite');
  });

  it('falls back to English for a hand-written pack without the slice', async () => {
    const { autocomplete: _omitted, ...withoutSlice } =
      enLanguage as MlvLanguage & { autocomplete?: unknown };
    await withPack(withoutSlice as MlvLanguage);
    await type('zzz');
    expect(emptyRow()).toBe('No results found');
  });
});
