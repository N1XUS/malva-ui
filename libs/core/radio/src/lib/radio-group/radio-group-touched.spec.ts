import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { MlvRadio } from '../radio/radio';
import { MlvRadioGroup } from './radio-group';

@Component({
  template: `
    <mlv-radio-group label="Shipping method" [formField]="order.shipping">
      <mlv-radio value="standard">Standard</mlv-radio>
      <mlv-radio value="express">Express</mlv-radio>
      <mlv-radio value="pickup">Pickup</mlv-radio>
    </mlv-radio-group>
    <button type="button" class="outside">Continue</button>
  `,
  imports: [MlvRadioGroup, MlvRadio, FormField],
})
class ShippingHost {
  readonly model = signal<{ shipping: string | null }>({ shipping: null });
  readonly order = form(this.model, (path) => {
    required(path.shipping);
  });
  readonly group = viewChild.required(MlvRadioGroup);
}

/**
 * #347 (FC-15, owner decision D22): the group reports touched when focus
 * leaves the group — a required group the user tabs through without choosing
 * shows its error — and selecting no longer touches while focus stays inside.
 * Every assertion reads a primitive, so a failure never pretty-prints a
 * component.
 */
describe('MlvRadioGroup — touched timing (#347)', () => {
  let fixture: ComponentFixture<ShippingHost>;
  let host: ShippingHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShippingHost],
    }).compileComponents();
    fixture = TestBed.createComponent(ShippingHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function radioInputs(): HTMLInputElement[] {
    return Array.from(
      root().querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    );
  }

  function groupHost(): HTMLElement {
    return root().querySelector('mlv-radio-group') as HTMLElement;
  }

  function outside(): HTMLButtonElement {
    return root().querySelector('.outside') as HTMLButtonElement;
  }

  /** Index of the focused radio — a number, so a failure never prints a node. */
  function focusedRadio(): number {
    return radioInputs().findIndex((input) => input === document.activeElement);
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('marks the group touched when focus leaves it with no value chosen', async () => {
    radioInputs()[0].focus();
    await settle();
    expect(host.order.shipping().touched()).toBe(false);

    outside().focus();
    await settle();

    expect(host.order.shipping().value()).toBeNull();
    expect(host.order.shipping().touched()).toBe(true);
    expect(host.group().resolvedState()).toBe('error');
    expect(groupHost().getAttribute('aria-invalid')).toBe('true');
  });

  it('does not touch when an arrow key selects and moves focus inside the group', async () => {
    radioInputs()[0].focus();
    await settle();

    groupHost().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    expect(focusedRadio()).toBe(1);
    expect(host.order.shipping().value()).toBe('express');
    expect(host.order.shipping().touched()).toBe(false);
  });

  it('does not touch when a radio is chosen by click while focus stays inside', async () => {
    radioInputs()[0].focus();
    await settle();

    radioInputs()[2].click();
    await settle();

    expect(host.order.shipping().value()).toBe('pickup');
    expect(focusedRadio()).toBe(2);
    expect(host.order.shipping().touched()).toBe(false);

    outside().focus();
    await settle();
    expect(host.order.shipping().touched()).toBe(true);
    expect(host.group().resolvedState()).toBe('default');
  });

  it('does not touch — or flash the error — while a press on a label blurs the focused radio', async () => {
    // Tabbing into the group focuses a radio without choosing it.
    radioInputs()[0].focus();
    await settle();
    const label = root().querySelectorAll(
      '.mlv-radio__label',
    )[2] as HTMLElement;

    // What Chromium, Firefox and WebKit do for a press on a label: the
    // focused radio blurs to <body> at mousedown (measured on /radio).
    label.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    radioInputs()[0].blur();
    await settle();
    expect(host.order.shipping().touched()).toBe(false);
    expect(host.group().resolvedState()).toBe('default');

    label.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    label.click();
    // The label's activation focuses its radio after the click's listeners.
    radioInputs()[2].focus();
    await new Promise((resolve) => setTimeout(resolve));
    await settle();

    expect(host.order.shipping().value()).toBe('pickup');
    expect(host.order.shipping().touched()).toBe(false);
  });

  it('does not touch from selectRadio() alone', async () => {
    const group = host.group();
    group.selectRadio(group.radios()[1]);
    await settle();

    expect(host.order.shipping().value()).toBe('express');
    expect(host.order.shipping().touched()).toBe(false);
  });
});
