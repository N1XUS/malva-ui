import { vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvDateRangePickerValue } from './date-range-picker';
import { MlvDateRangePicker } from './date-range-picker';

/**
 * #301: `clearable` rendered the wrapper's X on `mlv-date-range-picker`, but
 * nothing listened to its `clear` output — the picker had `clearSelection()`
 * and a `hasClearableValue` flag, and neither was wired to it. A focusable
 * "Clear" button that did nothing, on readonly and disabled pickers alike.
 */
describe('MlvDateRangePicker — clearable (#301)', () => {
  let fixture: ComponentFixture<MlvDateRangePicker>;
  const range: MlvDateRangePickerValue = {
    start: new Date(2026, 0, 10),
    end: new Date(2026, 0, 15),
  };

  async function render(
    state: 'writable' | 'readonly' | 'disabled',
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MlvDateRangePicker],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MlvDateRangePicker);
    fixture.componentRef.setInput('label', 'Stay dates');
    fixture.componentRef.setInput('clearable', true);
    fixture.componentRef.setInput('value', range);
    fixture.componentRef.setInput('readonly', state === 'readonly');
    fixture.componentRef.setInput('disabled', state === 'disabled');
    await fixture.whenStable();
  }

  const clearButton = (): HTMLButtonElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-form-control-wrapper__clear button',
    );

  it('clears the range and marks the field touched from the clear button', async () => {
    await render('writable');
    expect(clearButton()).not.toBeNull();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    const touched = vi.fn();
    fixture.componentInstance.touch.subscribe(touched);

    clearButton()?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBeNull();
    expect(touched).toHaveBeenCalledTimes(1);
    expect(clearButton()).toBeNull();
  });

  it.each(['readonly', 'disabled'] as const)(
    'renders no clear button while %s, and hasClearableValue agrees',
    async (state) => {
      await render(state);

      expect(clearButton()).toBeNull();
      expect(fixture.componentInstance.hasClearableValue()).toBe(false);
      expect(fixture.componentInstance.value()).toBe(range);

      await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    },
  );

  it('reports hasClearableValue while writable, clearable and set', async () => {
    await render('writable');

    expect(fixture.componentInstance.hasClearableValue()).toBe(true);
    expect(clearButton()).not.toBeNull();
  });

  it.each(['readonly', 'disabled'] as const)(
    'refuses a clear that lands after the picker turned %s',
    async (state) => {
      await render('writable');
      const stale = clearButton();
      expect(stale).not.toBeNull();

      fixture.componentRef.setInput(state, true);
      stale?.click();

      expect(fixture.componentInstance.value()).toBe(range);
    },
  );
});
