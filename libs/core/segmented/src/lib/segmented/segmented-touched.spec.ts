import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { MlvSegmentedItem } from '../segmented-item/segmented-item';
import { MlvSegmented } from './segmented';

@Component({
  template: `
    <mlv-segmented ariaLabel="Billing period" [formField]="plan.period">
      <button mlvSegmentedItem value="month">Monthly</button>
      <button mlvSegmentedItem value="year">Yearly</button>
      <button mlvSegmentedItem value="once">Once</button>
    </mlv-segmented>
    <button type="button" class="outside">Continue</button>
  `,
  imports: [MlvSegmented, MlvSegmentedItem, FormField],
})
class PlanHost {
  readonly model = signal<{ period: string | null }>({ period: null });
  readonly plan = form(this.model, (path) => {
    required(path.period);
  });
  readonly group = viewChild.required(MlvSegmented);
}

@Component({
  template: `
    <mlv-segmented (touch)="touches = touches + 1">
      <a mlvSegmentedItem href="#a">A</a>
      <a mlvSegmentedItem href="#b">B</a>
    </mlv-segmented>
    <button type="button" class="outside">Outside</button>
  `,
  imports: [MlvSegmented, MlvSegmentedItem],
})
class LinkHost {
  touches = 0;
}

/**
 * #347 (owner decision D22), the radio-mode segmented control — radio-group's
 * twin: it reports touched when focus leaves the control, not when a segment
 * is chosen. Every assertion reads a primitive, so a failure never
 * pretty-prints a component.
 */
describe('MlvSegmented — touched timing (#347)', () => {
  let fixture: ComponentFixture<PlanHost>;
  let host: PlanHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanHost, LinkHost],
    }).compileComponents();
    fixture = TestBed.createComponent(PlanHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function items(): HTMLButtonElement[] {
    return Array.from(
      root().querySelectorAll<HTMLButtonElement>('button[mlvSegmentedItem]'),
    );
  }

  function outside(): HTMLButtonElement {
    return root().querySelector('.outside') as HTMLButtonElement;
  }

  function track(): HTMLElement {
    return root().querySelector('.mlv-segmented__track') as HTMLElement;
  }

  /** Index of the focused segment — a number, so a failure never prints a node. */
  function focusedItem(): number {
    return items().findIndex((item) => item === document.activeElement);
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('marks the control touched when focus leaves it with nothing chosen', async () => {
    items()[0].focus();
    await settle();
    expect(host.plan.period().touched()).toBe(false);

    outside().focus();
    await settle();

    expect(host.plan.period().value()).toBeNull();
    expect(host.plan.period().touched()).toBe(true);
    expect(host.group().resolvedState()).toBe('error');
  });

  it('does not touch when a click chooses a segment', async () => {
    items()[1].click();
    await settle();

    expect(host.plan.period().value()).toBe('year');
    expect(focusedItem()).toBe(1);
    expect(host.plan.period().touched()).toBe(false);

    outside().focus();
    await settle();
    expect(host.plan.period().touched()).toBe(true);
    expect(host.group().resolvedState()).toBe('default');
  });

  it('does not touch when an arrow key moves the selection between segments', async () => {
    items()[1].click();
    await settle();

    track().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    expect(host.plan.period().value()).toBe('once');
    expect(focusedItem()).toBe(2);
    expect(host.plan.period().touched()).toBe(false);
  });

  it('emits no touch in link mode, which is navigation, not a form control', async () => {
    const linkFixture = TestBed.createComponent(LinkHost);
    linkFixture.detectChanges();
    await linkFixture.whenStable();
    const linkRoot = linkFixture.nativeElement as HTMLElement;

    (linkRoot.querySelector('a[mlvSegmentedItem]') as HTMLElement).focus();
    (linkRoot.querySelector('.outside') as HTMLElement).focus();

    expect(linkFixture.componentInstance.touches).toBe(0);
  });
});
