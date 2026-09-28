import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import {
  Component,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import type { MlvLanguage } from '@malva-ui/i18n';
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { deLanguage } from '@malva-ui/i18n/de';
import { enLanguage } from '@malva-ui/i18n/en';
import { esLanguage } from '@malva-ui/i18n/es';
import { frLanguage } from '@malva-ui/i18n/fr';
import { idLanguage } from '@malva-ui/i18n/id';
import { itLanguage } from '@malva-ui/i18n/it';
import { jaLanguage } from '@malva-ui/i18n/ja';
import { nlLanguage } from '@malva-ui/i18n/nl';
import { plLanguage } from '@malva-ui/i18n/pl';
import { ptLanguage } from '@malva-ui/i18n/pt';
import { roLanguage } from '@malva-ui/i18n/ro';
import { trLanguage } from '@malva-ui/i18n/tr';
import { ukLanguage } from '@malva-ui/i18n/uk';
import { zhHansLanguage } from '@malva-ui/i18n/zh-Hans';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvBreakpointService, type MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvDateRangePicker } from './date-range-picker';

@Component({
  imports: [MlvDateRangePicker],
  template: `<mlv-date-range-picker label="Stay dates" />`,
})
class I18nHost {
  readonly picker = viewChild.required(MlvDateRangePicker);
}

/** Pins the anchored layout: jsdom matches no `min-width` query. */
class FakeBreakpointService {
  readonly down: WritableSignal<boolean> = signal(false);
  isDown(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return this.down;
  }
  isUp(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return signal(false);
  }
}

/**
 * The visible footer labels each shipped pack must render, `[clear, apply]`.
 * Written out rather than read from the packs, so the spec fails if a pack
 * drops the key and the English fallback shows through.
 */
const VISIBLE_LABELS: ReadonlyArray<
  readonly [string, MlvLanguage, readonly [string, string]]
> = [
  ['en', enLanguage, ['Clear', 'Apply']],
  ['de', deLanguage, ['Löschen', 'Anwenden']],
  ['fr', frLanguage, ['Effacer', 'Appliquer']],
  ['it', itLanguage, ['Cancella', 'Applica']],
  ['es', esLanguage, ['Borrar', 'Aplicar']],
  ['pt', ptLanguage, ['Limpar', 'Aplicar']],
  ['uk', ukLanguage, ['Очистити', 'Застосувати']],
  ['ro', roLanguage, ['Șterge', 'Aplică']],
  ['ja', jaLanguage, ['クリア', '適用']],
  ['nl', nlLanguage, ['Wissen', 'Toepassen']],
  ['pl', plLanguage, ['Wyczyść', 'Zastosuj']],
  ['tr', trLanguage, ['Temizle', 'Uygula']],
  ['zh-Hans', zhHansLanguage, ['清除', '应用']],
  ['id', idLanguage, ['Hapus', 'Terapkan']],
];

/**
 * #370: the footer rendered the English literals "Clear" / "Apply" in every
 * locale while its `aria-label`s came from the pack — so in the 13 other packs
 * the accessible name no longer contained the visible label (WCAG 2.5.3, Label
 * in Name: "click Anwenden" by speech input matched nothing). The visible text
 * now comes from the optional `clear` / `apply` keys and the `aria-label` keeps
 * the pack's longer sentence, which starts or ends with that label in every
 * shipped pack — so the English names are unchanged.
 */
describe('MlvDateRangePicker — footer labels i18n (#370)', () => {
  let fixture: ComponentFixture<I18nHost>;

  async function render(
    providers: (Provider | EnvironmentProviders)[],
    pack?: MlvLanguage,
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [I18nHost],
      providers: [
        ...providers,
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
      ],
    }).compileComponents();
    if (pack) TestBed.inject(MlvI18nService).setLanguage(pack);
    fixture = TestBed.createComponent(I18nHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.picker().toggleDropdown();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function withPack(pack: MlvLanguage): Promise<void> {
    await render([provideMlvI18n(async () => ({ default: pack }))], pack);
  }

  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  function button(kind: 'clear' | 'apply'): HTMLButtonElement {
    const el = document.body.querySelector<HTMLButtonElement>(
      `.mlv-date-range-picker__${kind}-btn`,
    );
    if (!el) throw new Error(`no ${kind} button rendered`);
    return el;
  }

  function visible(kind: 'clear' | 'apply'): string {
    return (button(kind).textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function name(kind: 'clear' | 'apply'): string {
    return button(kind).getAttribute('aria-label') ?? '';
  }

  it('keeps the English labels and names byte-identical', async () => {
    await render([provideMlvI18nTesting()]);

    expect([visible('clear'), visible('apply')]).toEqual(['Clear', 'Apply']);
    expect([name('clear'), name('apply')]).toEqual([
      'Clear date range',
      'Apply date range',
    ]);
  });

  it.each(VISIBLE_LABELS)(
    '%s: renders the pack labels, and each name contains its visible label',
    async (locale, pack, [clear, apply]) => {
      await withPack(pack);

      expect([visible('clear'), visible('apply')]).toEqual([clear, apply]);
      for (const kind of ['clear', 'apply'] as const) {
        expect(
          name(kind).toLocaleLowerCase(locale),
          `${locale} ${kind}: "${name(kind)}" ⊇ "${visible(kind)}"`,
        ).toContain(visible(kind).toLocaleLowerCase(locale));
      }
    },
  );

  it('falls back to English for a hand-written pack without the keys', async () => {
    const {
      clear: _clear,
      apply: _apply,
      ...withoutKeys
    } = enLanguage.dateRangePicker as MlvLanguage['dateRangePicker'] & {
      clear?: string;
      apply?: string;
    };
    await withPack({ ...enLanguage, dateRangePicker: withoutKeys });

    expect([visible('clear'), visible('apply')]).toEqual(['Clear', 'Apply']);
  });
});
