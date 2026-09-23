import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvNumberInput } from './number-input';

/**
 * #301: #298 routed every stepper, key, wheel and draft commit through
 * `_write`, but left the wrapper's clear X alone — it rendered on a readonly
 * or disabled field and its `(clear)` binding called `clearValue()`, which
 * wrote unconditionally.
 */
describe('MlvNumberInput — wrapper clear button write permission (#301)', () => {
  let fixture: ComponentFixture<MlvNumberInput>;

  async function render(
    state: 'writable' | 'readonly' | 'disabled',
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MlvNumberInput],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MlvNumberInput);
    fixture.componentRef.setInput('label', 'Quantity');
    fixture.componentRef.setInput('clearable', true);
    fixture.componentRef.setInput('value', 5);
    fixture.componentRef.setInput('readonly', state === 'readonly');
    fixture.componentRef.setInput('disabled', state === 'disabled');
    await fixture.whenStable();
  }

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const clearButton = (): HTMLButtonElement | null =>
    root().querySelector('.mlv-form-control-wrapper__clear button');

  const native = (): HTMLInputElement =>
    root().querySelector('.mlv-number-input__native') as HTMLInputElement;

  it('clears the value and the displayed text while writable', async () => {
    await render('writable');
    expect(native().value).toBe('5');
    expect(clearButton()).not.toBeNull();
    await expectNoAxeViolations(root());

    clearButton()?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBeNull();
    expect(native().value).toBe('');
    expect(clearButton()).toBeNull();
  });

  it.each(['readonly', 'disabled'] as const)(
    'renders no clear button while %s',
    async (state) => {
      await render(state);

      expect(clearButton()).toBeNull();
      expect(fixture.componentInstance.value()).toBe(5);

      await expectNoAxeViolations(root());
    },
  );

  it.each(['readonly', 'disabled'] as const)(
    'refuses a clear that lands after the control turned %s',
    async (state) => {
      await render('writable');
      const stale = clearButton();
      expect(stale).not.toBeNull();

      fixture.componentRef.setInput(state, true);
      stale?.click();
      await fixture.whenStable();

      expect(fixture.componentInstance.value()).toBe(5);
      expect(native().value).toBe('5');
    },
  );

  it('keeps clearValue() an application API: it clears a readonly field', async () => {
    await render('readonly');

    fixture.componentInstance.clearValue();

    expect(fixture.componentInstance.value()).toBeNull();
  });
});
