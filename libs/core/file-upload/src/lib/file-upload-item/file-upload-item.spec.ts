import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvFileUploadItem } from './file-upload-item';
import type { MlvUploadedFile } from '../file-upload/file-upload.types';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name: string, type = 'text/plain', sizeBytes = 500): File {
  const blob = new Blob(['x'.repeat(sizeBytes)], { type });
  return new File([blob], name, { type });
}

function makePendingItem(
  overrides: Partial<MlvUploadedFile> = {},
): MlvUploadedFile {
  return {
    id: 'test-1',
    file: makeFile('document.txt'),
    name: 'document.txt',
    size: 512,
    state: 'pending',
    progress: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MlvFileUploadItem
// ---------------------------------------------------------------------------

describe('MlvFileUploadItem', () => {
  let component: MlvFileUploadItem;
  let fixture: ComponentFixture<MlvFileUploadItem>;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvFileUploadItem],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvFileUploadItem);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('file', makePendingItem());
    hostEl = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // -------------------------------------------------------------------------
  // Creation
  // -------------------------------------------------------------------------

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Host classes
  // -------------------------------------------------------------------------

  describe('host classes', () => {
    it('should always have mlv-file-upload-item class', () => {
      expect(hostEl.classList).toContain('mlv-file-upload-item');
    });

    it('should add --uploading class when state is uploading', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({ state: 'uploading', progress: 50 }),
      );
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-file-upload-item--uploading');
    });

    it('should add --success class when state is success', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({ state: 'success' }),
      );
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-file-upload-item--success');
    });

    it('should add --error class when state is error', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({ state: 'error' }),
      );
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-file-upload-item--error');
    });

    it('should NOT have state modifier classes when state is pending', () => {
      expect(hostEl.classList).not.toContain('mlv-file-upload-item--uploading');
      expect(hostEl.classList).not.toContain('mlv-file-upload-item--success');
      expect(hostEl.classList).not.toContain('mlv-file-upload-item--error');
    });
  });

  // -------------------------------------------------------------------------
  // Filename rendering
  // -------------------------------------------------------------------------

  describe('filename rendering', () => {
    it('should render the filename', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({ name: 'my-document.pdf' }),
      );
      fixture.detectChanges();
      const nameEl = hostEl.querySelector('.mlv-file-upload-item__name');
      expect(nameEl?.textContent?.trim()).toBe('my-document.pdf');
    });

    it('should set title attribute to the filename for overflow tooltip', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({ name: 'very-long-filename-here.txt' }),
      );
      fixture.detectChanges();
      const nameEl = hostEl.querySelector<HTMLElement>(
        '.mlv-file-upload-item__name',
      );
      expect(nameEl?.title).toBe('very-long-filename-here.txt');
    });
  });

  // -------------------------------------------------------------------------
  // Formatted size
  // -------------------------------------------------------------------------

  describe('formatted size', () => {
    it('should display size in bytes when < 1 KB', () => {
      fixture.componentRef.setInput('file', makePendingItem({ size: 500 }));
      fixture.detectChanges();
      const meta = hostEl.querySelector('.mlv-file-upload-item__meta');
      expect(meta?.textContent?.trim()).toContain('500');
    });

    it('should display size in KB when >= 1 KB and < 1 MB', () => {
      fixture.componentRef.setInput('file', makePendingItem({ size: 2048 }));
      fixture.detectChanges();
      const meta = hostEl.querySelector('.mlv-file-upload-item__meta');
      expect(meta?.textContent?.trim()).toContain('KB');
    });

    it('should display size in MB when >= 1 MB', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({ size: 2 * 1024 * 1024 }),
      );
      fixture.detectChanges();
      const meta = hostEl.querySelector('.mlv-file-upload-item__meta');
      expect(meta?.textContent?.trim()).toContain('MB');
    });

    it('should show exactly 1.5 MB for 1.5 * 1024 * 1024 bytes', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({ size: Math.round(1.5 * 1024 * 1024) }),
      );
      fixture.detectChanges();
      const meta = hostEl.querySelector('.mlv-file-upload-item__meta');
      expect(meta?.textContent?.trim()).toBe('1.5 MB');
    });

    it('should show exactly 2.5 KB for 2560 bytes', () => {
      fixture.componentRef.setInput('file', makePendingItem({ size: 2560 }));
      fixture.detectChanges();
      const meta = hostEl.querySelector('.mlv-file-upload-item__meta');
      expect(meta?.textContent?.trim()).toBe('2.5 KB');
    });
  });

  // -------------------------------------------------------------------------
  // Thumbnail for image files
  // -------------------------------------------------------------------------

  describe('thumbnail', () => {
    it('should render an img element when previewUrl is provided', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({
          previewUrl: 'blob:http://localhost/abc',
          name: 'photo.jpg',
        }),
      );
      fixture.detectChanges();
      const img = hostEl.querySelector<HTMLImageElement>(
        '.mlv-file-upload-item__thumbnail-img',
      );
      expect(img).toBeTruthy();
      expect(img?.src).toContain('blob:');
      expect(img?.alt).toBe('photo.jpg');
    });

    it('should render a file icon (svg) when previewUrl is NOT provided', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({ previewUrl: undefined }),
      );
      fixture.detectChanges();
      const img = hostEl.querySelector('.mlv-file-upload-item__thumbnail-img');
      expect(img).toBeNull();
      // lucideFile renders as an svg inside the thumbnail
      const svg = hostEl.querySelector('.mlv-file-upload-item__thumbnail svg');
      expect(svg).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Progress bar
  // -------------------------------------------------------------------------

  describe('progress bar', () => {
    it('should show the progress loader when state is uploading', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({ state: 'uploading', progress: 60 }),
      );
      fixture.detectChanges();
      const loader = hostEl.querySelector('.mlv-file-upload-item__progress');
      expect(loader).toBeTruthy();
    });

    it('should NOT show progress loader when state is pending', () => {
      const loader = hostEl.querySelector('.mlv-file-upload-item__progress');
      expect(loader).toBeNull();
    });

    it('should NOT show progress loader when state is success', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({ state: 'success' }),
      );
      fixture.detectChanges();
      const loader = hostEl.querySelector('.mlv-file-upload-item__progress');
      expect(loader).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Status icons
  // -------------------------------------------------------------------------

  describe('status icons', () => {
    it('should render success icon when state is success', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({ state: 'success' }),
      );
      fixture.detectChanges();
      const icon = hostEl.querySelector(
        '.mlv-file-upload-item__status-icon--success',
      );
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute('aria-label')).toBe('Upload complete');
    });

    it('should render error icon when state is error', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({ state: 'error' }),
      );
      fixture.detectChanges();
      const icon = hostEl.querySelector(
        '.mlv-file-upload-item__status-icon--error',
      );
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute('aria-label')).toBe('Upload failed');
    });

    it('should NOT render success icon when state is pending', () => {
      expect(
        hostEl.querySelector('.mlv-file-upload-item__status-icon--success'),
      ).toBeNull();
    });

    it('should NOT render error icon when state is pending', () => {
      expect(
        hostEl.querySelector('.mlv-file-upload-item__status-icon--error'),
      ).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Remove button
  // -------------------------------------------------------------------------

  describe('remove button', () => {
    it('should render a remove button', () => {
      const btn = hostEl.querySelector<HTMLButtonElement>(
        '.mlv-file-upload-item__remove',
      );
      expect(btn).toBeTruthy();
    });

    it('should have aria-label containing the filename', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({ name: 'report.xlsx' }),
      );
      fixture.detectChanges();
      // The accessible name lives on the native button inside
      // <mlv-button-close>, not on that component's host element.
      const btn = hostEl.querySelector<HTMLButtonElement>(
        '.mlv-file-upload-item__remove button',
      );
      expect(btn?.getAttribute('aria-label')).toBe('Remove report.xlsx');
    });

    it('should emit remove output when button is clicked', () => {
      const emitSpy = vi.spyOn(component.remove, 'emit');

      const btn = fixture.debugElement.query(
        By.css('.mlv-file-upload-item__remove'),
      );
      btn.triggerEventHandler('click', new MouseEvent('click'));
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Error message inside item (file.error)
  // -------------------------------------------------------------------------

  describe('item-level error message', () => {
    it('should show error message in meta when file has an error property', () => {
      fixture.componentRef.setInput(
        'file',
        makePendingItem({
          error: { code: 'size', message: 'File is too large.' },
        }),
      );
      fixture.detectChanges();
      const meta = hostEl.querySelector('.mlv-file-upload-item__meta--error');
      expect(meta).toBeTruthy();
      expect(meta?.textContent?.trim()).toBe('File is too large.');
    });

    it('should NOT show error meta when file has no error property', () => {
      expect(
        hostEl.querySelector('.mlv-file-upload-item__meta--error'),
      ).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Reactive state changes
  // -------------------------------------------------------------------------

  describe('reactive state changes', () => {
    it('should update class when file input changes from pending to success', () => {
      expect(hostEl.classList).not.toContain('mlv-file-upload-item--success');

      fixture.componentRef.setInput(
        'file',
        makePendingItem({ state: 'success' }),
      );
      fixture.detectChanges();

      expect(hostEl.classList).toContain('mlv-file-upload-item--success');
    });

    it('should update progress bar visibility when state changes to uploading', () => {
      expect(
        hostEl.querySelector('.mlv-file-upload-item__progress'),
      ).toBeNull();

      fixture.componentRef.setInput(
        'file',
        makePendingItem({ state: 'uploading', progress: 30 }),
      );
      fixture.detectChanges();

      expect(
        hostEl.querySelector('.mlv-file-upload-item__progress'),
      ).toBeTruthy();
    });
  });
});
