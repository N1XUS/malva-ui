import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MlvFileUpload } from './file-upload';
import type { MlvUploadedFile } from './file-upload.types';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a synthetic File object with the given name, MIME type, and byte size. */
function makeFile(name: string, type = 'text/plain', sizeBytes = 100): File {
  const blob = new Blob(['x'.repeat(sizeBytes)], { type });
  return new File([blob], name, { type });
}

/**
 * Dispatches a synthetic DragEvent **without** using `DataTransfer` (not
 * supported in jsdom). We call the component's protected handler directly so
 * we can inject a real `dataTransfer.files` via `Object.defineProperty`.
 */
function dispatchDrop(component: MlvFileUpload, files: File[]): void {
  // Build a minimal object that satisfies the component's usage:
  // event.preventDefault() and event.dataTransfer.files
  const fileList = buildFileList(files);
  const fakeEvent = {
    preventDefault: vi.fn(),
    dataTransfer: { files: fileList },
    // relatedTarget not needed for drop
  } as unknown as DragEvent;
  component['_onDrop'](fakeEvent);
}

function dispatchDragOver(component: MlvFileUpload): void {
  const fakeEvent = { preventDefault: vi.fn() } as unknown as DragEvent;
  component['_onDragOver'](fakeEvent);
}

function dispatchDragLeave(
  component: MlvFileUpload,
  elementRef: HTMLElement,
  relatedTarget: Node | null = null,
): void {
  const fakeEvent = { relatedTarget } as unknown as DragEvent;
  component['_onDragLeave'](fakeEvent);
}

/**
 * Builds a minimal FileList-compatible object from an array of `File`s.
 * jsdom does not expose `DataTransfer` so we cannot use it here.
 */
function buildFileList(files: File[]): FileList {
  // Create a plain object that looks like FileList
  const fileListLike = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: files[Symbol.iterator].bind(files),
  };
  for (let i = 0; i < files.length; i++) {
    (fileListLike as Record<string, unknown>)[i] = files[i];
  }
  return fileListLike as unknown as FileList;
}

// ---------------------------------------------------------------------------
// Host wrapper for ReactiveFormsModule integration
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvFileUpload, ReactiveFormsModule],
  template: `
    <mlv-file-upload
      [formControl]="ctrl"
      [accept]="accept()"
      [maxSize]="maxSize()"
      [multiple]="multiple()"
    />
  `,
})
class FormsHostComponent {
  ctrl = new FormControl<MlvUploadedFile[]>([]);
  accept = signal('');
  maxSize = signal(0);
  multiple = signal(true);
}

// ---------------------------------------------------------------------------
// MlvFileUpload — standalone suite
// ---------------------------------------------------------------------------

