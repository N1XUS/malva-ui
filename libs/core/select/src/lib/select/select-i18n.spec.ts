import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import type { MlvLanguage } from '@malva-ui/i18n';
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { deLanguage } from '@malva-ui/i18n/de';
import { enLanguage } from '@malva-ui/i18n/en';
import { ukLanguage } from '@malva-ui/i18n/uk';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvSelect } from './select';

/**
 * #370: a multi-select trigger summarised its selection as the English
 * `` `${n} items selected` `` in every locale. The summary now resolves the
 * optional `select.itemsSelected` ICU key, with the English string as the
 * fallback for a pack that omits it.
 */
@Component({
  imports: [MlvSelect],
  template: `<mlv-select
    ariaLabel="Fruit"
    [options]="options()"
    [multiple]="true"
  />`,
})
class MultiHost {
  readonly options = signal<string[]>(['Apple', 'Banana', 'Cherry']);
}

describe('MlvSelect — multi-selection summary i18n (#370)', () => {
  let fixture: ComponentFixture<MultiHost>;
  let select: MlvSelect<string>;

  async function render(providers: unknown[], pack?: MlvLanguage) {
    await TestBed.configureTestingModule({
      imports: [MultiHost],
      providers: providers as never[],
    }).compileComponents();
    if (pack) TestBed.inject(MlvI18nService).setLanguage(pack);
    fixture = TestBed.createComponent(MultiHost);
    fixture.detectChanges();
    await fixture.whenStable();
    select = fixture.debugElement.query(By.directive(MlvSelect))
      .componentInstance as MlvSelect<string>;
  }

  async function withPack(pack: MlvLanguage): Promise<void> {
    await render([provideMlvI18n(async () => ({ default: pack }))], pack);
  }

  async function choose(values: string[]): Promise<void> {
    select.value.set(values as never);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function triggerText(): string {
    const value = (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-select__value',
    );
    return (value?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  it('keeps the English summary byte-identical under the testing pack', async () => {
    await render([provideMlvI18nTesting()]);
    await choose(['Apple', 'Cherry']);

    expect(select.displayValue).toBe('2 items selected');
    expect(triggerText()).toBe('2 items selected');
  });

  it('formats a large count without grouping, as the literal did', async () => {
    const many = Array.from({ length: 1234 }, (_, i) => `Option ${i}`);
    await render([provideMlvI18nTesting()]);
    fixture.componentInstance.options.set(many);
    fixture.detectChanges();
    await choose(many);

    expect(select.displayValue).toBe('1234 items selected');
  });

  it('reads the summary from the active language pack', async () => {
    await withPack(deLanguage);
    await choose(['Apple', 'Banana', 'Cherry']);

    expect(select.displayValue).toBe('3 Elemente ausgewählt');
    expect(triggerText()).toBe('3 Elemente ausgewählt');
  });

  it("picks the pack locale's plural category (uk: few / many)", async () => {
    const options = Array.from({ length: 21 }, (_, i) => `Option ${i}`);
    await withPack(ukLanguage);
    fixture.componentInstance.options.set(options);
    fixture.detectChanges();

    await choose(options.slice(0, 2));
    expect(select.displayValue).toBe('Вибрано 2 елементи');

    await choose(options.slice(0, 5));
    expect(select.displayValue).toBe('Вибрано 5 елементів');

    await choose(options.slice(0, 21));
    expect(select.displayValue).toBe('Вибрано 21 елемент');
  });

  it('falls back to English for a hand-written pack without the key', async () => {
    const { itemsSelected: _omitted, ...selectWithoutKey } =
      enLanguage.select as MlvLanguage['select'] & { itemsSelected?: string };
    const custom: MlvLanguage = {
      ...enLanguage,
      select: { ...selectWithoutKey, placeholder: 'Pick…' },
    };
    await withPack(custom);
    await choose(['Apple', 'Banana']);

    expect(select.displayValue).toBe('2 items selected');
  });

  it('honours a consumer override of the key', async () => {
    const custom: MlvLanguage = {
      ...enLanguage,
      select: {
        ...enLanguage.select,
        itemsSelected: '{count, plural, one {# pick} other {# picks}}',
      } as MlvLanguage['select'],
    };
    await withPack(custom);
    await choose(['Apple', 'Banana']);

    expect(select.displayValue).toBe('2 picks');
  });

  it('still shows the single selected label, not the summary', async () => {
    await withPack(deLanguage);
    await choose(['Banana']);

    expect(select.displayValue).toBe('Banana');
  });
});
