import { vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvDayPicker } from './day-picker';

/**
 * #301: `clearable` is an inherited base input, so the wrapper rendered its X
 * on `mlv-day-picker` — but nothing listened to its `clear` output. A focusable
 * "Clear" button that did nothing, and it rendered on readonly and disabled
 * pickers alike.
 */
describe('MlvDayPicker — clearable (#301)', () => {
  let fixture: ComponentFixture<MlvDayPicker>;
  const date = new Date(2026, 0, 15);

  async function render(
    state: 'writable' | 'readonly' | 'disabled',
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MlvDayPicker],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MlvDayPicker);
    fixture.componentRef.setInput('label', 'Due date');
    fixture.componentRef.setInput('clearable', true);
    fixture.componentRef.setInput('value', date);
    fixture.componentRef.setInput('readonly', state === 'readonly');
    fixture.componentRef.setInput('disabled', state === 'disabled');
    await fixture.whenStable();
  }

  const clearButton = (): HTMLButtonElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-form-control-wrapper__clear button',
    );

  it('clears the date and marks the field touched from the clear button', async () => {
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

  it('renders no clear button while empty', async () => {
    await render('writable');
    fixture.componentRef.setInput('value', null);
    await fixture.whenStable();

    expect(clearButton()).toBeNull();
  });

  it.each(['readonly', 'disabled'] as const)(
    'renders no clear button while %s',
    async (state) => {
      await render(state);

      expect(clearButton()).toBeNull();
      expect(fixture.componentInstance.value()).toBe(date);

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

      expect(fixture.componentInstance.value()).toBe(date);
    },
  );
});
