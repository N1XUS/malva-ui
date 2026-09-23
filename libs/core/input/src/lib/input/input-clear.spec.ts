import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvInput } from './input';

/**
 * #301: the wrapper's clear X rendered on a readonly or disabled `mlv-input`
 * (its only terms were `clearable() && hasValue()`), and the `(clear)` binding
 * called `clearValue()`, which wrote unconditionally — so a click emptied a
 * readonly field and Tab + Enter emptied a disabled one.
 */
describe('MlvInput — wrapper clear button write permission (#301)', () => {
  let fixture: ComponentFixture<MlvInput>;

  async function render(
    state: 'writable' | 'readonly' | 'disabled',
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MlvInput],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MlvInput);
    fixture.componentRef.setInput('label', 'Name');
    fixture.componentRef.setInput('clearable', true);
    fixture.componentRef.setInput('value', 'Ada');
    fixture.componentRef.setInput('readonly', state === 'readonly');
    fixture.componentRef.setInput('disabled', state === 'disabled');
    await fixture.whenStable();
  }

  const clearButton = (): HTMLButtonElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-form-control-wrapper__clear button',
    );

  it('clears the value from the clear button while writable', async () => {
    await render('writable');
    expect(clearButton()).not.toBeNull();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);

    clearButton()?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('');
    expect(clearButton()).toBeNull();
  });

  it.each(['readonly', 'disabled'] as const)(
    'renders no clear button while %s',
    async (state) => {
      await render(state);

      expect(clearButton()).toBeNull();
      expect(fixture.componentInstance.value()).toBe('Ada');

      await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    },
  );

  it.each(['readonly', 'disabled'] as const)(
    'refuses a clear that lands after the control turned %s',
    async (state) => {
      await render('writable');
      const stale = clearButton();
      expect(stale).not.toBeNull();

      // `setInput` writes the signal input synchronously; the click lands
      // before change detection removes the button — a stale activation.
      fixture.componentRef.setInput(state, true);
      stale?.click();

      expect(fixture.componentInstance.value()).toBe('Ada');
    },
  );

  it('keeps clearValue() an application API: it clears a readonly input', async () => {
    await render('readonly');

    fixture.componentInstance.clearValue();

    expect(fixture.componentInstance.value()).toBe('');
  });
});
