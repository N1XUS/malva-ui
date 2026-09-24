import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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

@Component({
  template: `
    <mlv-file-upload [multiple]="true" [formControl]="files" />
    <button type="button" class="outside">Submit</button>
  `,
  imports: [MlvFileUpload, ReactiveFormsModule],
})
class AttachmentsHost {
  readonly files = new FormControl<MlvUploadedFile[]>([sampleFile()], {
    nonNullable: true,
  });
}

/**
 * #347 (owner decision D22): the upload's host `focusout` reported touched on
 * the move from the browse button to a file's remove button. It now reports
 * touched once focus has left the upload. Every assertion reads a primitive,
 * so a failure never pretty-prints a component.
 */
describe('MlvFileUpload — touched timing (#347)', () => {
  let fixture: ComponentFixture<AttachmentsHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttachmentsHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(AttachmentsHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** The upload's own buttons: browse first, then each file's remove. */
  function buttons(): HTMLButtonElement[] {
    return Array.from(
      root().querySelectorAll<HTMLButtonElement>('mlv-file-upload button'),
    );
  }

  it('renders a browse button and at least one other button to move between', () => {
    expect(buttons().length).toBeGreaterThan(1);
  });

  it('does not touch when focus moves between the upload’s own buttons', async () => {
    const [browse, ...rest] = buttons();
    browse.focus();
    rest[rest.length - 1].focus();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.files.touched).toBe(false);
  });

  it('marks the control touched once focus leaves the upload', async () => {
    buttons()[0].focus();
    (root().querySelector('.outside') as HTMLButtonElement).focus();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.files.touched).toBe(true);
  });
});
