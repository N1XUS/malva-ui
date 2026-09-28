import { Component, Injectable, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MlvNativeDateAdapter,
  provideMlvDateAdapter,
} from '@malva-ui/core/date';
import { MLV_TIME_PICKER_I18N, type MlvTimePickerI18n } from '@malva-ui/i18n';
import { enLanguage } from '@malva-ui/i18n/en';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTimePicker } from './time-picker';

/**
 * An empty value renders as empty (#348, owner ruling D4 option (c)).
 *
 * Before, `_applyValue('')` seeded the drums from `new Date()`: the trigger of
 * an empty picker read as a committed time the user never chose, the open
 * drums marked that time `aria-selected`, and the first pick in any one column
 * committed the rest of the wall clock with it. Now the trigger renders the
 * placeholder, the drums hold no selection and the model stays `''`; the clock
 * is read only behind the opt-in `defaultToNow`, and only through the date
 * adapter's `now()`, never `new Date()`.
 *
 * Every spec pins the system clock to 14:37:52 through a fake `Date` (the
 * clock only, no timers), so a picker still reading `new Date()` shows up as
 * `14:37` / `14:30` instead of passing by coincidence.
 */

/** The wall clock every spec runs under. */
const SYSTEM_NOW = new Date(2026, 8, 27, 14, 37, 52);

/** The clock the stub adapter reports — distinct from {@link SYSTEM_NOW}. */
let adapterNow = new Date(2026, 8, 27, 9, 41, 17);

/** A native adapter whose `now()` is the spec's, not the system's. */
@Injectable()
class StubClockAdapter extends MlvNativeDateAdapter {
  override now(): Date {
    return new Date(adapterNow.getTime());
  }
}

@Component({
  imports: [MlvTimePicker],
  template: `
    <mlv-time-picker
      label="Start"
      [(value)]="value"
      [mode]="mode()"
      [showSeconds]="showSeconds()"
      [placeholder]="placeholder()"
      [defaultToNow]="defaultToNow()"
    />
  `,
})
class HostComponent {
  readonly value = signal<string>('');
  readonly mode = signal<'24h' | '12h'>('24h');
  readonly showSeconds = signal(false);
  readonly placeholder = signal<string | undefined>(undefined);
  readonly defaultToNow = signal(false);
}

interface Harness {
  fixture: ComponentFixture<HostComponent>;
  host: HostComponent;
  picker: MlvTimePicker;
  el: HTMLElement;
  overlay: HTMLElement;
}

async function make(
  setup: (host: HostComponent) => void = () => undefined,
): Promise<Harness> {
  const fixture = TestBed.createComponent(HostComponent);
  const host = fixture.componentInstance;
  setup(host);
  fixture.detectChanges();
  await fixture.whenStable();
  return {
    fixture,
    host,
    picker: fixture.debugElement.query(By.directive(MlvTimePicker))
      .componentInstance as MlvTimePicker,
    el: fixture.nativeElement as HTMLElement,
    overlay: TestBed.inject(OverlayContainer).getContainerElement(),
  };
}

function trigger(h: Harness): HTMLElement {
  return h.el.querySelector('.mlv-time-picker__trigger') as HTMLElement;
}

async function open(h: Harness): Promise<void> {
  trigger(h).click();
  h.fixture.detectChanges();
  await h.fixture.whenStable();
}

async function close(h: Harness): Promise<void> {
  h.picker.isOpen.set(false);
  h.fixture.detectChanges();
  await h.fixture.whenStable();
}

function listboxes(h: Harness): HTMLElement[] {
  return Array.from(
    h.overlay.querySelectorAll<HTMLElement>(
      '.mlv-time-picker__panel [role="listbox"]',
    ),
  );
}

/** The selected option's text per drum, `null` where none is selected. */
function selectedTexts(h: Harness): (string | null)[] {
  return listboxes(h).map(
    (lb) =>
      lb.querySelector('[aria-selected="true"]')?.textContent?.trim() ?? null,
  );
}

/** `aria-pressed` of the AM and PM buttons, in that order. */
function periodPressed(h: Harness): (string | null)[] {
  return Array.from(
    h.overlay.querySelectorAll<HTMLElement>('.mlv-time-picker__ampm button'),
  ).map((button) => button.getAttribute('aria-pressed'));
}

async function press(h: Harness, lb: HTMLElement, key: string): Promise<void> {
  lb.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  h.fixture.detectChanges();
  await h.fixture.whenStable();
}

