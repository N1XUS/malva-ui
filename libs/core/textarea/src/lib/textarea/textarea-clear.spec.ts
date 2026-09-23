import { vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvTextarea } from './textarea';

/**
 * #301: the wrapper's clear X rendered on a readonly or disabled
 * `mlv-textarea`, and its `(clear)` binding called `clearValue()`, which wrote
 * unconditionally — a click emptied a readonly field and Tab + Enter emptied a
 * disabled one.
 */
describe('MlvTextarea — wrapper clear button write permission (#301)', () => {
  let fixture: ComponentFixture<MlvTextarea>;

  async function render(
    state: 'writable' | 'readonly' | 'disabled',
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MlvTextarea],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MlvTextarea);
    fixture.componentRef.setInput('label', 'Bio');
    fixture.componentRef.setInput('clearable', true);
    fixture.componentRef.setInput('value', 'Hello');
    fixture.componentRef.setInput('readonly', state === 'readonly');
    fixture.componentRef.setInput('disabled', state === 'disabled');
    await fixture.whenStable();
  }

  const clearButton = (): HTMLButtonElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-form-control-wrapper__clear button',
    );

  it('clears the value and marks the field touched while writable', async () => {
    await render('writable');
    expect(clearButton()).not.toBeNull();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    const touched = vi.fn();
    fixture.componentInstance.touch.subscribe(touched);

    clearButton()?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('');
    expect(touched).toHaveBeenCalledTimes(1);
    expect(clearButton()).toBeNull();
  });

  it.each(['readonly', 'disabled'] as const)(
    'renders no clear button while %s',
    async (state) => {
      await render(state);

      expect(clearButton()).toBeNull();
      expect(fixture.componentInstance.value()).toBe('Hello');

      await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    },
  );

  it.each(['readonly', 'disabled'] as const)(
    'refuses a clear that lands after the control turned %s, without touching',
    async (state) => {
      await render('writable');
      const touched = vi.fn();
      fixture.componentInstance.touch.subscribe(touched);
      const stale = clearButton();
      expect(stale).not.toBeNull();

      fixture.componentRef.setInput(state, true);
      stale?.click();

      expect(fixture.componentInstance.value()).toBe('Hello');
      expect(touched).not.toHaveBeenCalled();
    },
  );

  it('keeps clearValue() an application API: it clears a readonly textarea', async () => {
    await render('readonly');

    fixture.componentInstance.clearValue();

    expect(fixture.componentInstance.value()).toBe('');
  });
});
