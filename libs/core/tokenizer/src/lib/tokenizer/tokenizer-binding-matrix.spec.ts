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
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { verifyFormsBinding } from '@malva-ui/core/form-utils/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTokenizer } from './tokenizer';

type Token = MlvSelectOption<string>;
const sample: Token[] = [{ label: 'Angular', value: 'angular' }];

function removeSample(
  fixture: ComponentFixture<unknown>,
  tokenizer: MlvTokenizer<string>,
): void {
  tokenizer.removeToken(tokenizer.value()[0]);
  fixture.detectChanges();
}

function blur(
  fixture: ComponentFixture<unknown>,
  tokenizer: MlvTokenizer<string>,
): void {
  tokenizer.onInputBlur();
  fixture.detectChanges();
}

describe('MlvTokenizer — forms bindings matrix', () => {
  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-tokenizer [formControl]="control" />`,
      imports: [MlvTokenizer, ReactiveFormsModule],
    })
    class Host {
      readonly control = new FormControl<Token[]>([], { nonNullable: true });
      readonly tokenizer = viewChild.required(MlvTokenizer<string>);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<Token[]>({
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
        isDisabled: () => host.tokenizer().computedDisabled(),
      },
      sample,
      interact: () => removeSample(fixture, host.tokenizer()),
      expectedAfterInteraction: [],
      blur: () => blur(fixture, host.tokenizer()),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-tokenizer [(ngModel)]="value" />`,
      imports: [MlvTokenizer, FormsModule],
    })
    class Host {
      value: Token[] = [];
      readonly tokenizer = viewChild.required(MlvTokenizer<string>);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const ngControl = fixture.debugElement
      .query(By.directive(MlvTokenizer))
      .injector.get(NgControl);

    await verifyFormsBinding<Token[]>({
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
      sample,
      interact: () => removeSample(fixture, host.tokenizer()),
      expectedAfterInteraction: [],
      blur: () => blur(fixture, host.tokenizer()),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-tokenizer [formField]="fields.tokens" />`,
      imports: [MlvTokenizer, FormField],
    })
    class Host {
      readonly disable = signal(false);
      readonly model = signal<{ tokens: Token[] }>({ tokens: [] });
      readonly fields = form(this.model, (path) => {
        disabled(path.tokens, () => this.disable());
      });
      readonly tokenizer = viewChild.required(MlvTokenizer<string>);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<Token[]>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (value) => {
          host.model.set({ tokens: value });
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.fields.tokens().value(),
        isTouched: () => host.fields.tokens().touched(),
        setDisabled: async (value) => {
          host.disable.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.tokenizer().computedDisabled(),
      },
      sample,
      interact: () => removeSample(fixture, host.tokenizer()),
      expectedAfterInteraction: [],
      blur: () => blur(fixture, host.tokenizer()),
    });
  });
});
