import { vi } from 'vitest';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { form, FormField, readonly } from '@angular/forms/signals';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvNumberInput } from './number-input';

/**
 * #298: `readonly` blocked typing only — the native `readOnly` — while the
 * steppers, the arrow / Home / End keys and the wheel all wrote through
 * component code that checked nothing but `computedDisabled()`.
 */
@Component({
  template: `
    <mlv-number-input
      label="Quantity"
      [min]="0"
      [max]="10"
      [readonly]="ro()"
      [disabled]="dis()"
      [(value)]="value"
    />
  `,
  imports: [MlvNumberInput],
})
class Host {
  readonly ro = signal(false);
  readonly dis = signal(false);
  readonly value = signal<number | null>(5);
  readonly control = viewChild.required(MlvNumberInput);
}

type Mode = 'readonly' | 'disabled';

/** Mirrors the component's private `LONG_PRESS_DELAY` / `LONG_PRESS_INTERVAL`. */
const LONG_PRESS_DELAY_MS = 400;
const LONG_PRESS_INTERVAL_MS = 150;

async function create(mode: Mode | null): Promise<ComponentFixture<Host>> {
  await TestBed.configureTestingModule({
    imports: [Host],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  if (mode === 'readonly') fixture.componentInstance.ro.set(true);
  if (mode === 'disabled') fixture.componentInstance.dis.set(true);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function native(fixture: ComponentFixture<Host>): HTMLInputElement {
  return fixture.nativeElement.querySelector('.mlv-number-input__native');
}

function stepper(
  fixture: ComponentFixture<Host>,
  which: 'increment' | 'decrement',
): HTMLButtonElement {
  return fixture.nativeElement.querySelector(`.mlv-number-input__${which}`);
}

function pointer(el: Element, type: string): void {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
}

function key(
  fixture: ComponentFixture<Host>,
  k: string,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: k,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  native(fixture).dispatchEvent(event);
  return event;
}

describe('MlvNumberInput — write permission (#298)', () => {
  describe.each(['readonly', 'disabled'] as const)('while %s', (mode) => {
    let fixture: ComponentFixture<Host>;

    beforeEach(async () => {
      fixture = await create(mode);
    });

    afterEach(() => {
      pointer(stepper(fixture, 'increment'), 'pointerup');
      pointer(stepper(fixture, 'decrement'), 'pointerup');
    });

    it('disables both steppers', () => {
      expect(stepper(fixture, 'increment').disabled).toBe(true);
      expect(stepper(fixture, 'decrement').disabled).toBe(true);
    });

    it.each(['increment', 'decrement'] as const)(
      'a %s stepper press does not change the value',
      async (which) => {
        pointer(stepper(fixture, which), 'pointerdown');
        fixture.detectChanges();
        await fixture.whenStable();

        expect(fixture.componentInstance.value()).toBe(5);
        expect(native(fixture).value).toBe('5');
      },
    );

    it.each([
      ['ArrowUp', {}],
      ['ArrowDown', {}],
      ['ArrowUp', { shiftKey: true }],
      ['Home', {}],
      ['End', {}],
    ] as const)('%s %o does not change the value', async (k, init) => {
      const event = key(fixture, k, init);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.value()).toBe(5);
      // Left alone, so a readonly field keeps the native caret behaviour.
      expect(event.defaultPrevented).toBe(false);
    });

    it('a wheel gesture over the focused field does not change the value', async () => {
      fixture.componentInstance.control()['_isFocused'].set(true);
      const event = new WheelEvent('wheel', {
        deltaY: -100,
        bubbles: true,
        cancelable: true,
      });
      native(fixture).dispatchEvent(event);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.value()).toBe(5);
      // The page keeps scrolling.
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('readonly markup', () => {
    it('keeps the native readonly attribute and adds no redundant aria-readonly', async () => {
      const fixture = await create('readonly');
      // HTML-AAM maps the native attribute to the readonly state; ARIA in HTML:
      // "Authors SHOULD NOT use aria-readonly=true on any element which also
      // has a readonly attribute."
      expect(native(fixture).hasAttribute('readonly')).toBe(true);
      expect(native(fixture).hasAttribute('aria-readonly')).toBe(false);
    });

    it('leaves the steppers enabled once readonly is lifted', async () => {
      const fixture = await create('readonly');
      fixture.componentInstance.ro.set(false);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(stepper(fixture, 'increment').disabled).toBe(false);
      pointer(stepper(fixture, 'increment'), 'pointerdown');
      pointer(stepper(fixture, 'increment'), 'pointerup');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.componentInstance.value()).toBe(6);
    });
  });

  describe.each(['readonly', 'disabled'] as const)(
    'a long press that loses permission to %s',
    (mode) => {
      let fixture: ComponentFixture<Host>;

      beforeEach(async () => {
        fixture = await create(null);
        vi.useFakeTimers();
      });

      afterEach(() => {
        pointer(stepper(fixture, 'increment'), 'pointerup');
        vi.useRealTimers();
      });

      it('steps no further, and its interval is cleared', () => {
        const flip = (on: boolean): void => {
          const host = fixture.componentInstance;
          (mode === 'readonly' ? host.ro : host.dis).set(on);
          fixture.detectChanges();
        };

        pointer(stepper(fixture, 'increment'), 'pointerdown');
        expect(fixture.componentInstance.value()).toBe(6);
        // Past the long-press delay and one repeat interval.
        vi.advanceTimersByTime(LONG_PRESS_DELAY_MS + LONG_PRESS_INTERVAL_MS);
        expect(fixture.componentInstance.value()).toBe(7);

        // No `pointerup`: a stepper that turns `disabled` under the pointer
        // may never receive one.
        flip(true);
        vi.advanceTimersByTime(1000);
        expect(fixture.componentInstance.value()).toBe(7);

        // Lifting it again resumes nothing, so the interval really was
        // cleared rather than merely refused on every tick.
        flip(false);
        vi.advanceTimersByTime(1000);
        expect(fixture.componentInstance.value()).toBe(7);
      });
    },
  );

  it('a typed draft committed after readonly flips on is discarded, not written', async () => {
    const fixture = await create(null);
    const input = native(fixture);
    input.value = '9';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    fixture.componentInstance.ro.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    input.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe(5);
    expect(input.value).toBe('5');
  });

  it('a signal-forms readonly() rule blocks the stepper', async () => {
    @Component({
      template: `<mlv-number-input [formField]="f.qty" />`,
      imports: [MlvNumberInput, FormField],
    })
    class SignalHost {
      readonly model = signal({ qty: 5 });
      readonly f = form(this.model, (path) => {
        readonly(path.qty);
      });
    }

    await TestBed.configureTestingModule({
      imports: [SignalHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const increment = fixture.nativeElement.querySelector(
      '.mlv-number-input__increment',
    ) as HTMLButtonElement;
    pointer(increment, 'pointerdown');
    pointer(increment, 'pointerup');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.f.qty().readonly()).toBe(true);
    expect(fixture.componentInstance.f.qty().value()).toBe(5);
  });

  it('a disabled reactive FormControl blocks the arrow keys', async () => {
    @Component({
      template: `<mlv-number-input [formControl]="ctrl" />`,
      imports: [MlvNumberInput, ReactiveFormsModule],
    })
    class ReactiveHost {
      readonly ctrl = new FormControl<number | null>(5);
    }

    await TestBed.configureTestingModule({
      imports: [ReactiveHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.ctrl.disable();
    fixture.detectChanges();
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector(
      '.mlv-number-input__native',
    ) as HTMLInputElement;
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.ctrl.value).toBe(5);
  });

  describe('axe', () => {
    it.each([null, 'readonly', 'disabled'] as const)(
      'has no violations (%s)',
      async (mode) => {
        const fixture = await create(mode);
        await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
      },
    );

    it('has no violations in the error state with a description and message', async () => {
      @Component({
        template: `
          <mlv-number-input
            label="Quantity"
            state="error"
            description="Whole units only."
            message="Too many"
            [value]="5"
          />
        `,
        imports: [MlvNumberInput],
      })
      class ErrorHost {}

      await TestBed.configureTestingModule({
        imports: [ErrorHost],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();
      const fixture = TestBed.createComponent(ErrorHost);
      fixture.detectChanges();
      await fixture.whenStable();
      await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    });
  });
});
