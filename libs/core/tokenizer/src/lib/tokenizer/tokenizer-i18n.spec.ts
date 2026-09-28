import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import type { MlvLanguage } from '@malva-ui/i18n';
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { deLanguage } from '@malva-ui/i18n/de';
import { enLanguage } from '@malva-ui/i18n/en';
import { itLanguage } from '@malva-ui/i18n/it';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTokenizer } from './tokenizer';

/**
 * #370: the overflow counter rendered `+N more` in English in every locale.
 * It now resolves the optional `tokenizer.moreItems` ICU key, with the English
 * string as the fallback for a pack that omits it.
 */
@Component({
  imports: [MlvTokenizer],
  template: `<mlv-tokenizer
    label="Frameworks"
    [(tokens)]="tokens"
    [maxVisible]="maxVisible()"
  />`,
})
class OverflowHost {
  readonly maxVisible = signal<number | null>(1);
  readonly tokens = signal<MlvSelectOption<string>[]>([
    { label: 'React', value: 'react' },
    { label: 'Angular', value: 'angular' },
    { label: 'Vue', value: 'vue' },
  ]);
}

describe('MlvTokenizer — overflow counter i18n (#370)', () => {
  let fixture: ComponentFixture<OverflowHost>;

  async function render(providers: unknown[], pack?: MlvLanguage) {
    await TestBed.configureTestingModule({
      imports: [OverflowHost],
      providers: providers as never[],
    }).compileComponents();
    if (pack) TestBed.inject(MlvI18nService).setLanguage(pack);
    fixture = TestBed.createComponent(OverflowHost);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function withPack(pack: MlvLanguage): Promise<void> {
    await render([provideMlvI18n(async () => ({ default: pack }))], pack);
  }

  function overflowText(): string | null {
    const el = (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-tokenizer__overflow',
    );
    return el ? (el.textContent ?? '').replace(/\s+/g, ' ').trim() : null;
  }

  it('keeps the English counter byte-identical under the testing pack', async () => {
    await render([provideMlvI18nTesting()]);
    expect(overflowText()).toBe('+2 more');

    fixture.componentInstance.maxVisible.set(2);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overflowText()).toBe('+1 more');
  });

  it('reads the counter from the active language pack', async () => {
    await withPack(deLanguage);
    expect(overflowText()).toBe('+2 weitere');
  });

  it("inflects by the pack locale's plural category (it: one / other)", async () => {
    await withPack(itLanguage);
    expect(overflowText()).toBe('+2 altri');

    fixture.componentInstance.maxVisible.set(2);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overflowText()).toBe('+1 altro');
  });

  it('falls back to English for a hand-written pack without the key', async () => {
    const { moreItems: _omitted, ...tokenizerWithoutKey } =
      enLanguage.tokenizer as MlvLanguage['tokenizer'] & {
        moreItems?: string;
      };
    await withPack({ ...enLanguage, tokenizer: tokenizerWithoutKey });
    expect(overflowText()).toBe('+2 more');
  });

  it('renders no counter while every token is visible', async () => {
    await withPack(deLanguage);
    fixture.componentInstance.maxVisible.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overflowText()).toBeNull();
  });
});