describe('MlvTimePicker — empty value (#348)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(SYSTEM_NOW);
    adapterNow = new Date(2026, 8, 27, 9, 41, 17);
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('trigger', () => {
    it('renders the placeholder, not a time, for an empty value', async () => {
      const h = await make();
      const text = trigger(h).textContent ?? '';
      expect(text).not.toMatch(/\d\d:\d\d/);
      expect(
        trigger(h).querySelector('.mlv-time-picker__value')?.textContent ?? '',
      ).not.toMatch(/\d\d:\d\d/);
      expect(
        trigger(h)
          .querySelector('.mlv-time-picker__placeholder')
          ?.textContent?.trim(),
      ).toBe('Select time...');
      expect(h.picker.hasValue()).toBe(false);
    });

    it('renders the placeholder for a null value written by a non-strict form', async () => {
      const h = await make((host) => host.value.set(null as unknown as string));
      expect(trigger(h).textContent ?? '').not.toMatch(/\d\d:\d\d/);
      expect(
        trigger(h)
          .querySelector('.mlv-time-picker__placeholder')
          ?.textContent?.trim(),
      ).toBe('Select time...');
      expect(h.picker.hasValue()).toBe(false);
    });

    it('renders a consumer placeholder over the i18n default', async () => {
      const h = await make((host) => host.placeholder.set('Pick a slot'));
      expect(
        trigger(h)
          .querySelector('.mlv-time-picker__placeholder')
          ?.textContent?.trim(),
      ).toBe('Pick a slot');
    });

    it("falls back to the English pack's placeholder for a pack without the key", async () => {
      const handWritten: MlvTimePickerI18n = {
        period: 'Period',
        timePicker: 'Time picker',
      };
      TestBed.configureTestingModule({
        providers: [
          { provide: MLV_TIME_PICKER_I18N, useValue: signal(handWritten) },
        ],
      });
      const h = await make();
      // The fallback is the English pack's string, so the two cannot drift.
      expect(enLanguage.timePicker.placeholder).toBe('Select time...');
      expect(
        trigger(h)
          .querySelector('.mlv-time-picker__placeholder')
          ?.textContent?.trim(),
      ).toBe(enLanguage.timePicker.placeholder);
    });

    it('renders the time and no placeholder once a value is set', async () => {
      const h = await make((host) => host.value.set('08:05'));
      expect(
        trigger(h)
          .querySelector('.mlv-time-picker__value')
          ?.textContent?.trim(),
      ).toBe('08:05');
      expect(trigger(h).querySelector('.mlv-time-picker__placeholder')).toBe(
        null,
      );
      expect(h.picker.hasValue()).toBe(true);
    });

    it('returns to the placeholder when the value is cleared', async () => {
      const h = await make((host) => host.value.set('08:05'));
      h.host.value.set('');
      h.fixture.detectChanges();
      await h.fixture.whenStable();
      expect(trigger(h).textContent ?? '').not.toMatch(/\d\d:\d\d/);
      expect(
        trigger(h)
          .querySelector('.mlv-time-picker__placeholder')
          ?.textContent?.trim(),
      ).toBe('Select time...');
    });
  });

  describe('drums', () => {
    it('opens with no selection in any drum and leaves the model empty', async () => {
      const h = await make((host) => host.showSeconds.set(true));
      await open(h);
      expect(listboxes(h)).toHaveLength(3);
      expect(selectedTexts(h)).toEqual([null, null, null]);
      expect(
        h.overlay.querySelectorAll('.mlv-scrubber__item--selected'),
      ).toHaveLength(0);
      expect(h.host.value()).toBe('');
      expect(trigger(h).textContent ?? '').not.toMatch(/\d\d:\d\d/);
    });

    it('presses neither AM nor PM for an empty 12h value', async () => {
      const h = await make((host) => host.mode.set('12h'));
      await open(h);
      expect(periodPressed(h)).toEqual(['false', 'false']);
      expect(selectedTexts(h)).toEqual([null, null]);
    });

    it('commits the resting time of the other drums with the first pick', async () => {
      const h = await make();
      await open(h);
      const minutes = listboxes(h)[1];
      const option =
        minutes.querySelectorAll<HTMLElement>('[role="option"]')[30];
      option.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      h.fixture.detectChanges();
      await h.fixture.whenStable();
      // The hour drum rests on its first item, 00 — not the wall clock's 14.
      expect(h.host.value()).toBe('00:30');
      expect(selectedTexts(h)).toEqual(['00', '30']);
    });

    it('commits 01 as the resting hour of an empty 12h drum', async () => {
      const h = await make((host) => host.mode.set('12h'));
      await open(h);
      const minutes = listboxes(h)[1];
      // Arrow keys select once the drum has focus, as they do for a user who
      // arrowed across to it.
      minutes.focus();
      await h.fixture.whenStable();
      expect(h.host.value()).toBe('');
      await press(h, minutes, 'ArrowDown');
      // The 12h hour drum runs 01…12, so its first item is 01 AM.
      expect(h.host.value()).toBe('01:01');
      expect(periodPressed(h)).toEqual(['true', 'false']);
    });

    it('commits the resting time when the period is chosen first', async () => {
      const h = await make((host) => host.mode.set('12h'));
      await open(h);
      const pm = h.overlay.querySelectorAll<HTMLElement>(
        '.mlv-time-picker__ampm button',
      )[1];
      pm.click();
      h.fixture.detectChanges();
      await h.fixture.whenStable();
      expect(h.host.value()).toBe('13:00');
    });

    it('commits nothing while focus moves across the empty drums', async () => {
      const h = await make((host) => host.showSeconds.set(true));
      await open(h);
      const columns = h.overlay.querySelector(
        '.mlv-time-picker__columns',
      ) as HTMLElement;
      for (const expected of [1, 2]) {
        columns.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
        );
        h.fixture.detectChanges();
        await h.fixture.whenStable();
        expect(document.activeElement).toBe(listboxes(h)[expected]);
      }
      expect(h.host.value()).toBe('');
      expect(selectedTexts(h)).toEqual([null, null, null]);
    });

    it('commits the first item when Home is pressed on an empty drum', async () => {
      const h = await make();
      await open(h);
      await press(h, listboxes(h)[0], 'Home');
      expect(h.host.value()).toBe('00:00');
    });

    it('empties the drums again when the value is cleared', async () => {
      const h = await make((host) => host.value.set('10:30'));
      await open(h);
      expect(selectedTexts(h)).toEqual(['10', '30']);
      h.host.value.set('');
      h.fixture.detectChanges();
      await h.fixture.whenStable();
      expect(selectedTexts(h)).toEqual([null, null]);
      expect(h.host.value()).toBe('');
    });
  });

  describe('defaultToNow', () => {
    it('seeds the drums from the date adapter on open, not from new Date()', async () => {
      TestBed.configureTestingModule({
        providers: [provideMlvDateAdapter(StubClockAdapter)],
      });
      const h = await make((host) => host.defaultToNow.set(true));
      await open(h);
      // 09:41 is the adapter's clock; the system clock reads 14:37.
      expect(selectedTexts(h)).toEqual(['09', '41']);
    });

    it('seeds without committing: the model and the trigger stay empty', async () => {
      TestBed.configureTestingModule({
        providers: [provideMlvDateAdapter(StubClockAdapter)],
      });
      const h = await make((host) => host.defaultToNow.set(true));
      await open(h);
      expect(selectedTexts(h)).toEqual(['09', '41']);
      expect(h.host.value()).toBe('');
      expect(h.picker.hasValue()).toBe(false);
      expect(
        trigger(h)
          .querySelector('.mlv-time-picker__placeholder')
          ?.textContent?.trim(),
      ).toBe('Select time...');
    });

    it('commits from the seed on the first change', async () => {
      TestBed.configureTestingModule({
        providers: [provideMlvDateAdapter(StubClockAdapter)],
      });
      const h = await make((host) => host.defaultToNow.set(true));
      await open(h);
      await press(h, listboxes(h)[1], 'ArrowDown');
      expect(h.host.value()).toBe('09:42');
    });

    it('seeds seconds as 00, since the adapter reads no seconds', async () => {
      TestBed.configureTestingModule({
        providers: [provideMlvDateAdapter(StubClockAdapter)],
      });
      const h = await make((host) => {
        host.defaultToNow.set(true);
        host.showSeconds.set(true);
      });
      await open(h);
      expect(selectedTexts(h)).toEqual(['09', '41', '00']);
    });

    it('seeds the 12h hour and period', async () => {
      adapterNow = new Date(2026, 8, 27, 21, 5, 0);
      TestBed.configureTestingModule({
        providers: [provideMlvDateAdapter(StubClockAdapter)],
      });
      const h = await make((host) => {
        host.defaultToNow.set(true);
        host.mode.set('12h');
      });
      await open(h);
      expect(selectedTexts(h)).toEqual(['09', '05']);
      expect(periodPressed(h)).toEqual(['false', 'true']);
      expect(h.host.value()).toBe('');
    });

    it('re-seeds on every open', async () => {
      TestBed.configureTestingModule({
        providers: [provideMlvDateAdapter(StubClockAdapter)],
      });
      const h = await make((host) => host.defaultToNow.set(true));
      await open(h);
      expect(selectedTexts(h)).toEqual(['09', '41']);
      await close(h);
      adapterNow = new Date(2026, 8, 27, 11, 2, 0);
      await open(h);
      expect(selectedTexts(h)).toEqual(['11', '02']);
      expect(h.host.value()).toBe('');
    });

    it('leaves a held value alone', async () => {
      TestBed.configureTestingModule({
        providers: [provideMlvDateAdapter(StubClockAdapter)],
      });
      const h = await make((host) => {
        host.defaultToNow.set(true);
        host.value.set('18:15');
      });
      await open(h);
      expect(selectedTexts(h)).toEqual(['18', '15']);
      expect(h.host.value()).toBe('18:15');
    });

    it('seeds nothing while off', async () => {
      TestBed.configureTestingModule({
        providers: [provideMlvDateAdapter(StubClockAdapter)],
      });
      const h = await make();
      await open(h);
      expect(selectedTexts(h)).toEqual([null, null]);
    });
  });
});
