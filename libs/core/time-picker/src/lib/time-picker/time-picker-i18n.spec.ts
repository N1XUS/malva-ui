import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import {
  Component,
  Injectable,
  signal,
  type WritableSignal,
} from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MLV_DATE_ADAPTER, MlvNativeDateAdapter } from '@malva-ui/core/date';
import type { MlvLanguage } from '@malva-ui/i18n';
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { deLanguage } from '@malva-ui/i18n/de';
import { enLanguage } from '@malva-ui/i18n/en';
import { jaLanguage } from '@malva-ui/i18n/ja';
import { ukLanguage } from '@malva-ui/i18n/uk';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvBreakpointService, type MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvTimePicker } from './time-picker';

@Component({
  imports: [MlvTimePicker],
  template: `<mlv-time-picker
    label="Meeting time"
    mode="12h"
    [showSeconds]="showSeconds()"
    [value]="value()"
  />`,
})
class I18nHost {
  readonly value = signal('14:30:15');
  readonly showSeconds = signal(true);
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

/** A consumer adapter supplying its own day-period labels. */
@Injectable()
class CustomPeriodAdapter extends MlvNativeDateAdapter {
  override getDayPeriodNames(): readonly [string, string] {
    return ['morning', 'evening'];
  }
}

/**
 * #370: the drum columns were named with the English literals "Hours" /
 * "Minutes" / "Seconds" (the `mlv-scrubber` label is its listbox's accessible
 * name), and the 12h pair rendered "AM" / "PM" in every locale. The names now
 * come from the optional `hours` / `minutes` / `seconds` keys, and the period
 * labels from `MlvDateAdapter.getDayPeriodNames()` — the adapter locale's
 * `Intl` day periods, "AM" / "PM" in English.
 */
describe('MlvTimePicker — column names and day periods i18n (#370)', () => {
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
    fixture.detectChanges();
  }

  async function withPack(
    pack: MlvLanguage,
    extra: (Provider | EnvironmentProviders)[] = [],
  ): Promise<void> {
    await render(
      [provideMlvI18n(async () => ({ default: pack })), ...extra],
      pack,
    );
  }

  async function open(): Promise<void> {
    (
      (fixture.nativeElement as HTMLElement).querySelector(
        '.mlv-time-picker__trigger',
      ) as HTMLElement
    ).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  function columnNames(): string[] {
    return Array.from(
      document.body.querySelectorAll('.mlv-scrubber [role="listbox"]'),
    ).map((el) => el.getAttribute('aria-label') ?? '');
  }

  function periods(): string[] {
    return Array.from(
      document.body.querySelectorAll('.mlv-time-picker__ampm button'),
    ).map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim());
  }

  function triggerText(): string {
    return (
      (fixture.nativeElement as HTMLElement).querySelector(
        '.mlv-time-picker__value',
      )?.textContent ?? ''
    ).trim();
  }

  it('keeps the English names and periods byte-identical', async () => {
    await render([provideMlvI18nTesting()]);
    expect(triggerText()).toBe('02:30:15 PM');
    await open();

    expect(columnNames()).toEqual(['Hours', 'Minutes', 'Seconds']);
    expect(periods()).toEqual(['AM', 'PM']);
  });

  it('keeps English periods under the en pack', async () => {
    await withPack(enLanguage);
    await open();
    expect(columnNames()).toEqual(['Hours', 'Minutes', 'Seconds']);
    expect(periods()).toEqual(['AM', 'PM']);
  });

  it('names the columns from the active pack', async () => {
    await withPack(deLanguage);
    await open();
    expect(columnNames()).toEqual(['Stunden', 'Minuten', 'Sekunden']);
  });

  it("labels the periods in the pack locale's day periods (ja)", async () => {
    await withPack(jaLanguage);
    expect(triggerText()).toBe('02:30:15 午後');
    await open();

    expect(columnNames()).toEqual(['時間', '分', '秒']);
    expect(periods()).toEqual(['午前', '午後']);
  });

  it("labels the periods in the pack locale's day periods (uk)", async () => {
    await withPack(ukLanguage);
    await open();
    expect(columnNames()).toEqual(['Години', 'Хвилини', 'Секунди']);
    expect(periods()).toEqual(['дп', 'пп']);
  });

  it('re-labels the trigger and the open period pair on a live language switch', async () => {
    await withPack(enLanguage);
    fixture.componentInstance.showSeconds.set(false);
    fixture.componentInstance.value.set('14:30');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(triggerText()).toBe('02:30 PM');
    await open();
    expect(periods()).toEqual(['AM', 'PM']);

    // Mounted and open: only the active pack (and so `MLV_LOCALE`) changes.
    TestBed.inject(MlvI18nService).setLanguage(jaLanguage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(triggerText()).toBe('02:30 午後');
    expect(periods()).toEqual(['午前', '午後']);
  });

  it('takes the periods from a consumer MlvDateAdapter', async () => {
    await withPack(enLanguage, [
      { provide: MLV_DATE_ADAPTER, useClass: CustomPeriodAdapter },
    ]);
    expect(triggerText()).toBe('02:30:15 evening');
    await open();
    expect(periods()).toEqual(['morning', 'evening']);
  });

  it('falls back to English names for a hand-written pack without the keys', async () => {
    const {
      hours: _hours,
      minutes: _minutes,
      seconds: _seconds,
      ...withoutKeys
    } = enLanguage.timePicker as MlvLanguage['timePicker'] & {
      hours?: string;
      minutes?: string;
      seconds?: string;
    };
    await withPack({ ...enLanguage, timePicker: withoutKeys });
    await open();
    expect(columnNames()).toEqual(['Hours', 'Minutes', 'Seconds']);
  });
});
