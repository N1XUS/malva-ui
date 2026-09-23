import { vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvTokenizer } from './tokenizer';

/**
 * #301: `clearable` rendered the wrapper's X on `mlv-tokenizer`, but nothing
 * listened to its `clear` output — a focusable "Clear" button that did
 * nothing, on readonly and disabled tokenizers alike.
 */
describe('MlvTokenizer — clearable (#301)', () => {
  let fixture: ComponentFixture<MlvTokenizer<string>>;
  const tokens: MlvSelectOption<string>[] = [
    { label: 'alpha', value: 'alpha' },
    { label: 'beta', value: 'beta' },
  ];

  async function render(
    state: 'writable' | 'readonly' | 'disabled',
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MlvTokenizer],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MlvTokenizer<string>);
    fixture.componentRef.setInput('label', 'Tags');
    fixture.componentRef.setInput('clearable', true);
    fixture.componentRef.setInput('value', tokens);
    fixture.componentRef.setInput('readonly', state === 'readonly');
    fixture.componentRef.setInput('disabled', state === 'disabled');
    await fixture.whenStable();
  }

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const clearButton = (): HTMLButtonElement | null =>
    root().querySelector('.mlv-form-control-wrapper__clear button');

  it('removes every token and marks the field touched from the clear button', async () => {
    await render('writable');
    expect(root().querySelectorAll('mlv-token')).toHaveLength(2);
    expect(clearButton()).not.toBeNull();
    await expectNoAxeViolations(root());
    const touched = vi.fn();
    fixture.componentInstance.touch.subscribe(touched);

    clearButton()?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toEqual([]);
    expect(fixture.componentInstance.tokens()).toEqual([]);
    expect(root().querySelectorAll('mlv-token')).toHaveLength(0);
    expect(touched).toHaveBeenCalledTimes(1);
    expect(clearButton()).toBeNull();
  });

  it.each(['readonly', 'disabled'] as const)(
    'renders no clear button while %s',
    async (state) => {
      await render(state);

      expect(clearButton()).toBeNull();
      expect(fixture.componentInstance.value()).toBe(tokens);

      await expectNoAxeViolations(root());
    },
  );

  it.each(['readonly', 'disabled'] as const)(
    'refuses a clear that lands after the tokenizer turned %s',
    async (state) => {
      await render('writable');
      const stale = clearButton();
      expect(stale).not.toBeNull();

      fixture.componentRef.setInput(state, true);
      stale?.click();

      expect(fixture.componentInstance.value()).toBe(tokens);
      expect(fixture.componentInstance.tokens()).toBe(tokens);
    },
  );
});