describe('MlvFileUpload', () => {
  let component: MlvFileUpload;
  let fixture: ComponentFixture<MlvFileUpload>;
  let hostEl: HTMLElement;

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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Default host classes
  // -------------------------------------------------------------------------

  describe('default host classes', () => {
    it('should always have mlv-file-upload class', () => {
      expect(hostEl.classList).toContain('mlv-file-upload');
    });

    it('should NOT have drag-over class by default', () => {
      expect(hostEl.classList).not.toContain('mlv-file-upload--drag-over');
    });

    it('should NOT have disabled class by default', () => {
      expect(hostEl.classList).not.toContain('mlv-file-upload--disabled');
    });

    it('should NOT have has-files class by default', () => {
      expect(hostEl.classList).not.toContain('mlv-file-upload--has-files');
    });

    it('should have multiple class by default (multiple defaults to true)', () => {
      expect(hostEl.classList).toContain('mlv-file-upload--multiple');
    });

    it('should NOT have compact class by default', () => {
      expect(hostEl.classList).not.toContain('mlv-file-upload--compact');
    });
  });

  // -------------------------------------------------------------------------
  // compact input
  // -------------------------------------------------------------------------

  describe('compact input', () => {
    it('should add compact class when compact=true', () => {
      fixture.componentRef.setInput('compact', true);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-file-upload--compact');
    });

    it('should remove compact class when compact=false', () => {
      fixture.componentRef.setInput('compact', true);
      fixture.detectChanges();
      fixture.componentRef.setInput('compact', false);
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-file-upload--compact');
    });
  });

  // -------------------------------------------------------------------------
  // multiple input
  // -------------------------------------------------------------------------

  describe('multiple input', () => {
    it('should remove multiple class when multiple=false', () => {
      fixture.componentRef.setInput('multiple', false);
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-file-upload--multiple');
    });
  });

  // -------------------------------------------------------------------------
  // Drag state: dragover / dragleave
  // -------------------------------------------------------------------------

  describe('drag state', () => {
    it('should add drag-over class on dragover', () => {
      dispatchDragOver(component);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-file-upload--drag-over');
    });

    it('should remove drag-over class on dragleave when leaving the host', () => {
      dispatchDragOver(component);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-file-upload--drag-over');

      // relatedTarget = null → focus left the host boundary
      dispatchDragLeave(component, hostEl, null);
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-file-upload--drag-over');
    });

    it('should NOT set drag-over class when component is disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      dispatchDragOver(component);
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-file-upload--drag-over');
    });

    it('should clear drag-over state on drop', () => {
      dispatchDragOver(component);
      fixture.detectChanges();
      dispatchDrop(component, []);
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-file-upload--drag-over');
    });

    // The tests above call the handler directly and so pass whether or not
    // anything is listening. These dispatch a real event on the host element
    // and therefore cover the binding itself. jsdom has no `DragEvent`, but
    // `_onDragOver` reads only `preventDefault()`.
    it('should set the drag-over class from a dispatched dragover event', () => {
      hostEl.dispatchEvent(
        new Event('dragover', { bubbles: true, cancelable: true }),
      );
      fixture.detectChanges();

      expect(hostEl.classList).toContain('mlv-file-upload--drag-over');
    });

    it('should preventDefault dragover so the drop event can fire at all', () => {
      const event = new Event('dragover', { bubbles: true, cancelable: true });
      hostEl.dispatchEvent(event);

      // Without this the browser applies its default "no drop allowed"
      // handling and never dispatches `drop`.
      expect(event.defaultPrevented).toBe(true);
    });

    it('should still preventDefault dragover while disabled, without the class', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const event = new Event('dragover', { bubbles: true, cancelable: true });
      hostEl.dispatchEvent(event);
      fixture.detectChanges();

      expect(event.defaultPrevented).toBe(true);
      expect(hostEl.classList).not.toContain('mlv-file-upload--drag-over');
    });
  });

  // -------------------------------------------------------------------------
  // Signal model writes
  // -------------------------------------------------------------------------

  describe('value model', () => {
    it('should accept an array of MlvUploadedFile objects', () => {
      const files: MlvUploadedFile[] = [
        {
          id: '1',
          file: makeFile('a.txt'),
          name: 'a.txt',
          size: 100,
          state: 'pending',
        },
      ];
      component.value.set(files);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-file-upload--has-files');
    });

    it('should accept null and clear the file list', () => {
      const files: MlvUploadedFile[] = [
        {
          id: '1',
          file: makeFile('a.txt'),
          name: 'a.txt',
          size: 100,
          state: 'pending',
        },
      ];
      component.value.set(files);
      fixture.detectChanges();
      component.value.set([]);
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-file-upload--has-files');
    });

    it('should render file items after a model write', () => {
      const files: MlvUploadedFile[] = [
        {
          id: '42',
          file: makeFile('doc.pdf'),
          name: 'doc.pdf',
          size: 2048,
          state: 'pending',
        },
      ];
      component.value.set(files);
      fixture.detectChanges();
      const list = hostEl.querySelector('.mlv-file-upload__list');
      expect(list).toBeTruthy();
      expect(list?.querySelectorAll('li').length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Signal model changes
  // -------------------------------------------------------------------------

  describe('value changes', () => {
    it('should update the model when a file is dropped', () => {
      dispatchDrop(component, [makeFile('x.txt')]);
      fixture.detectChanges();

      const emittedFiles = component.value();
      expect(emittedFiles.length).toBe(1);
      expect(emittedFiles[0].name).toBe('x.txt');
    });

    it('should update the model when a file is removed', () => {
      const file: MlvUploadedFile = {
        id: 'rm-1',
        file: makeFile('r.txt'),
        name: 'r.txt',
        size: 50,
        state: 'pending',
      };
      component.value.set([file]);
      fixture.detectChanges();

      component.removeFile('rm-1');
      expect(component.value()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Disabled input
  // -------------------------------------------------------------------------

  describe('disabled', () => {
    it('should add disabled class when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-file-upload--disabled');
    });

    it('should remove disabled class when re-enabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-file-upload--disabled');
    });

    it('should disable the browse button when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      const btn = fixture.debugElement.query(By.css('button[mlvButton]'));
      expect(btn.nativeElement.disabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // File type validation
  // -------------------------------------------------------------------------

  describe('file type validation', () => {
    it('should reject a file whose MIME type is not accepted', () => {
      fixture.componentRef.setInput('accept', 'image/*');
      fixture.detectChanges();

      dispatchDrop(component, [makeFile('doc.pdf', 'application/pdf')]);
      fixture.detectChanges();

      const errors = hostEl.querySelector('.mlv-file-upload__errors');
      expect(errors).toBeTruthy();
      // Resolved from the fileUpload.errorFileType ICU template, not a
      // hard-coded English string.
      expect(errors?.textContent?.trim()).toBe(
        'File type not accepted: doc.pdf',
      );
    });

    it('should accept a file whose MIME type matches', () => {
      fixture.componentRef.setInput('accept', 'image/*');
      fixture.detectChanges();

      dispatchDrop(component, [makeFile('photo.png', 'image/png')]);
      fixture.detectChanges();

      expect(hostEl.querySelector('.mlv-file-upload__errors')).toBeNull();
      expect(hostEl.classList).toContain('mlv-file-upload--has-files');
    });

    it('should accept a file matching an extension-based accept pattern', () => {
      fixture.componentRef.setInput('accept', '.pdf');
      fixture.detectChanges();

      dispatchDrop(component, [makeFile('report.pdf', 'application/pdf')]);
      fixture.detectChanges();

      expect(hostEl.querySelector('.mlv-file-upload__errors')).toBeNull();
    });

    it('should reject a file not matching extension-based accept pattern', () => {
      fixture.componentRef.setInput('accept', '.pdf');
      fixture.detectChanges();

      dispatchDrop(component, [makeFile('photo.png', 'image/png')]);
      fixture.detectChanges();

      expect(hostEl.querySelector('.mlv-file-upload__errors')).toBeTruthy();
    });

    it('should show error class on host when type validation fails', () => {
      fixture.componentRef.setInput('accept', 'image/*');
      fixture.detectChanges();

      dispatchDrop(component, [makeFile('doc.pdf', 'application/pdf')]);
      fixture.detectChanges();

      expect(hostEl.classList).toContain('mlv-file-upload--error');
    });
  });

  // -------------------------------------------------------------------------
  // File size validation
  // -------------------------------------------------------------------------

  describe('file size validation', () => {
    it('should reject a file that exceeds maxSize', () => {
      fixture.componentRef.setInput('maxSize', 50); // 50 bytes
      fixture.detectChanges();

      dispatchDrop(component, [makeFile('big.txt', 'text/plain', 200)]);
      fixture.detectChanges();

      const errors = hostEl.querySelector('.mlv-file-upload__errors');
      expect(errors).toBeTruthy();
      // Resolved from the fileUpload.errorFileSize ICU template with both the
      // file name and the megabyte limit interpolated.
      expect(errors?.textContent?.trim()).toBe(
        '"big.txt" exceeds the 0.0 MB limit.',
      );
    });

    it('should accept a file within maxSize', () => {
      fixture.componentRef.setInput('maxSize', 500);
      fixture.detectChanges();

      dispatchDrop(component, [makeFile('small.txt', 'text/plain', 100)]);
      fixture.detectChanges();

      expect(hostEl.querySelector('.mlv-file-upload__errors')).toBeNull();
      expect(hostEl.classList).toContain('mlv-file-upload--has-files');
    });

    it('should allow any size when maxSize is 0 (default)', () => {
      dispatchDrop(component, [makeFile('huge.txt', 'text/plain', 9999)]);
      fixture.detectChanges();

      expect(hostEl.querySelector('.mlv-file-upload__errors')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Single-file mode (multiple=false)
  // -------------------------------------------------------------------------

  describe('single-file mode (multiple=false)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('multiple', false);
      fixture.detectChanges();
    });

    it('should reject a second file when one is already present', () => {
      dispatchDrop(component, [makeFile('first.txt')]);
      fixture.detectChanges();

      // Second drop should produce a count error, not add a second item
      dispatchDrop(component, [makeFile('second.txt')]);
      fixture.detectChanges();

      // The list should have only one entry
      const items = hostEl.querySelectorAll('.mlv-file-upload__list li');
      expect(items.length).toBe(1);
    });

    it('should show a count error when second file is dropped', () => {
      dispatchDrop(component, [makeFile('a.txt')]);
      fixture.detectChanges();

      dispatchDrop(component, [makeFile('b.txt')]);
      fixture.detectChanges();

      const errors = hostEl.querySelector('.mlv-file-upload__errors');
      expect(errors).toBeTruthy();
      expect(errors?.textContent?.trim()).toBe('Only one file is allowed.');
    });

    it('should accept a new file after removing the existing one', () => {
      dispatchDrop(component, [makeFile('a.txt')]);
      fixture.detectChanges();

      const id = component['_files']()[0].id;
      component.removeFile(id);
      fixture.detectChanges();

      dispatchDrop(component, [makeFile('b.txt')]);
      fixture.detectChanges();

      const items = hostEl.querySelectorAll('.mlv-file-upload__list li');
      expect(items.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple files
  // -------------------------------------------------------------------------

  describe('multiple files mode', () => {
    it('should accumulate multiple files dropped across separate events', () => {
      dispatchDrop(component, [makeFile('a.txt')]);
      fixture.detectChanges();
      dispatchDrop(component, [makeFile('b.txt')]);
      fixture.detectChanges();

      const items = hostEl.querySelectorAll('.mlv-file-upload__list li');
      expect(items.length).toBe(2);
    });

    it('should add all files from a single drop event', () => {
      dispatchDrop(component, [
        makeFile('x.txt'),
        makeFile('y.txt'),
        makeFile('z.txt'),
      ]);
      fixture.detectChanges();

      const items = hostEl.querySelectorAll('.mlv-file-upload__list li');
      expect(items.length).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // removeFile
  // -------------------------------------------------------------------------

  describe('removeFile', () => {
    it('should remove the file with the given id', () => {
      const file: MlvUploadedFile = {
        id: 'del-1',
        file: makeFile('remove-me.txt'),
        name: 'remove-me.txt',
        size: 10,
        state: 'pending',
      };
      component.value.set([file]);
      fixture.detectChanges();

      component.removeFile('del-1');
      fixture.detectChanges();

      expect(hostEl.classList).not.toContain('mlv-file-upload--has-files');
    });

    it('should call filesChange output when a file is removed', () => {
      const emitted: MlvUploadedFile[][] = [];
      component.filesChange.subscribe((v) => emitted.push(v));

      const file: MlvUploadedFile = {
        id: 'del-2',
        file: makeFile('rm.txt'),
        name: 'rm.txt',
        size: 10,
        state: 'pending',
      };
      component.value.set([file]);
      fixture.detectChanges();

      component.removeFile('del-2');
      expect(emitted.length).toBe(1);
      expect(emitted[0]).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Error list ARIA
  // -------------------------------------------------------------------------

  describe('error list ARIA', () => {
    it('should render errors in a [role=alert] element with aria-live=assertive', () => {
      fixture.componentRef.setInput('accept', 'image/*');
      fixture.detectChanges();

      dispatchDrop(component, [makeFile('bad.pdf', 'application/pdf')]);
      fixture.detectChanges();

      const alertEl = hostEl.querySelector('[role="alert"]');
      expect(alertEl).toBeTruthy();
      expect(alertEl?.getAttribute('aria-live')).toBe('assertive');
    });
  });

  // -------------------------------------------------------------------------
  // File list ARIA
  // -------------------------------------------------------------------------

  describe('file list ARIA', () => {
    it('should render the file list with aria-label="Selected files"', () => {
      component.value.set([
        {
          id: '1',
          file: makeFile('f.txt'),
          name: 'f.txt',
          size: 10,
          state: 'pending',
        },
      ]);
      fixture.detectChanges();

      const list = hostEl.querySelector('.mlv-file-upload__list');
      expect(list?.getAttribute('aria-label')).toBe('Selected files');
    });

    it('should have aria-live=polite on the file list', () => {
      component.value.set([
        {
          id: '1',
          file: makeFile('f.txt'),
          name: 'f.txt',
          size: 10,
          state: 'pending',
        },
      ]);
      fixture.detectChanges();

      const list = hostEl.querySelector('.mlv-file-upload__list');
      expect(list?.getAttribute('aria-live')).toBe('polite');
    });
  });

  // -------------------------------------------------------------------------
  // filesChange output
  // -------------------------------------------------------------------------

  describe('filesChange output', () => {
    it('should emit filesChange when a valid file is dropped', () => {
      const emitted: MlvUploadedFile[][] = [];
      component.filesChange.subscribe((v) => emitted.push(v));

      dispatchDrop(component, [makeFile('x.txt')]);
      fixture.detectChanges();

      expect(emitted.length).toBe(1);
      expect(emitted[0].length).toBe(1);
      expect(emitted[0][0].name).toBe('x.txt');
    });
  });

  // -------------------------------------------------------------------------
  // Disabled: drop / file picker are suppressed
  // -------------------------------------------------------------------------

  describe('disabled state', () => {
    it('should NOT add files when disabled on drop', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      dispatchDrop(component, [makeFile('blocked.txt')]);
      fixture.detectChanges();

      expect(hostEl.classList).not.toContain('mlv-file-upload--has-files');
    });
  });

  // -------------------------------------------------------------------------
  // Image preview URL generation
  // -------------------------------------------------------------------------

  describe('image preview URL', () => {
    it('should attach a previewUrl for image files', () => {
      // Stub URL.createObjectURL since jsdom does not implement it
      const fakeUrl = 'blob:fake-url';
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(fakeUrl);

      dispatchDrop(component, [makeFile('photo.png', 'image/png')]);
      fixture.detectChanges();

      const files = component['_files']();
      expect(files[0].previewUrl).toBe(fakeUrl);

      vi.restoreAllMocks();
    });

    it('should NOT attach a previewUrl for non-image files', () => {
      dispatchDrop(component, [makeFile('doc.pdf', 'application/pdf')]);
      fixture.detectChanges();

      const files = component['_files']();
      expect(files[0].previewUrl).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// MlvFileUpload — ReactiveFormsModule integration
// ---------------------------------------------------------------------------

describe('MlvFileUpload — ReactiveFormsModule', () => {
  let hostFixture: ComponentFixture<FormsHostComponent>;
  let hostComp: FormsHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    hostFixture = TestBed.createComponent(FormsHostComponent);
    hostComp = hostFixture.componentInstance;
    hostFixture.detectChanges();
    await hostFixture.whenStable();
  });

  it('should create the host', () => {
    expect(hostComp).toBeTruthy();
  });

  it('should disable the component when FormControl is disabled', () => {
    hostComp.ctrl.disable();
    hostFixture.detectChanges();

    const mlvEl = hostFixture.nativeElement.querySelector(
      'mlv-file-upload',
    ) as HTMLElement;
    expect(mlvEl.classList).toContain('mlv-file-upload--disabled');
  });

  it('should re-enable the component when FormControl is re-enabled', () => {
    hostComp.ctrl.disable();
    hostFixture.detectChanges();
    hostComp.ctrl.enable();
    hostFixture.detectChanges();

    const mlvEl = hostFixture.nativeElement.querySelector(
      'mlv-file-upload',
    ) as HTMLElement;
    expect(mlvEl.classList).not.toContain('mlv-file-upload--disabled');
  });
});

// ---------------------------------------------------------------------------
// Stylesheet — compiled once; assertions read declarations by selector.
// ---------------------------------------------------------------------------

// `sass` is a Node-only dependency; loading it through `createRequire` keeps
// it out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

/**
 * Declarations of every emitted rule whose selector list contains exactly
 * `selector`, joined. Sass splits a block around a nested rule and emits
 * shared declarations under one comma-separated selector list, so one
 * selector can own several blocks and share others.
 */
function cssRule(css: string, selector: string): string {
  const bodies: string[] = [];
  for (const [, head, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = head
      .trim()
      .split(/,\s*/)
      .map((candidate) => candidate.trim());
    if (selectors.includes(selector)) bodies.push(body);
  }
  expect(bodies.length, `rule "${selector}" is emitted`).toBeGreaterThan(0);
  return bodies.join('\n');
}

describe('MlvFileUpload hidden native input containment', () => {
  const css = stripCssLayersFromText(
    sass.compile(
      resolve(dirname(fileURLToPath(import.meta.url)), 'file-upload.scss'),
    ).css,
  );

  // The native input is visually hidden with the `position: absolute` +
  // `clip-path` pattern. An absolutely positioned box is laid out against its
  // nearest *positioned* ancestor — with none inside the control, that is
  // whatever the page happens to provide. Inside a drawer or dialog body it is
  // the scrollbar host *outside* the scroll viewport: the 1px box then sits at
  // its static position in that host's coordinate space, never moves with the
  // viewport's scroll, inflates the body's scrollable overflow and, the moment
  // the label is clicked, makes the browser scroll the `overflow: hidden`
  // body to reveal the focused input — the content jumps out of view while the
  // real viewport stays put. jsdom lays nothing out, so the containing block
  // is pinned through the declaration that establishes it.
  it('is positioned so the visually-hidden native input is contained by the control', () => {
    expect(cssRule(css, '.mlv-file-upload')).toContain('position: relative');
    expect(cssRule(css, '.mlv-file-upload__input')).toContain(
      'position: absolute',
    );
  });
});
