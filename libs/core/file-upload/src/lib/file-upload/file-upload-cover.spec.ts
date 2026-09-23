import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvFileUploadAction } from '../file-upload-action';
import { MlvFileUpload } from './file-upload';
import type { MlvUploadedFile } from './file-upload.types';

/** A 1x1 transparent PNG — a `data:` URL survives Angular's URL sanitizer. */
const PREVIEW =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAQAABQAB';

/** Builds an image file descriptor that satisfies the cover preconditions. */
function imageFile(overrides: Partial<MlvUploadedFile> = {}): MlvUploadedFile {
  const blob = new Blob(['x'], { type: 'image/png' });
  return {
    id: 'img-1',
    file: new File([blob], 'photo.png', { type: 'image/png' }),
    name: 'photo.png',
    size: 1,
    previewUrl: PREVIEW,
    state: 'success',
    ...overrides,
  };
}

/** Builds a non-image descriptor, which never carries a `previewUrl`. */
function documentFile(): MlvUploadedFile {
  const blob = new Blob(['x'], { type: 'application/pdf' });
  return {
    id: 'doc-1',
    file: new File([blob], 'report.pdf', { type: 'application/pdf' }),
    name: 'report.pdf',
    size: 1,
    state: 'success',
  };
}

// ---------------------------------------------------------------------------
// Cover state activation
// ---------------------------------------------------------------------------

