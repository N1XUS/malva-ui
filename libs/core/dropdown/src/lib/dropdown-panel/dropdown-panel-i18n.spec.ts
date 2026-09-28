import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { Provider, EnvironmentProviders } from '@angular/core';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import type { MlvLanguage } from '@malva-ui/i18n';
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { deLanguage } from '@malva-ui/i18n/de';
import { enLanguage } from '@malva-ui/i18n/en';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvDropdownPanel } from './dropdown-panel';

/**
 * #370: `loadingText` defaulted to the English literal `'Loading…'`, so a
 * panel whose owner passed no text — a consumer's own panel — read English in
 * every locale. The default now resolves the optional `dropdownPanel.loading`
 * key, falling back to the same English string; an explicit `loadingText`
 * still wins.
 */
describe('MlvDropdownPanel — loading text i18n (#370)', () => {
  let fixture: ComponentFixture<MlvDropdownPanel<string>>;

  async function render(
    providers: (Provider | EnvironmentProviders)[],
    pack?: MlvLanguage,
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MlvDropdownPanel],
      providers: [...providers, MlvSelectionService],
    }).compileComponents();
    if (pack) TestBed.inject(MlvI18nService).setLanguage(pack);
    fixture =
      TestBed.createComponent<MlvDropdownPanel<string>>(MlvDropdownPanel);
    fixture.componentRef.setInput('options', [{ label: 'Alpha', value: 'a' }]);
    fixture.componentRef.setInput('listboxId', 'lb');
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('loadingMore', true);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function withPack(pack: MlvLanguage): Promise<void> {
    await render([provideMlvI18n(async () => ({ default: pack }))], pack);
  }

  function text(selector: string): string {
    const el = (fixture.nativeElement as HTMLElement).querySelector(
      `${selector} .mlv-dropdown-panel__loading-text`,
    );
    return (el?.textContent ?? '').trim();
  }

  it('keeps the English default with no i18n provider at all', async () => {
    await render([]);
    expect(text('.mlv-dropdown-panel__loading')).toBe('Loading…');
    expect(text('.mlv-dropdown-panel__loading-more')).toBe('Loading…');
  });

  it('keeps the English default under the testing pack', async () => {
    await render([provideMlvI18nTesting()]);
    expect(text('.mlv-dropdown-panel__loading')).toBe('Loading…');
  });

  it('reads the default from the active language pack, in both rows', async () => {
    await withPack(deLanguage);
    expect(text('.mlv-dropdown-panel__loading')).toBe('Wird geladen…');
    expect(text('.mlv-dropdown-panel__loading-more')).toBe('Wird geladen…');
  });

  it('falls back to English for a hand-written pack without the slice', async () => {
    const { dropdownPanel: _omitted, ...withoutSlice } =
      enLanguage as MlvLanguage & { dropdownPanel?: unknown };
    await withPack({ ...withoutSlice, locale: 'de' } as MlvLanguage);
    expect(text('.mlv-dropdown-panel__loading')).toBe('Loading…');
  });

  it('lets an explicit loadingText win over the pack', async () => {
    await withPack(deLanguage);
    fixture.componentRef.setInput('loadingText', 'Fetching builds…');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(text('.mlv-dropdown-panel__loading')).toBe('Fetching builds…');
    expect(text('.mlv-dropdown-panel__loading-more')).toBe('Fetching builds…');
  });
});
