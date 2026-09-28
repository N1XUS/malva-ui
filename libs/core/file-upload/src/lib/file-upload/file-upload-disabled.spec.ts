import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvFileUpload } from './file-upload';
import type { MlvUploadedFile } from './file-upload.types';

/** A pending upload descriptor for `name`. */
function uploaded(id: string, name: string): MlvUploadedFile {
  const file = new File(['x'], name, { type: 'text/plain' });
  return { id, file, name, size: file.size, state: 'pending' };
}

/** Every native remove button the file rows render. */
function removeButtons(host: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    host.querySelectorAll<HTMLButtonElement>(
      '.mlv-file-upload-item__remove button',
    ),
  );
}

/**
 * A disabled `mlv-file-upload` removes nothing (#568): each row's remove button
 * is disabled — out of the tab order, not activatable — and `removeFile()` is a
 * no-op. The old host opacity used to hide that the rows stayed live (#366).
 */
describe('MlvFileUpload — disabled file rows', () => {
  let fixture: ComponentFixture<MlvFileUpload>;
  let upload: MlvFileUpload;
  let host: HTMLElement;
  const files = [uploaded('a', 'a.txt'), uploaded('b', 'b.txt')];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvFileUpload],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvFileUpload);
    upload = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('multiple', true);
    fixture.componentRef.setInput('value', files);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('disables every row’s remove button', () => {
    const buttons = removeButtons(host);
    expect(buttons).toHaveLength(2);
    expect(buttons.map((button) => button.disabled)).toEqual([true, true]);
  });

  it('keeps the remove buttons out of keyboard reach', () => {
    const [first] = removeButtons(host);
    first.focus();
    expect(document.activeElement === first).toBe(false);

    // A disabled button does not turn Enter / Space / `click()` into a click.
    first.click();
    fixture.detectChanges();
    expect(upload.value().map((file) => file.id)).toEqual(['a', 'b']);
  });

  it('removes nothing through removeFile() and emits no filesChange', () => {
    const emitted: MlvUploadedFile[][] = [];
    upload.filesChange.subscribe((next) => emitted.push(next));

    upload.removeFile('a');
    fixture.detectChanges();

    expect(upload.value().map((file) => file.id)).toEqual(['a', 'b']);
    expect(emitted).toHaveLength(0);
  });

  it('removes again once re-enabled', async () => {
    fixture.componentRef.setInput('disabled', false);
    fixture.detectChanges();
    await fixture.whenStable();

    const [first] = removeButtons(host);
    expect(first.disabled).toBe(false);
    first.click();
    fixture.detectChanges();

    expect(upload.value().map((file) => file.id)).toEqual(['b']);
  });

  it('has no axe violations while disabled with file rows', async () => {
    await expectNoAxeViolations(host);
  });
});
