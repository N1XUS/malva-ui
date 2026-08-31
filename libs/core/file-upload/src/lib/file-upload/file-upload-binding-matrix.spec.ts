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
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvFileUpload } from './file-upload';
import type { MlvUploadedFile } from './file-upload.types';

function sampleFile(): MlvUploadedFile {
  const file = new File(['report'], 'report.txt', { type: 'text/plain' });
  return {
    id: 'report',
    file,
    name: file.name,
    size: file.size,
    state: 'pending',
  };
}

function removeSample(
  fixture: ComponentFixture<unknown>,
  upload: MlvFileUpload,
): void {
  upload.removeFile('report');
  fixture.detectChanges();
}

function blur(fixture: ComponentFixture<unknown>): void {
  fixture.nativeElement
    .querySelector('mlv-file-upload')
    .dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  fixture.detectChanges();
}

describe('MlvFileUpload — forms bindings matrix', () => {
  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-file-upload [formControl]="control" />`,
      imports: [MlvFileUpload, ReactiveFormsModule],
    })
    class Host {
      readonly control = new FormControl<MlvUploadedFile[]>([], {
        nonNullable: true,
      });
      readonly upload = viewChild.required(MlvFileUpload);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<MlvUploadedFile[]>({
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
        isDisabled: () => host.upload().computedDisabled(),
      },
      sample: [sampleFile()],
      interact: () => removeSample(fixture, host.upload()),
      expectedAfterInteraction: [],
      blur: () => blur(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-file-upload [(ngModel)]="value" />`,
      imports: [MlvFileUpload, FormsModule],
    })
    class Host {
      value: MlvUploadedFile[] = [];
      readonly upload = viewChild.required(MlvFileUpload);
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
      .query(By.directive(MlvFileUpload))
      .injector.get(NgControl);

    await verifyFormsBinding<MlvUploadedFile[]>({
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
      sample: [sampleFile()],
      interact: () => removeSample(fixture, host.upload()),
      expectedAfterInteraction: [],
      blur: () => blur(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-file-upload [formField]="fields.files" />`,
      imports: [MlvFileUpload, FormField],
    })
    class Host {
      readonly disable = signal(false);
      readonly model = signal<{ files: MlvUploadedFile[] }>({ files: [] });
      readonly fields = form(this.model, (path) => {
        disabled(path.files, () => this.disable());
      });
      readonly upload = viewChild.required(MlvFileUpload);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<MlvUploadedFile[]>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (value) => {
          host.model.set({ files: value });
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.fields.files().value(),
        isTouched: () => host.fields.files().touched(),
        setDisabled: async (value) => {
          host.disable.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.upload().computedDisabled(),
      },
      sample: [sampleFile()],
      interact: () => removeSample(fixture, host.upload()),
      expectedAfterInteraction: [],
      blur: () => blur(fixture),
    });
  });
});
