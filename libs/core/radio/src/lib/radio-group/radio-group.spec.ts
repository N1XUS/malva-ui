import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import type { Type } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MlvRadioGroup } from './radio-group';
import { MlvRadio } from '../radio/radio';

// ---------------------------------------------------------------------------
// Host components
// ---------------------------------------------------------------------------

@Component({
  template: `
    <mlv-radio-group [(value)]="value" [state]="state" [readonly]="readonly">
      <mlv-radio [value]="'a'">A</mlv-radio>
      <mlv-radio [value]="'b'">B</mlv-radio>
      <mlv-radio [value]="'c'">C</mlv-radio>
    </mlv-radio-group>
  `,
  imports: [MlvRadioGroup, MlvRadio],
})
class TemplateHost {
  value: unknown = undefined;
  state = 'default';
  readonly = false;
}

@Component({
  template: `
    <mlv-radio-group [formControl]="ctrl">
      <mlv-radio [value]="'a'">A</mlv-radio>
      <mlv-radio [value]="'b'">B</mlv-radio>
    </mlv-radio-group>
  `,
  imports: [MlvRadioGroup, MlvRadio, ReactiveFormsModule],
})
class ReactiveHost {
  ctrl = new FormControl<string>('a');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRadios(fixture: ComponentFixture<unknown>): HTMLInputElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('.mlv-radio__native'),
  );
}

function getGroupEl(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement.querySelector('mlv-radio-group');
}

async function createFixture<T>(
  hostClass: Type<T>,
): Promise<ComponentFixture<T>> {
  await TestBed.configureTestingModule({
    imports: [hostClass],
  }).compileComponents();
  const fixture = TestBed.createComponent(hostClass);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MlvRadioGroup', () => {
  describe('rendering', () => {
    it('has role="radiogroup" on the host', async () => {
      const fixture = await createFixture(TemplateHost);
      expect(getGroupEl(fixture).getAttribute('role')).toBe('radiogroup');
    });

    it('projects each radio', async () => {
      const fixture = await createFixture(TemplateHost);
      expect(getRadios(fixture).length).toBe(3);
    });

    it('applies the default state modifier class', async () => {
      const fixture = await createFixture(TemplateHost);
      expect(
        getGroupEl(fixture).classList.contains(
          'mlv-radio-group--state-default',
        ),
      ).toBe(true);
    });
  });

  describe('selection', () => {
    it('selects a radio on native change and updates the model', async () => {
      const fixture = await createFixture(TemplateHost);
      const radios = getRadios(fixture);
      radios[1].dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.value).toBe('b');
    });

    it('moves the roving tab stop to the selected radio', async () => {
      const fixture = await createFixture(TemplateHost);
      const radios = getRadios(fixture);
      radios[2].dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      const tabbable = radios.filter((r) => r.getAttribute('tabindex') === '0');
      expect(tabbable.length).toBe(1);
      expect(radios[2].getAttribute('tabindex')).toBe('0');
    });
  });

  describe('keyboard navigation', () => {
    it('ArrowDown moves selection to the next radio', async () => {
      const fixture = await createFixture(TemplateHost);
      // Attached to the document so radio.focus() fires the focus event that
      // syncs the FocusKeyManager's active item.
      document.body.appendChild(fixture.nativeElement);
      try {
        const radios = getRadios(fixture);
        radios[0].dispatchEvent(new Event('change', { bubbles: true }));
        fixture.detectChanges();

        getGroupEl(fixture).dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
            cancelable: true,
          }),
        );
        fixture.detectChanges();
        expect(fixture.componentInstance.value).toBe('b');
      } finally {
        fixture.nativeElement.remove();
      }
    });
  });

  describe('read-only', () => {
    @Component({
      template: `
        <mlv-radio-group [(value)]="value" [readonly]="true">
          <mlv-radio [value]="'a'">A</mlv-radio>
          <mlv-radio [value]="'b'">B</mlv-radio>
        </mlv-radio-group>
      `,
      imports: [MlvRadioGroup, MlvRadio],
    })
    class ReadonlyHost {
      value: unknown = undefined;
    }

    it('adds the readonly modifier class and blocks selection', async () => {
      const fixture = await createFixture(ReadonlyHost);

      expect(
        getGroupEl(fixture).classList.contains('mlv-radio-group--readonly'),
      ).toBe(true);

      const radios = getRadios(fixture);
      radios[1].dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.value).toBeUndefined();
    });
  });

  describe('reactive forms / form disabled', () => {
    it('checks the radio matching the initial FormControl value', async () => {
      const fixture = await createFixture(ReactiveHost);
      const radios = getRadios(fixture);
      expect(radios[0].getAttribute('aria-checked')).toBe('true');
      expect(radios[1].getAttribute('aria-checked')).toBe('false');
    });

    it('propagates FormControl.disable() to the radio group', async () => {
      const fixture = await createFixture(ReactiveHost);
      fixture.componentInstance.ctrl.disable();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(
        getGroupEl(fixture).classList.contains('mlv-radio-group--disabled'),
      ).toBe(true);

      // Selection must be blocked while disabled via the form control.
      const radios = getRadios(fixture);
      radios[1].dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.ctrl.value).toBe('a');
    });
  });
});

@Component({
  template: `
    <mlv-radio-group
      label="Plan"
      required
      description="Billed monthly."
      message="Pick one"
    >
      <mlv-radio [value]="'a'">A</mlv-radio>
    </mlv-radio-group>
  `,
  imports: [MlvRadioGroup, MlvRadio],
})
class RadioGroupFieldSurfaceHost {}

describe('MlvRadioGroup field surface', () => {
  let fixture: ComponentFixture<RadioGroupFieldSurfaceHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RadioGroupFieldSurfaceHost],
    }).compileComponents();
    fixture = TestBed.createComponent(RadioGroupFieldSurfaceHost);
    await fixture.whenStable();
  });

  it('marks the radiogroup required and shows the label marker', () => {
    const group = fixture.nativeElement.querySelector(
      'mlv-radio-group',
    ) as HTMLElement;
    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-required')).toBe('true');
    expect(
      fixture.nativeElement.querySelector('.mlv-label__required'),
    ).not.toBeNull();
  });

  it('renders description and message and describes the group with both', () => {
    const description = fixture.nativeElement.querySelector(
      'mlv-description',
    ) as HTMLElement;
    const message = fixture.nativeElement.querySelector(
      'mlv-message',
    ) as HTMLElement;
    expect(description.textContent?.trim()).toBe('Billed monthly.');
    expect(message.textContent?.trim()).toBe('Pick one');

    const group = fixture.nativeElement.querySelector(
      'mlv-radio-group',
    ) as HTMLElement;
    expect((group.getAttribute('aria-describedby') ?? '').split(' ')).toEqual([
      description.id,
      message.id,
    ]);
  });
});
