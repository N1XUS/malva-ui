import { ApplicationRef, Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { Extensions } from '@tiptap/core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
import {
  MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS,
  MLV_EDITOR_IMAGE_UPLOADER,
  MlvEditor,
  MlvEditorImageUploadControl,
  type MlvEditorImageUploader,
  MlvEditorToolbar,
  mlvEditorDefaultExtensions,
  mlvEditorFormattingExtensions,
} from '../..';

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const imageFile = (name = 'photo.png', type = 'image/png'): File =>
  new File(['image'], name, { type });

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      [imageUploader]="uploader()"
      [imageUploadOptions]="options()"
      [extensions]="extensions()"
      [readonly]="readonly()"
      [disabled]="disabled()"
    />
  `,
})
class ImageUploadHost {
  readonly editor = viewChild.required(MlvEditor);
  readonly uploader = signal<MlvEditorImageUploader | undefined>(undefined);
  readonly options = signal(MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS);
  readonly extensions = signal<Extensions | undefined>(undefined);
  readonly readonly = signal(false);
  readonly disabled = signal(false);
}

@Component({
  imports: [MlvEditor, MlvEditorToolbar],
  template: `
    <mlv-editor
      #editor
      [imageUploader]="uploader()"
      [extensions]="extensions()"
    />
    <mlv-editor-toolbar [context]="editor" />
  `,
})
class StandaloneToolbarHost {
  readonly editor = viewChild.required(MlvEditor);
  readonly uploader = signal<MlvEditorImageUploader | undefined>(undefined);
  readonly extensions = signal<Extensions | undefined>(undefined);
}

describe('MlvEditor image upload UI', () => {
  async function createHost(
    uploader?: MlvEditorImageUploader,
    extensions?: Extensions,
  ): Promise<ComponentFixture<ImageUploadHost>> {
    await TestBed.configureTestingModule({
      imports: [ImageUploadHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ImageUploadHost);
    fixture.componentInstance.uploader.set(uploader);
    fixture.componentInstance.extensions.set(extensions);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  async function createStandaloneHost(
    uploader?: MlvEditorImageUploader,
    extensions?: Extensions,
    injectedUploader?: MlvEditorImageUploader,
  ): Promise<ComponentFixture<StandaloneToolbarHost>> {
    await TestBed.configureTestingModule({
      imports: [StandaloneToolbarHost],
      providers: [
        provideMlvI18nTesting(),
        ...(injectedUploader
          ? [
              {
                provide: MLV_EDITOR_IMAGE_UPLOADER,
                useValue: injectedUploader,
              },
            ]
          : []),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(StandaloneToolbarHost);
    fixture.componentInstance.uploader.set(uploader);
    fixture.componentInstance.extensions.set(extensions);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  async function stabilize(
    fixture:
      | ComponentFixture<ImageUploadHost>
      | ComponentFixture<StandaloneToolbarHost>,
  ): Promise<void> {
    fixture.detectChanges();
    await TestBed.inject(ApplicationRef).whenStable();
    fixture.detectChanges();
  }

  function button(name: string): HTMLButtonElement | null {
    return (
      Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .filter(
          (candidate) =>
            !candidate.closest('[hidden]') &&
            (candidate.getAttribute('aria-label') === name ||
              candidate.textContent?.trim() === name),
        )
        .at(-1) ?? null
    );
  }

  function dialogButton(name: string): HTMLButtonElement | null {
    return (
      Array.from(
        document.querySelectorAll<HTMLButtonElement>('.mlv-dialog button'),
      ).find(
        (candidate) =>
          candidate.getAttribute('aria-label') === name ||
          candidate.textContent?.trim() === name,
      ) ?? null
    );
  }

  function standaloneButton(
    fixture: ComponentFixture<StandaloneToolbarHost>,
    name: string,
  ): HTMLButtonElement | null {
    return (
      Array.from(
        fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
          'mlv-editor-toolbar button',
        ),
      ).find(
        (candidate) =>
          !candidate.closest('[hidden]') &&
          (candidate.getAttribute('aria-label') === name ||
            candidate.textContent?.trim() === name),
      ) ?? null
    );
  }

  function selectFile(file: File): void {
    const input = document.querySelector<HTMLInputElement>(
      '.mlv-file-upload__input',
    );
    expect(input).not.toBeNull();
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input?.dispatchEvent(new Event('change'));
  }

  function setInput(label: string, value: string): void {
    const input = Array.from(
      document.querySelectorAll<HTMLInputElement>('.mlv-input__native'),
    ).find((candidate) => candidate.getAttribute('aria-label') === label);
    expect(input).not.toBeUndefined();
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function finishDialogClose(): void {
    document
      .querySelector('.mlv-dialog')
      ?.dispatchEvent(new Event('animationend'));
  }

  function pasteFiles(
    fixture: ComponentFixture<ImageUploadHost>,
    files: readonly File[],
  ): void {
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', {
      value: {
        files,
        types: ['Files'],
        getData: () => '',
      },
    });
    fixture.componentInstance.editor().editor()?.view.dom.dispatchEvent(paste);
  }

  function statusAnnouncement(
    fixture: ComponentFixture<ImageUploadHost>,
  ): string {
    return (
      fixture.nativeElement.querySelector<HTMLElement>(
        '.mlv-editor-image-upload-status__live',
      )?.textContent ?? ''
    ).trim();
  }

  function dialogAnnouncement(): string {
    return (
      document.querySelector<HTMLElement>(
        '.mlv-editor-image-upload-dialog__live',
      )?.textContent ?? ''
    ).trim();
  }

  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => element.remove());
    vi.restoreAllMocks();
  });

  it('shows the enabled image trigger after Link, Table, and Block inserts only when upload is supported', async () => {
    const uploader = {
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.test/photo.png' }),
    };
    const fixture = await createHost(uploader);

    const toolbarButtons = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button'),
    );
    const labels = toolbarButtons.map((candidate) =>
      candidate.getAttribute('aria-label'),
    );
    expect(labels.indexOf('Link')).toBeLessThan(labels.indexOf('Table'));
    expect(labels.indexOf('Table')).toBeLessThan(labels.indexOf('Blockquote'));
    expect(labels.indexOf('Blockquote')).toBeLessThan(
      labels.indexOf('Upload image'),
    );
    expect(button('Upload image')?.getAttribute('aria-pressed')).toBe('false');

    fixture.componentInstance.readonly.set(true);
    await stabilize(fixture);
    expect(button('Upload image')).toBeNull();
  });

  it('omits upload from a complete replacement without image support', async () => {
    await createHost(
      {
        upload: vi
          .fn()
          .mockResolvedValue({ src: 'https://cdn.test/photo.png' }),
      },
      mlvEditorFormattingExtensions(),
    );
    expect(button('Upload image')).toBeNull();
  });

  it('stays hidden without an adapter and disables while the editor is disabled', async () => {
    const fixture = await createHost();
    expect(button('Upload image')).toBeNull();

    fixture.componentInstance.uploader.set({
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.test/photo.png' }),
    });
    await stabilize(fixture);
    expect(button('Upload image')).not.toBeNull();

    fixture.componentInstance.disabled.set(true);
    await stabilize(fixture);
    expect(button('Upload image')?.disabled).toBe(true);
  });

  it('forwards the exact input-owned upload capability to a standalone toolbar', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:standalone-input');
    const uploader = {
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.test/input.png' }),
    };
    const fixture = await createStandaloneHost(uploader);

    expect(standaloneButton(fixture, 'Upload image')).not.toBeNull();
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
        'mlv-editor-toolbar button',
      ),
    ).map((candidate) => candidate.getAttribute('aria-label'));
    expect(labels.indexOf('Link')).toBeLessThan(labels.indexOf('Table'));
    expect(labels.indexOf('Table')).toBeLessThan(labels.indexOf('Blockquote'));
    expect(labels.indexOf('Blockquote')).toBeLessThan(
      labels.indexOf('Upload image'),
    );

    standaloneButton(fixture, 'Upload image')?.click();
    await stabilize(fixture);
    selectFile(imageFile());
    await stabilize(fixture);
    setInput('Alternative text', 'Standalone image');
    dialogButton('Upload image')?.click();
    await stabilize(fixture);

    expect(uploader.upload).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.editor().editor()?.getHTML()).toContain(
      'input.png',
    );
  });

  it('exposes the editor-owned upload capability as a nominal public control', async () => {
    const fixture = await createStandaloneHost({
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.test/image.png' }),
    });

    expect(fixture.componentInstance.editor().imageUpload).toBeInstanceOf(
      MlvEditorImageUploadControl,
    );
  });

  it('forwards the exact injected upload capability to a standalone toolbar', async () => {
    const uploader = {
      upload: vi
        .fn()
        .mockResolvedValue({ src: 'https://cdn.test/injected.png' }),
    };
    const fixture = await createStandaloneHost(undefined, undefined, uploader);

    expect(standaloneButton(fixture, 'Upload image')).not.toBeNull();
  });

  it('keeps a standalone toolbar hidden without an upload adapter', async () => {
    const fixture = await createStandaloneHost();

    expect(standaloneButton(fixture, 'Upload image')).toBeNull();
  });

  it('keeps standalone replacement-extension parity for image support', async () => {
    const uploader = {
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.test/input.png' }),
    };
    const fixture = await createStandaloneHost(
      uploader,
      mlvEditorFormattingExtensions(),
    );

    expect(standaloneButton(fixture, 'Upload image')).toBeNull();
  });

  it('opens a named Malva dialog with configured single-file controls and restores trigger focus', async () => {
    const fixture = await createHost({
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.test/photo.png' }),
    });
    const trigger = button('Upload image');
    trigger?.focus();
    trigger?.click();
    await stabilize(fixture);

    const dialog = document.querySelector<HTMLElement>('.mlv-dialog-container');
    const fileInput = document.querySelector<HTMLInputElement>(
      '.mlv-file-upload__input',
    );
    expect(dialog?.getAttribute('role')).toBe('dialog');
    const titleId = dialog?.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    expect(
      document.getElementById(titleId as string)?.textContent?.trim(),
    ).toBe('Upload image');
    expect(
      dialog?.querySelector('.mlv-dialog__header .mlv-dialog__close'),
    ).not.toBeNull();
    expect(
      document.querySelector(
        '.mlv-dialog-container > mlv-editor-image-upload-dialog',
      ),
    ).not.toBeNull();
    expect(
      document.querySelector(
        'mlv-editor-image-upload-dialog > mlv-dialog > mlv-dialog-footer',
      ),
    ).not.toBeNull();
    expect(
      document.querySelector(
        'mlv-editor-image-upload-dialog > mlv-dialog > mlv-dialog-body',
      ),
    ).not.toBeNull();
    expect(fileInput?.accept).toBe('image/*');
    expect(fileInput?.multiple).toBe(false);
    expect(document.querySelector('mlv-input')).not.toBeNull();
    expect(document.querySelector('mlv-switch')).not.toBeNull();

    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    finishDialogClose();
    await stabilize(fixture);
    expect(document.activeElement).toBe(trigger);
  });

  it('requires trimmed alt text, submits normalized metadata once, and never serializes its preview URL', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dialog-preview');
    const revokePreview = vi.spyOn(URL, 'revokeObjectURL');
    const request = deferred<{ src: string }>();
    const uploader: MlvEditorImageUploader = {
      upload: vi.fn(() => request.promise),
    };
    const fixture = await createHost(uploader);
    button('Upload image')?.click();
    await stabilize(fixture);
    selectFile(imageFile());
    await stabilize(fixture);

    expect(
      document.querySelector<HTMLImageElement>(
        '.mlv-editor-image-upload-dialog__preview',
      )?.src,
    ).toContain('blob:dialog-preview');
    dialogButton('Upload image')?.click();
    await stabilize(fixture);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Alternative text is required.',
    );
    expect(uploader.upload).not.toHaveBeenCalled();

    setInput('Alternative text', '  A mountain  ');
    setInput('Image title', '  Sunrise  ');
    dialogButton('Upload image')?.click();
    dialogButton('Upload image')?.click();
    await stabilize(fixture);

    expect(uploader.upload).toHaveBeenCalledTimes(1);
    expect(
      fixture.componentInstance.editor().editor()?.getHTML(),
    ).not.toContain('blob:dialog-preview');

    request.resolve({ src: 'https://cdn.test/final.png' });
    await stabilize(fixture);
    expect(revokePreview).toHaveBeenCalledExactlyOnceWith(
      'blob:dialog-preview',
    );
    finishDialogClose();
    expect(
      fixture.componentInstance.editor().editor()?.getJSON().content?.[0],
    ).toMatchObject({
      type: 'image',
      attrs: {
        src: 'https://cdn.test/final.png',
        alt: 'A mountain',
        title: 'Sunrise',
      },
    });
  });

  it('submits an empty alt for decorative images', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:decorative');
    const uploader = {
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.test/final.png' }),
    };
    const fixture = await createHost(uploader);
    button('Upload image')?.click();
    await stabilize(fixture);
    selectFile(imageFile());
    await stabilize(fixture);
    setInput('Alternative text', 'discard this draft');
    document
      .querySelector<HTMLInputElement>('mlv-switch input[role="switch"]')
      ?.click();
    dialogButton('Upload image')?.click();
    await stabilize(fixture);

    expect(
      fixture.componentInstance.editor().editor()?.getJSON().content?.[0],
    ).toMatchObject({
      type: 'image',
      attrs: { alt: '' },
    });
  });

  it('renders progress outside serialized content and supports cancel', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cancel');
    const request = deferred<{ src: string }>();
    let uploadContext:
      | {
          readonly signal: AbortSignal;
          readonly reportProgress: (progress: number) => void;
        }
      | undefined;
    const uploader: MlvEditorImageUploader = {
      upload: vi.fn((_, context) => {
        uploadContext = context;
        return request.promise;
      }),
    };
    const fixture = await createHost(uploader);
    button('Upload image')?.click();
    await stabilize(fixture);
    selectFile(imageFile());
    await stabilize(fixture);
    setInput('Alternative text', 'Alt');
    dialogButton('Upload image')?.click();
    uploadContext?.reportProgress(42);
    await stabilize(fixture);
    const dialogLive = document.querySelector<HTMLElement>(
      '.mlv-editor-image-upload-dialog__live',
    );

    expect(document.querySelector('mlv-progress')).not.toBeNull();
    expect(
      document.querySelector('[aria-live="polite"]')?.textContent,
    ).toContain('40');
    expect(
      fixture.componentInstance.editor().editor()?.getHTML(),
    ).not.toContain('42');

    fixture.nativeElement
      .querySelector<HTMLButtonElement>(
        '.mlv-editor-image-upload-status [aria-label="Cancel upload"]',
      )
      ?.click();
    await stabilize(fixture);
    expect(uploadContext?.signal.aborted).toBe(true);
    expect(statusAnnouncement(fixture)).toBe('Cancel upload');
    expect(dialogLive?.textContent).not.toContain('Upload complete');
  });

  it.each(['Escape', 'backdrop'] as const)(
    'does not announce completion when %s dismisses an active button upload',
    async (dismissal) => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dismiss');
      const request = deferred<{ src: string }>();
      let signal: AbortSignal | undefined;
      const fixture = await createHost({
        upload: vi.fn((_, context) => {
          signal = context.signal;
          return request.promise;
        }),
      });
      button('Upload image')?.click();
      await stabilize(fixture);
      selectFile(imageFile());
      await stabilize(fixture);
      setInput('Alternative text', 'Alt');
      dialogButton('Upload image')?.click();
      await stabilize(fixture);
      const dialogLive = document.querySelector<HTMLElement>(
        '.mlv-editor-image-upload-dialog__live',
      );

      if (dismissal === 'Escape') {
        document
          .querySelector('.mlv-dialog')
          ?.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
          );
      } else {
        document.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
      }
      await stabilize(fixture);

      expect(signal?.aborted).toBe(true);
      expect(dialogLive?.textContent).not.toContain('Upload complete');
    },
  );

  it.each(['disabled', 'readonly'] as const)(
    'does not announce completion when %s closes an active button dialog',
    async (state) => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:lifecycle');
      const request = deferred<{ src: string }>();
      let signal: AbortSignal | undefined;
      const fixture = await createHost({
        upload: vi.fn((_, context) => {
          signal = context.signal;
          return request.promise;
        }),
      });
      button('Upload image')?.click();
      await stabilize(fixture);
      selectFile(imageFile());
      await stabilize(fixture);
      setInput('Alternative text', 'Alt');
      dialogButton('Upload image')?.click();
      await stabilize(fixture);
      const dialogLive = document.querySelector<HTMLElement>(
        '.mlv-editor-image-upload-dialog__live',
      );

      fixture.componentInstance[state].set(true);
      await stabilize(fixture);

      expect(signal?.aborted).toBe(true);
      expect(dialogLive?.textContent).not.toContain('Upload complete');
    },
  );

  it('announces completion when a pasted image leaves uploading state successfully', async () => {
    const request = deferred<{ src: string }>();
    let reportProgress: ((progress: number) => void) | undefined;
    const fixture = await createHost({
      upload: vi.fn((_, context) => {
        reportProgress = context.reportProgress;
        return request.promise;
      }),
    });

    pasteFiles(fixture, [imageFile()]);
    reportProgress?.(47);
    await stabilize(fixture);
    expect(statusAnnouncement(fixture)).toContain('40');

    request.resolve({ src: 'https://cdn.test/pasted.png' });
    await stabilize(fixture);

    expect(statusAnnouncement(fixture)).toBe('Upload complete');
  });

  it('does not announce completion when a failed pasted image is removed', async () => {
    const fixture = await createHost({
      upload: vi.fn().mockRejectedValue(new Error('network')),
    });

    pasteFiles(fixture, [imageFile()]);
    await stabilize(fixture);
    expect(statusAnnouncement(fixture)).toBe('Image upload failed.');

    fixture.nativeElement
      .querySelector<HTMLButtonElement>(
        '.mlv-editor-image-upload-status [aria-label="Remove photo.png"]',
      )
      ?.click();
    await stabilize(fixture);

    expect(statusAnnouncement(fixture)).not.toBe('Upload complete');
  });

  it.each(['disabled', 'readonly'] as const)(
    'does not announce completion when %s lifecycle aborts a pasted image',
    async (state) => {
      const request = deferred<{ src: string }>();
      let signal: AbortSignal | undefined;
      const fixture = await createHost({
        upload: vi.fn((_, context) => {
          signal = context.signal;
          return request.promise;
        }),
      });

      pasteFiles(fixture, [imageFile()]);
      await stabilize(fixture);
      fixture.componentInstance[state].set(true);
      await stabilize(fixture);

      expect(signal?.aborted).toBe(true);
      expect(statusAnnouncement(fixture)).not.toBe('Upload complete');
    },
  );

  it('keeps a failed dialog open with retry and remove actions', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:failed');
    const retry = deferred<{ src: string }>();
    const uploader = {
      upload: vi
        .fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockImplementationOnce(() => retry.promise),
    };
    const fixture = await createHost(uploader);
    button('Upload image')?.click();
    await stabilize(fixture);
    selectFile(imageFile());
    await stabilize(fixture);
    setInput('Alternative text', 'Alt');
    dialogButton('Upload image')?.click();
    await stabilize(fixture);

    expect(document.querySelector('.mlv-dialog')).not.toBeNull();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Image upload failed.',
    );
    expect(dialogButton('Retry upload')).not.toBeNull();
    expect(dialogButton('Remove photo.png')).not.toBeNull();

    dialogButton('Retry upload')?.click();
    await stabilize(fixture);
    expect(dialogAnnouncement()).toBe('Uploading image: 0%');
    expect(uploader.upload).toHaveBeenCalledTimes(2);
    retry.resolve({ src: 'https://cdn.test/retry.png' });
    await stabilize(fixture);
    expect(fixture.componentInstance.editor().editor()?.getHTML()).toContain(
      'retry.png',
    );
  });

  it('announces a dismissed failed button upload when status retry succeeds', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:status-retry');
    const retry = deferred<{ src: string }>();
    const uploader = {
      upload: vi
        .fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockImplementationOnce(() => retry.promise),
    };
    const fixture = await createHost(uploader);
    button('Upload image')?.click();
    await stabilize(fixture);
    selectFile(imageFile());
    await stabilize(fixture);
    setInput('Alternative text', 'Alt');
    dialogButton('Upload image')?.click();
    await stabilize(fixture);

    document
      .querySelector('.mlv-dialog')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    finishDialogClose();
    await stabilize(fixture);
    fixture.nativeElement
      .querySelector<HTMLButtonElement>(
        '.mlv-editor-image-upload-status [aria-label="Retry upload"]',
      )
      ?.click();
    await stabilize(fixture);
    expect(statusAnnouncement(fixture)).toBe('Uploading image: 0%');

    retry.resolve({ src: 'https://cdn.test/status-retry.png' });
    await stabilize(fixture);

    expect(statusAnnouncement(fixture)).toBe('Upload complete');
  });

  it('does not revoke a preview twice after FileUpload removes it', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:removed');
    const revokePreview = vi.spyOn(URL, 'revokeObjectURL');
    const fixture = await createHost({
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.test/photo.png' }),
    });
    button('Upload image')?.click();
    await stabilize(fixture);
    selectFile(imageFile());
    await stabilize(fixture);

    dialogButton('Remove photo.png')?.click();
    await stabilize(fixture);
    document
      .querySelector('.mlv-dialog')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    finishDialogClose();
    await stabilize(fixture);

    expect(revokePreview).toHaveBeenCalledExactlyOnceWith('blob:removed');
  });

  it('preserves text/plain when a real paste also contains an accepted image', async () => {
    const uploader = {
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.test/paste.png' }),
    };
    const fixture = await createHost(uploader);
    const editor = fixture.componentInstance.editor().editor();
    const image = imageFile();
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', {
      value: {
        files: [image],
        types: ['Files', 'text/plain'],
        getData: (type: string) => (type === 'text/plain' ? 'keep me' : ''),
      },
    });

    editor?.view.dom.dispatchEvent(paste);
    await stabilize(fixture);

    expect(editor?.getText()).toContain('keep me');
    expect(editor?.getHTML()).toContain('paste.png');
    expect(uploader.upload).toHaveBeenCalledTimes(1);
    expect(uploader.upload.mock.calls[0]?.[1].source).toBe('paste');
  });

  it('preserves text/plain at the actual position when a real external drop also contains an accepted image', async () => {
    const uploader = {
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.test/drop.png' }),
    };
    const fixture = await createHost(uploader);
    const editor = fixture.componentInstance.editor().editor();
    editor?.commands.setContent('<p>AB</p>');
    if (!editor) throw new Error('Expected editor');
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({
      pos: 2,
      inside: -1,
    });
    const image = imageFile();
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', {
      value: {
        files: [image],
        types: ['Files', 'text/plain'],
        getData: (type: string) => (type === 'text/plain' ? 'keep drop' : ''),
      },
    });

    editor.view.dom.dispatchEvent(drop);
    await stabilize(fixture);

    expect(editor.getText().replaceAll('\n', '')).toBe('Akeep dropB');
    expect(editor.getHTML()).toContain('drop.png');
    expect(uploader.upload).toHaveBeenCalledTimes(1);
    expect(uploader.upload.mock.calls[0]?.[1].source).toBe('drop');
  });

  it('uses one default FileHandler for accepted image paste/drop but leaves a replacement array literal', async () => {
    const uploader = {
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.test/file.png' }),
    };
    const fixture = await createHost(uploader);
    const editor = fixture.componentInstance.editor().editor();
    const fileHandler = editor?.extensionManager.extensions.find(
      ({ name }) => name === 'fileHandler',
    );
    const image = imageFile();
    const text = imageFile('notes.txt', 'text/plain');

    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', {
      value: {
        files: [image, text],
        types: ['Files', 'text/html', 'text/plain'],
        getData: (type: string) =>
          type === 'text/html'
            ? '<p>keep me</p>'
            : type === 'text/plain'
              ? 'keep me'
              : '',
      },
    });
    editor?.view.dom.dispatchEvent(paste);
    fileHandler?.options.onDrop?.(editor, [text, image], 1);
    await stabilize(fixture);

    expect(uploader.upload).toHaveBeenCalledTimes(2);
    expect(uploader.upload.mock.calls.map(([file]) => file)).toEqual([
      image,
      image,
    ]);
    expect(
      uploader.upload.mock.calls.map(([, context]) => context.source),
    ).toEqual(['paste', 'drop']);
    expect(fileHandler?.options.consumePasteEvent).toBe(false);
    expect(editor?.getText()).toContain('keep me');

    const nonImagePaste = new Event('paste', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(nonImagePaste, 'clipboardData', {
      value: {
        files: [text],
        types: ['Files', 'text/plain'],
        getData: (type: string) => (type === 'text/plain' ? 'plain text' : ''),
      },
    });
    editor?.view.dom.dispatchEvent(nonImagePaste);
    await stabilize(fixture);
    expect(uploader.upload).toHaveBeenCalledTimes(2);
    expect(editor?.getText()).toContain('plain text');

    fixture.destroy();
    const replacementFixture = TestBed.createComponent(ImageUploadHost);
    replacementFixture.componentInstance.uploader.set(uploader);
    replacementFixture.componentInstance.extensions.set(
      mlvEditorDefaultExtensions(),
    );
    replacementFixture.detectChanges();
    await replacementFixture.whenStable();
    const replacementHandler = replacementFixture.componentInstance
      .editor()
      .editor()
      ?.extensionManager.extensions.find(({ name }) => name === 'fileHandler');
    expect(replacementHandler?.options.onPaste).toBeUndefined();
    expect(replacementHandler?.options.onDrop).toBeUndefined();
  });
});
