import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { form, FormField, minLength } from '@angular/forms/signals';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvPinInput } from './pin-input';

@Component({
  template: `
    <mlv-pin-input [length]="4" [formField]="otp.code" />
    <button type="button" class="outside">Verify</button>
  `,
  imports: [MlvPinInput, FormField],
})
class OtpHost {
  readonly model = signal({ code: '' });
  readonly otp = form(this.model, (path) => {
    minLength(path.code, 4);
  });
  readonly pin = viewChild.required(MlvPinInput);
}

/**
 * #347 (FC-11, owner decision D22): a control reports touched when focus
 * leaves the control — not when it moves from one cell to the next. Every
 * assertion reads a primitive, so a failure never pretty-prints a component.
 */
describe('MlvPinInput — touched timing (#347)', () => {
  let fixture: ComponentFixture<OtpHost>;
  let host: OtpHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OtpHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(OtpHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function cells(): HTMLInputElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
        '.mlv-pin-input__cell .mlv-input__native',
      ),
    );
  }

  function outside(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '.outside',
    ) as HTMLButtonElement;
  }

  function pinHost(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-pin-input',
    ) as HTMLElement;
  }

  function type(cell: HTMLInputElement, char: string): void {
    cell.value = char;
    cell.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function keydown(cell: HTMLInputElement, key: string): void {
    cell.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
  }

  /** Index of the focused cell — a number, so a failure never prints a node. */
  function focusedCell(): number {
    return cells().findIndex((cell) => cell === document.activeElement);
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('stays untouched, valid-looking and focused while one digit auto-advances to the next cell', async () => {
    cells()[0].focus();
    await settle();
    const setFocused = vi.spyOn(host.pin(), 'setFocused');

    type(cells()[0], '1');
    await settle();

    expect(focusedCell()).toBe(1);
    expect(host.otp.code().value()).toBe('1');
    expect(host.otp.code().touched()).toBe(false);
    expect(host.pin().resolvedState()).toBe('default');
    expect(pinHost().classList.contains('mlv-pin-input--state-error')).toBe(
      false,
    );
    expect(cells()[1].getAttribute('aria-invalid')).not.toBe('true');
    // `focused()` never flickered to false between the two cells.
    expect(setFocused).not.toHaveBeenCalledWith(false);
    expect(host.pin().focused()).toBe(true);
  });

  it('marks the field touched once focus leaves for an element outside the control', async () => {
    cells()[0].focus();
    type(cells()[0], '1');
    await settle();

    outside().focus();
    await settle();

    expect(host.otp.code().touched()).toBe(true);
    expect(host.pin().focused()).toBe(false);
    expect(host.pin().resolvedState()).toBe('error');
    expect(pinHost().classList.contains('mlv-pin-input--state-error')).toBe(
      true,
    );
    expect(cells()[1].getAttribute('aria-invalid')).toBe('true');
  });

  it('does not touch on arrow, Home / End and Backspace navigation between cells', async () => {
    cells()[0].focus();
    await settle();

    keydown(cells()[0], 'ArrowRight');
    keydown(cells()[1], 'End');
    keydown(cells()[3], 'Home');
    keydown(cells()[0], 'ArrowRight');
    keydown(cells()[1], 'Backspace'); // empty cell → moves back to cell 0
    await settle();

    expect(focusedCell()).toBe(0);
    expect(host.otp.code().touched()).toBe(false);
    expect(host.pin().focused()).toBe(true);
  });

  it('does not touch when a paste moves focus to the next empty cell', async () => {
    cells()[0].focus();
    const paste = Object.assign(
      new Event('paste', { bubbles: true, cancelable: true }),
      { clipboardData: { getData: () => '12' } },
    );
    cells()[0].dispatchEvent(paste);
    await settle();

    expect(focusedCell()).toBe(2);
    expect(host.otp.code().touched()).toBe(false);
  });

  it('treats a focusout that names no element — a click on empty space, a window switch — as leaving', async () => {
    cells()[1].focus();
    await settle();

    cells()[1].dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
    );
    await settle();

    expect(host.otp.code().touched()).toBe(true);
    expect(host.pin().focused()).toBe(false);
  });
});
