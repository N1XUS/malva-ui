import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import axe from 'axe-core';
import { MlvRadio } from './radio';
import { MlvRadioGroup } from '../radio-group/radio-group';

@Component({
  template: `<mlv-radio [value]="'test'">Test</mlv-radio>`,
  imports: [MlvRadio],
})
class TestHostComponent {}

@Component({
  template: `
    <mlv-radio [value]="'a'" aria-label="Select row" />
    <mlv-radio [value]="'b'" aria-labelledby="ext-label" />
    <span id="ext-label">External label</span>
  `,
  imports: [MlvRadio],
})
class RadioAriaHostComponent {}

@Component({
  template: `
    <mlv-radio-group>
      <mlv-radio [value]="'first'">First</mlv-radio>
      <mlv-radio [value]="'disabled'" [disabled]="true">Disabled</mlv-radio>
      <mlv-radio [value]="'third'">Third</mlv-radio>
    </mlv-radio-group>
  `,
  imports: [MlvRadio, MlvRadioGroup],
})
class RadioGroupHostComponent {}

function dispatchArrowDown(element: HTMLElement): void {
  const event = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    bubbles: true,
  });
  Object.defineProperty(event, 'keyCode', { get: () => 40 });
  element.dispatchEvent(event);
}

describe('MlvRadio', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    const el = fixture.nativeElement.querySelector('mlv-radio');
    expect(el).toBeTruthy();
  });

  it('does not emit an empty aria-label/aria-labelledby on the input when none is supplied', () => {
    fixture.detectChanges();
    const input = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('.mlv-radio__native');
    expect(input?.hasAttribute('aria-label')).toBe(false);
    expect(input?.hasAttribute('aria-labelledby')).toBe(false);
  });
});

describe('MlvRadio host aria-label/aria-labelledby forwarding', () => {
  let fixture: ComponentFixture<RadioAriaHostComponent>;
  let hosts: HTMLElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RadioAriaHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RadioAriaHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    hosts = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-radio'),
    );
  });

  it('moves a host aria-label onto the inner input and strips it from the host', () => {
    const host = hosts[0];
    const input = host.querySelector<HTMLInputElement>('.mlv-radio__native');
    expect(host.hasAttribute('aria-label')).toBe(false);
    expect(input?.getAttribute('aria-label')).toBe('Select row');
  });

  it('moves a host aria-labelledby onto the inner input and strips it from the host', () => {
    const host = hosts[1];
    const input = host.querySelector<HTMLInputElement>('.mlv-radio__native');
    expect(host.hasAttribute('aria-labelledby')).toBe(false);
    expect(input?.getAttribute('aria-labelledby')).toBe('ext-label');
  });

  it('has no aria-prohibited-attr violations (axe)', async () => {
    const results = await axe.run(fixture.nativeElement as HTMLElement, {
      runOnly: { type: 'rule', values: ['aria-prohibited-attr'] },
    });
    expect(results.violations).toEqual([]);
  });
});

describe('MlvRadioGroup', () => {
  it('should skip disabled radios during arrow navigation', async () => {
    await TestBed.configureTestingModule({
      imports: [RadioGroupHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(RadioGroupHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const radios = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-radio'),
    );

    const firstInput =
      radios[0].querySelector<HTMLInputElement>('.mlv-radio__native');
    firstInput?.focus();
    firstInput?.dispatchEvent(new FocusEvent('focus'));
    dispatchArrowDown(radios[0]);
    fixture.detectChanges();

    // Focus now lands on the native radio input inside the third radio.
    expect(radios[2].contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(
      radios[2].querySelector('.mlv-radio__native'),
    );
  });

  it('single focus target: native input tabbable, host not tabbable', async () => {
    await TestBed.configureTestingModule({
      imports: [RadioGroupHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(RadioGroupHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const radios = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-radio'),
    );
    // Host is never tabbable; the native input carries the roving tabindex.
    radios.forEach((r) => expect(r.getAttribute('tabindex')).toBeNull());
    const firstInput =
      radios[0].querySelector<HTMLInputElement>('.mlv-radio__native');
    expect(firstInput?.getAttribute('tabindex')).toBe('0');
  });

  it('ArrowRight also advances selection (skipping disabled)', async () => {
    await TestBed.configureTestingModule({
      imports: [RadioGroupHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(RadioGroupHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const radios = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-radio'),
    );
    const firstInput =
      radios[0].querySelector<HTMLInputElement>('.mlv-radio__native');
    firstInput?.focus();
    firstInput?.dispatchEvent(new FocusEvent('focus'));
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
    });
    radios[0].dispatchEvent(event);
    fixture.detectChanges();

    expect(document.activeElement).toBe(
      radios[2].querySelector('.mlv-radio__native'),
    );
  });
});
