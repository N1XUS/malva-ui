import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import {
  FormControl,
  FormsModule,
  NgControl,
  ReactiveFormsModule,
} from '@angular/forms';
import { disabled, form, FormField } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { verifyFormsBinding } from '@malva-ui/core/form-utils/testing';
import { MlvRadio } from '../radio/radio';
import { MlvRadioGroup } from './radio-group';

function selectB(
  fixture: ComponentFixture<unknown>,
  group: MlvRadioGroup,
): void {
  group.selectRadio(group.radios()[1]);
  fixture.detectChanges();
}

/**
 * The user leaving the group: focus moves from a radio to an element outside
 * it. That — not the selection before it — is what reports touched (#347), so
 * the matrix's "untouched before blur" step also pins that `selectB` alone
 * leaves the field untouched.
 */
function leaveGroup(fixture: ComponentFixture<unknown>): void {
  const radio = (fixture.nativeElement as HTMLElement).querySelector(
    'input[type="radio"]',
  ) as HTMLInputElement;
  radio.focus();
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  outside.remove();
  fixture.detectChanges();
}

describe('MlvRadioGroup — forms bindings matrix', () => {
  it('reactive: [formControl]', async () => {
    @Component({
      template: `
        <mlv-radio-group [formControl]="control">
          <mlv-radio value="a">A</mlv-radio>
          <mlv-radio value="b">B</mlv-radio>
        </mlv-radio-group>
      `,
      imports: [MlvRadioGroup, MlvRadio, ReactiveFormsModule],
    })
    class Host {
      readonly control = new FormControl('a', { nonNullable: true });
      readonly group = viewChild.required(MlvRadioGroup);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'reactive',
        setValue: (value) => {
          host.control.setValue(value);
          fixture.detectChanges();
        },
        getValue: () => host.control.value,
        isTouched: () => host.control.touched,
        setDisabled: (value) => {
          if (value) host.control.disable();
          else host.control.enable();
          fixture.detectChanges();
        },
        isDisabled: () => host.group().computedDisabled(),
      },
      sample: 'a',
      interact: () => selectB(fixture, host.group()),
      expectedAfterInteraction: 'b',
      blur: () => leaveGroup(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `
        <mlv-radio-group [(ngModel)]="value">
          <mlv-radio value="a">A</mlv-radio>
          <mlv-radio value="b">B</mlv-radio>
        </mlv-radio-group>
      `,
      imports: [MlvRadioGroup, MlvRadio, FormsModule],
    })
    class Host {
      value = 'a';
      readonly group = viewChild.required(MlvRadioGroup);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const ngControl = fixture.debugElement
      .query(By.directive(MlvRadioGroup))
      .injector.get(NgControl);

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'template-driven',
        setValue: async (value) => {
          host.value = value;
          fixture.detectChanges();
          await fixture.whenStable();
          fixture.detectChanges();
        },
        getValue: () => host.value,
        isTouched: () => ngControl.touched,
      },
      sample: 'a',
      interact: () => selectB(fixture, host.group()),
      expectedAfterInteraction: 'b',
      blur: () => leaveGroup(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `
        <mlv-radio-group [formField]="fields.choice">
          <mlv-radio value="a">A</mlv-radio>
          <mlv-radio value="b">B</mlv-radio>
        </mlv-radio-group>
      `,
      imports: [MlvRadioGroup, MlvRadio, FormField],
    })
    class Host {
      readonly disable = signal(false);
      readonly model = signal({ choice: 'a' });
      readonly fields = form(this.model, (path) => {
        disabled(path.choice, () => this.disable());
      });
      readonly group = viewChild.required(MlvRadioGroup);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (value) => {
          host.model.set({ choice: value });
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.fields.choice().value(),
        isTouched: () => host.fields.choice().touched(),
        setDisabled: async (value) => {
          host.disable.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.group().computedDisabled(),
      },
      sample: 'a',
      interact: () => selectB(fixture, host.group()),
      expectedAfterInteraction: 'b',
      blur: () => leaveGroup(fixture),
    });
  });
});
