import { vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvTimePicker } from './time-picker';

/**
 * #301: `clearable` rendered the wrapper's X on `mlv-time-picker`, nothing
 * listened to its `clear` output, and `hasValue` was a constant `true` — so the
 * dead X showed even on an empty picker, and on readonly and disabled ones.
 */
describe('MlvTimePicker — clearable (#301)', () => {
  let fixture: ComponentFixture<MlvTimePicker>;

  async function render(
    state: 'writable' | 'readonly' | 'disabled',
    value = '09:30',
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MlvTimePicker],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MlvTimePicker);
    fixture.componentRef.setInput('label', 'Start');
    fixture.componentRef.setInput('clearable', true);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('readonly', state === 'readonly');
    fixture.componentRef.setInput('disabled', state === 'disabled');
    await fixture.whenStable();
  }

  const clearButton = (): HTMLButtonElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-form-control-wrapper__clear button',
    );

  it('clears the time and marks the field touched from the clear button', async () => {
    await render('writable');
    expect(clearButton()).not.toBeNull();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    const touched = vi.fn();
    fixture.componentInstance.touch.subscribe(touched);

    clearButton()?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('');
    expect(fixture.componentInstance.hasValue()).toBe(false);
    expect(touched).toHaveBeenCalledTimes(1);
    expect(clearButton()).toBeNull();
  });

  it('reports no value and renders no clear button while empty', async () => {
    await render('writable', '');

    expect(fixture.componentInstance.hasValue()).toBe(false);
    expect(clearButton()).toBeNull();
  });

  it.each(['readonly', 'disabled'] as const)(
    'renders no clear button while %s',
    async (state) => {
      await render(state);

      expect(clearButton()).toBeNull();
      expect(fixture.componentInstance.value()).toBe('09:30');

      await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    },
  );

  it.each(['readonly', 'disabled'] as const)(
    'refuses a clear that lands after the picker turned %s',
    async (state) => {
      await render('writable');
      const stale = clearButton();
      expect(stale).not.toBeNull();

      fixture.componentRef.setInput(state, true);
      stale?.click();

      expect(fixture.componentInstance.value()).toBe('09:30');
    },
  );
});
