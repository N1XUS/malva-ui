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
import { MlvSegmentedItem } from '../segmented-item/segmented-item';
import { MlvSegmented } from './segmented';

/**
 * The user interaction driving the matrix: a real click on the second
 * segment's host `<button>`, which is exactly what a consumer's user does.
 */
function clickSecondItem(fixture: ComponentFixture<unknown>): void {
  const items: HTMLButtonElement[] = Array.from(
    fixture.nativeElement.querySelectorAll('button[mlvSegmentedItem]'),
  );
  items[1].click();
  fixture.detectChanges();
}

/**
 * The user leaving the control: focus moves from a segment to an element
 * outside it. That — not the click before it — is what reports touched
 * (#347), so the matrix's "untouched before blur" step also pins that a click
 * alone leaves the field untouched.
 */
function leaveControl(fixture: ComponentFixture<unknown>): void {
  const item = (fixture.nativeElement as HTMLElement).querySelector(
    'button[mlvSegmentedItem]',
  ) as HTMLButtonElement;
  item.focus();
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  outside.remove();
  fixture.detectChanges();
}

describe('MlvSegmented — forms bindings matrix', () => {
  it('reactive: [formControl]', async () => {
    @Component({
      template: `
        <mlv-segmented [formControl]="control" ariaLabel="Choice">
          <button mlvSegmentedItem value="a">A</button>
          <button mlvSegmentedItem value="b">B</button>
        </mlv-segmented>
      `,
      imports: [MlvSegmented, MlvSegmentedItem, ReactiveFormsModule],
    })
    class Host {
      readonly control = new FormControl('a', { nonNullable: true });
      readonly group = viewChild.required(MlvSegmented);
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
      interact: () => clickSecondItem(fixture),
      expectedAfterInteraction: 'b',
      blur: () => leaveControl(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `
        <mlv-segmented [(ngModel)]="value" ariaLabel="Choice">
          <button mlvSegmentedItem value="a">A</button>
          <button mlvSegmentedItem value="b">B</button>
        </mlv-segmented>
      `,
      imports: [MlvSegmented, MlvSegmentedItem, FormsModule],
    })
    class Host {
      value = 'a';
      readonly group = viewChild.required(MlvSegmented);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const ngControl = fixture.debugElement
      .query(By.directive(MlvSegmented))
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
        isTouched: () => ngControl.touched ?? false,
      },
      sample: 'a',
      interact: () => clickSecondItem(fixture),
      expectedAfterInteraction: 'b',
      blur: () => leaveControl(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `
        <mlv-segmented [formField]="fields.choice" ariaLabel="Choice">
          <button mlvSegmentedItem value="a">A</button>
          <button mlvSegmentedItem value="b">B</button>
        </mlv-segmented>
      `,
      imports: [MlvSegmented, MlvSegmentedItem, FormField],
    })
    class Host {
      readonly disable = signal(false);
      readonly model = signal({ choice: 'a' });
      readonly fields = form(this.model, (path) => {
        disabled(path.choice, () => this.disable());
      });
      readonly group = viewChild.required(MlvSegmented);
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
      interact: () => clickSecondItem(fixture),
      expectedAfterInteraction: 'b',
      blur: () => leaveControl(fixture),
    });
  });
});