describe('MlvFileUpload — cover preview activation', () => {
  let component: MlvFileUpload;
  let fixture: ComponentFixture<MlvFileUpload>;
  let hostEl: HTMLElement;

  /** Puts the control into the fully satisfied cover configuration. */
  function enableCover(): void {
    fixture.componentRef.setInput('previewMode', 'cover');
    fixture.componentRef.setInput('multiple', false);
    component.value.set([imageFile()]);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvFileUpload],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvFileUpload);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should enter cover state for a single image with a preview', () => {
    enableCover();

    expect(hostEl.classList).toContain('mlv-file-upload--cover');
    expect(hostEl.querySelector('.mlv-file-upload__cover-image')).toBeTruthy();
    expect(hostEl.querySelector('.mlv-file-upload__toolbar')).toBeTruthy();
  });

  it('should hide the prompt and browse button in cover state', () => {
    enableCover();

    expect(hostEl.querySelector('.mlv-file-upload__zone-title')).toBeNull();
    expect(hostEl.querySelector('.mlv-file-upload__zone-icon')).toBeNull();
    expect(hostEl.querySelector('.mlv-file-upload__zone-action')).toBeNull();
  });

  it('should stay in list mode while previewMode is the default "list"', () => {
    fixture.componentRef.setInput('multiple', false);
    component.value.set([imageFile()]);
    fixture.detectChanges();

    expect(hostEl.classList).not.toContain('mlv-file-upload--cover');
    expect(hostEl.querySelector('.mlv-file-upload__cover-image')).toBeNull();
    expect(hostEl.querySelector('.mlv-file-upload__zone-action')).toBeTruthy();
  });

  it('should fall back to list mode when multiple is true', () => {
    fixture.componentRef.setInput('previewMode', 'cover');
    fixture.componentRef.setInput('multiple', true);
    component.value.set([imageFile()]);
    fixture.detectChanges();

    expect(hostEl.classList).not.toContain('mlv-file-upload--cover');
    expect(hostEl.querySelector('.mlv-file-upload__zone-action')).toBeTruthy();
  });

  it('should fall back to list mode for a file with no preview URL', () => {
    fixture.componentRef.setInput('previewMode', 'cover');
    fixture.componentRef.setInput('multiple', false);
    component.value.set([documentFile()]);
    fixture.detectChanges();

    expect(hostEl.classList).not.toContain('mlv-file-upload--cover');
    expect(hostEl.querySelector('.mlv-file-upload__cover-image')).toBeNull();
  });

  it('should fall back to list mode when more than one file is present', () => {
    fixture.componentRef.setInput('previewMode', 'cover');
    fixture.componentRef.setInput('multiple', false);
    component.value.set([imageFile(), imageFile({ id: 'img-2' })]);
    fixture.detectChanges();

    expect(hostEl.classList).not.toContain('mlv-file-upload--cover');
  });

  it('should render the normal empty zone when nothing is selected', () => {
    fixture.componentRef.setInput('previewMode', 'cover');
    fixture.componentRef.setInput('multiple', false);
    fixture.detectChanges();

    expect(hostEl.classList).not.toContain('mlv-file-upload--cover');
    expect(hostEl.querySelector('.mlv-file-upload__zone-title')).toBeTruthy();
    expect(hostEl.querySelector('.mlv-file-upload__zone-action')).toBeTruthy();
  });

  it('should accept an edit-mode seed whose previewUrl is a remote URL', () => {
    fixture.componentRef.setInput('previewMode', 'cover');
    fixture.componentRef.setInput('multiple', false);
    component.value.set([
      imageFile({ previewUrl: 'https://cdn.example.com/hero.jpg' }),
    ]);
    fixture.detectChanges();

    const img = hostEl.querySelector('.mlv-file-upload__cover-image');
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/hero.jpg');
  });

  // -------------------------------------------------------------------------
  // Cover image
  // -------------------------------------------------------------------------

  describe('cover image', () => {
    it('should bind src to the previewUrl and alt to the file name', () => {
      enableCover();

      const img = hostEl.querySelector('.mlv-file-upload__cover-image');
      expect(img?.getAttribute('src')).toBe(PREVIEW);
      expect(img?.getAttribute('alt')).toBe('photo.png');
    });
  });

  // -------------------------------------------------------------------------
  // File list / errors
  // -------------------------------------------------------------------------

  describe('file list', () => {
    it('should hide the redundant file row in cover state', () => {
      enableCover();
      expect(hostEl.querySelector('.mlv-file-upload__list')).toBeNull();
    });

    it('should still render the file row in list mode', () => {
      fixture.componentRef.setInput('multiple', false);
      component.value.set([imageFile()]);
      fixture.detectChanges();

      expect(hostEl.querySelector('.mlv-file-upload__list')).toBeTruthy();
    });

    it('should still render validation errors below the cover', () => {
      enableCover();
      fixture.componentRef.setInput('accept', 'application/pdf');
      fixture.detectChanges();

      component['_errors'].set([{ code: 'type', message: 'Nope' }]);
      fixture.detectChanges();

      expect(hostEl.querySelector('.mlv-file-upload__errors')).toBeTruthy();
      expect(hostEl.classList).toContain('mlv-file-upload--cover');
    });
  });

  // -------------------------------------------------------------------------
  // Uploading overlay
  // -------------------------------------------------------------------------

  describe('uploading', () => {
    it('should overlay a progress bar while the covered file uploads', () => {
      fixture.componentRef.setInput('previewMode', 'cover');
      fixture.componentRef.setInput('multiple', false);
      component.value.set([imageFile({ state: 'uploading', progress: 40 })]);
      fixture.detectChanges();

      const progress = hostEl.querySelector(
        '.mlv-file-upload__cover-progress',
      ) as HTMLElement;
      expect(progress).toBeTruthy();
      // Stays in cover state — it does not fall back to the list layout.
      expect(hostEl.classList).toContain('mlv-file-upload--cover');
      expect(
        hostEl.querySelector('.mlv-file-upload__cover-image'),
      ).toBeTruthy();
    });

    it('should NOT overlay a progress bar once the upload succeeded', () => {
      enableCover();
      expect(
        hostEl.querySelector('.mlv-file-upload__cover-progress'),
      ).toBeNull();
    });

    it('should NOT overlay a progress bar at 100 percent', () => {
      fixture.componentRef.setInput('previewMode', 'cover');
      fixture.componentRef.setInput('multiple', false);
      component.value.set([imageFile({ state: 'uploading', progress: 100 })]);
      fixture.detectChanges();

      expect(
        hostEl.querySelector('.mlv-file-upload__cover-progress'),
      ).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Native title attribute
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvFileUpload],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // A STATIC attribute — this is what leaks into the DOM and would otherwise
  // give the whole zone a native browser tooltip duplicating the heading.
  template: `<mlv-file-upload title="Image" />`,
})
class StaticTitleHostComponent {}

describe('MlvFileUpload — title input', () => {
  it('should not leave a native title attribute on the host', async () => {
    await TestBed.configureTestingModule({
      imports: [StaticTitleHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(StaticTitleHostComponent);
    fixture.detectChanges();

    const upload = fixture.nativeElement.querySelector(
      'mlv-file-upload',
    ) as HTMLElement;

    expect(upload.hasAttribute('title')).toBe(false);
    // The heading still renders — only the tooltip-producing attribute is gone.
    expect(
      upload.querySelector('.mlv-file-upload__zone-title')?.textContent?.trim(),
    ).toBe('Image');
  });
});

// ---------------------------------------------------------------------------
// Cover toolbar — built-in buttons + projected actions
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvFileUpload, MlvFileUploadAction],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-file-upload
      [previewMode]="previewMode()"
      [multiple]="false"
      [disabled]="disabled()"
      [(value)]="files"
    >
      <button id="start-action" type="button" mlvFileUploadAction>AI</button>
      <button id="end-action" type="button" mlvFileUploadAction position="end">
        Crop
      </button>
    </mlv-file-upload>
  `,
})
class CoverHostComponent {
  readonly previewMode = signal<'list' | 'cover'>('cover');
  readonly disabled = signal(false);
  readonly files = signal<MlvUploadedFile[]>([imageFile()]);
}

describe('MlvFileUpload — cover toolbar', () => {
  let fixture: ComponentFixture<CoverHostComponent>;
  let host: CoverHostComponent;
  let hostEl: HTMLElement;

  /** The toolbar/action container's children, in DOM order. */
  function containerOrder(selector: string): string[] {
    const row = hostEl.querySelector(selector);
    return Array.from(row?.children ?? []).map((child) => {
      if (child.id) return child.id;
      const label = child.getAttribute('aria-label') ?? '';
      if (label === 'Replace file') return 'replace';
      if (label.startsWith('Remove')) return 'remove';
      return 'browse';
    });
  }

  /** The hidden `<input type="file">` whose `click()` opens the picker. */
  function fileInput(): HTMLInputElement {
    return hostEl.querySelector('.mlv-file-upload__input') as HTMLInputElement;
  }

  function replaceButton(): HTMLButtonElement {
    return hostEl.querySelector(
      '.mlv-file-upload__toolbar [aria-label="Replace file"]',
    ) as HTMLButtonElement;
  }

  function removeButton(): HTMLButtonElement {
    return hostEl.querySelector(
      '.mlv-file-upload__toolbar [aria-label="Remove photo.png"]',
    ) as HTMLButtonElement;
  }

  beforeEach(async () => {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [CoverHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CoverHostComponent);
    host = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should order the toolbar as [start actions, replace, end actions, remove]', () => {
    expect(containerOrder('.mlv-file-upload__toolbar')).toEqual([
      'start-action',
      'replace',
      'end-action',
      'remove',
    ]);
  });

  it('should label the replace button from the replaceFile i18n key', () => {
    expect(replaceButton()).toBeTruthy();
  });

  it('should label the remove button with the covered file name', () => {
    expect(removeButton()).toBeTruthy();
  });

  it('should open the file picker from the replace button', () => {
    const spy = vi.spyOn(fileInput(), 'click');

    replaceButton().click();
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  describe('replacing the covered image', () => {
    /** Builds a picked image `File`. */
    function png(name: string): File {
      return new File([new Blob(['x'], { type: 'image/png' })], name, {
        type: 'image/png',
      });
    }

    /** A `FileList`-shaped object; jsdom does not construct one. */
    function fileList(files: File[]): FileList {
      const list: Record<string | number, unknown> = {
        length: files.length,
        item: (index: number) => files[index] ?? null,
        [Symbol.iterator]: files[Symbol.iterator].bind(files),
      };
      files.forEach((file, index) => (list[index] = file));
      return list as unknown as FileList;
    }

    /** Simulates choosing `files` in the native picker the Replace action opens. */
    function pick(files: File[]): void {
      Object.defineProperty(fileInput(), 'files', {
        value: fileList(files),
        configurable: true,
      });
      fileInput().dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    /** Dispatches a real `drop` event on the covered zone. */
    function drop(files: File[]): void {
      const event = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', {
        value: { files: fileList(files) },
      });
      hostEl.querySelector('.mlv-file-upload__zone')?.dispatchEvent(event);
      fixture.detectChanges();
    }

    /** The `src` the cover image currently renders, or `null` without a cover. */
    function coverSource(): string | null {
      const image = hostEl.querySelector<HTMLImageElement>(
        '.mlv-file-upload__cover-image',
      );
      return image?.getAttribute('src') ?? null;
    }

    /** Every URL handed to `URL.revokeObjectURL`, in call order. */
    function revokedUrls(): string[] {
      return vi
        .mocked(URL.revokeObjectURL)
        .mock.calls.map(([url]) => String(url));
    }

    beforeEach(() => {
      let created = 0;
      vi.spyOn(URL, 'createObjectURL').mockImplementation(
        () => `blob:fake/${++created}`,
      );
      // The picker itself cannot open under jsdom; `pick()` stands in for it.
      vi.spyOn(fileInput(), 'click').mockImplementation(() => undefined);
      host.files.set([]);
      fixture.detectChanges();
    });

    it('should replace the covered image with the file picked from Replace', () => {
      pick([png('a.png')]);
      expect(coverSource()).toBe('blob:fake/1');

      replaceButton().click();
      pick([png('b.png')]);

      expect(host.files().map((file) => file.name)).toEqual(['b.png']);
      expect(hostEl.querySelector('.mlv-file-upload__errors')).toBeNull();
      expect(revokedUrls()).toEqual(['blob:fake/1']);
      expect(coverSource()).toBe('blob:fake/2');
    });

    it('should replace the covered image with a file dropped on the zone', () => {
      pick([png('a.png')]);

      drop([png('b.png')]);

      expect(host.files().map((file) => file.name)).toEqual(['b.png']);
      expect(hostEl.querySelector('.mlv-file-upload__errors')).toBeNull();
      expect(revokedUrls()).toEqual(['blob:fake/1']);
      expect(coverSource()).toBe('blob:fake/2');
    });
  });

  it('should clear the value from the remove button', () => {
    removeButton().click();
    fixture.detectChanges();

    expect(host.files()).toEqual([]);
    expect(hostEl.querySelector('.mlv-file-upload__cover-image')).toBeNull();
  });

  it('should leave cover state after removing the only file', () => {
    removeButton().click();
    fixture.detectChanges();

    const upload = hostEl.querySelector('mlv-file-upload') as HTMLElement;
    expect(upload.classList).not.toContain('mlv-file-upload--cover');
    expect(hostEl.querySelector('.mlv-file-upload__zone-action')).toBeTruthy();
  });

  it('should NOT open the picker from a projected action in the toolbar', () => {
    const spy = vi.spyOn(fileInput(), 'click');

    (hostEl.querySelector('#start-action') as HTMLElement).click();
    (hostEl.querySelector('#end-action') as HTMLElement).click();
    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
  });

  it('should disable both built-in toolbar buttons when the control is disabled', () => {
    host.disabled.set(true);
    fixture.detectChanges();

    expect(replaceButton().disabled).toBe(true);
    expect(removeButton().disabled).toBe(true);
  });

  it('should move the projected actions into the zone action row in list mode', () => {
    host.previewMode.set('list');
    fixture.detectChanges();

    expect(hostEl.querySelector('.mlv-file-upload__toolbar')).toBeNull();
    expect(containerOrder('.mlv-file-upload__zone-action')).toEqual([
      'start-action',
      'browse',
      'end-action',
    ]);
  });

  it('should move the projected actions back into the toolbar in cover mode', () => {
    host.previewMode.set('list');
    fixture.detectChanges();
    host.previewMode.set('cover');
    fixture.detectChanges();

    expect(hostEl.querySelector('.mlv-file-upload__zone-action')).toBeNull();
    expect(containerOrder('.mlv-file-upload__toolbar')).toEqual([
      'start-action',
      'replace',
      'end-action',
      'remove',
    ]);
  });
});
