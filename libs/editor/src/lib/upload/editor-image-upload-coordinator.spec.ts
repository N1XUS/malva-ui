import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture, Provider } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
import type { MlvEditorImageUploader } from '../editor.types';
import {
  MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS,
  MLV_EDITOR_IMAGE_UPLOADER,
} from '../editor.tokens';
import { MlvEditor } from '../editor/editor';
import {
  MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR,
  type MlvEditorImageUploadCoordinator,
} from './editor-image-upload-coordinator';

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

const imageFile = (name = 'photo.png', type = 'image/png', size = 5): File =>
  new File([new Uint8Array(size)], name, { type });

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      [imageUploader]="uploader()"
      [imageUploadOptions]="options()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      (imageUploadSuccess)="successes.push($event)"
      (imageUploadFailure)="failures.push($event)"
      (imageUploadCancelled)="cancellations.push($event)"
      (editorError)="errors.push($event)"
    />
  `,
})
class UploadHost {
  readonly editor = viewChild.required(MlvEditor);
  readonly uploader = signal<MlvEditorImageUploader | undefined>(undefined);
  readonly options = signal(MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly successes: unknown[] = [];
  readonly failures: Array<{ error: { code: string } }> = [];
  readonly cancellations: unknown[] = [];
  readonly errors: Array<{ code: string }> = [];
}

describe('MlvEditorImageUploadCoordinator', () => {
  async function createHost(providers: readonly Provider[] = []): Promise<{
    fixture: ComponentFixture<UploadHost>;
    host: UploadHost;
    coordinator: MlvEditorImageUploadCoordinator;
  }> {
    await TestBed.configureTestingModule({
      imports: [UploadHost],
      providers: [provideMlvI18nTesting(), ...providers],
    }).compileComponents();
    const fixture = TestBed.createComponent(UploadHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const coordinator = fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR);
    return { fixture, host, coordinator };
  }

  async function settle(fixture: ComponentFixture<UploadHost>): Promise<void> {
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('stays inactive and silent when no adapter is configured', async () => {
    const { coordinator, host } = await createHost();

    expect(coordinator.available()).toBe(false);
    expect(coordinator.start([imageFile()], 'button')).toEqual([]);
    expect(coordinator.pending()).toEqual([]);
    expect(host.failures).toEqual([]);
    expect(host.errors).toEqual([]);
  });

  it('prefers the input adapter and sends every source through one start path', async () => {
    const injected = {
      upload: vi
        .fn()
        .mockResolvedValue({ src: 'https://cdn.test/injected.png' }),
    };
    const input = {
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.test/input.png' }),
    };
    const { fixture, host, coordinator } = await createHost([
      { provide: MLV_EDITOR_IMAGE_UPLOADER, useValue: injected },
    ]);
    host.uploader.set(input);
    fixture.detectChanges();
    await settle(fixture);

    coordinator.start([imageFile('button.png')], 'button');
    coordinator.start([imageFile('paste.png')], 'paste');
    coordinator.start([imageFile('drop.png')], 'drop', { position: 1 });
    await settle(fixture);

    expect(injected.upload).not.toHaveBeenCalled();
    expect(input.upload).toHaveBeenCalledTimes(3);
    expect(input.upload.mock.calls.map((call) => call[1].source)).toEqual([
      'button',
      'paste',
      'drop',
    ]);
  });

  it('enforces default type, inclusive size, and per-action file count', async () => {
    const uploader = {
      upload: vi.fn().mockResolvedValue({ src: 'https://cdn.test/image.png' }),
    };
    const { fixture, host, coordinator } = await createHost();
    host.uploader.set(uploader);
    fixture.detectChanges();

    coordinator.start(
      [imageFile('first.png'), imageFile('excess.png')],
      'button',
    );
    coordinator.start([imageFile('text.txt', 'text/plain')], 'button');
    coordinator.start(
      [
        imageFile(
          'too-large.png',
          'image/png',
          MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS.maxSize + 1,
        ),
      ],
      'button',
    );
    await settle(fixture);

    expect(uploader.upload).toHaveBeenCalledTimes(1);
    expect(host.failures).toHaveLength(3);
    expect(host.failures.map(({ error }) => error.code)).toEqual([
      'upload-validation',
      'upload-validation',
      'upload-validation',
    ]);
    expect(host.errors.map(({ code }) => code)).toEqual([
      'upload-validation',
      'upload-validation',
      'upload-validation',
    ]);
  });

  it('creates a placeholder, clamps progress, and atomically inserts valid image attributes', async () => {
    const request = deferred<{
      src: string;
      alt: string;
      title: string;
      width: number;
      height: number;
    }>();
    let reportProgress: ((progress: number) => void) | undefined;
    const uploader: MlvEditorImageUploader = {
      upload: vi.fn((_, context) => {
        reportProgress = context.reportProgress;
        return request.promise;
      }),
    };
    const { fixture, host, coordinator } = await createHost();
    host.uploader.set(uploader);
    fixture.detectChanges();

    // No author metadata: the adapter's alt and title fill the image.
    const [id] = coordinator.start([imageFile()], 'button');
    expect(id).toBeTruthy();
    expect(
      host.editor().editor()?.storage.mlvEditorUploadPlaceholder.placeholders,
    ).toEqual([{ id, position: 1, progress: 0 }]);

    reportProgress?.(175);
    expect(coordinator.pending()[0]?.progress).toBe(100);
    expect(
      host.editor().editor()?.storage.mlvEditorUploadPlaceholder.placeholders,
    ).toEqual([{ id, position: 1, progress: 100 }]);

    request.resolve({
      src: '  https://cdn.test/final.png  ',
      alt: 'Uploaded alt',
      title: 'Uploaded title',
      width: 320,
      height: 180,
    });
    await settle(fixture);

    expect(coordinator.pending()).toEqual([]);
    expect(
      host.editor().editor()?.storage.mlvEditorUploadPlaceholder.placeholders,
    ).toEqual([]);
    expect(host.editor().editor()?.getJSON().content?.[0]).toMatchObject({
      type: 'image',
      attrs: {
        src: 'https://cdn.test/final.png',
        alt: 'Uploaded alt',
        title: 'Uploaded title',
        width: 320,
        height: 180,
      },
    });
    expect(host.successes).toHaveLength(1);
  });

  it.each<{
    name: string;
    metadata: { alt?: string; title?: string };
    adapterTitle?: string;
    expected: { alt: string; title?: string };
  }>([
    {
      name: 'typed alt and title win over the adapter',
      metadata: { alt: 'Typed alt', title: 'Typed title' },
      adapterTitle: 'Adapter title',
      expected: { alt: 'Typed alt', title: 'Typed title' },
    },
    {
      // WCAG H67: an image assistive technology should ignore needs an
      // empty alt and no title, or it is exposed as an unnamed image.
      name: 'a decorative empty alt stays empty and takes no adapter title',
      metadata: { alt: '' },
      adapterTitle: 'Adapter title',
      expected: { alt: '' },
    },
    {
      name: 'a decorative empty alt drops an author title too',
      metadata: { alt: '', title: 'Typed title' },
      adapterTitle: 'Adapter title',
      expected: { alt: '' },
    },
    {
      name: "an empty author title lets the adapter's title apply",
      metadata: { alt: 'Typed alt', title: '' },
      adapterTitle: 'Adapter title',
      expected: { alt: 'Typed alt', title: 'Adapter title' },
    },
    {
      name: 'an empty author title with no adapter title means no title',
      metadata: { alt: 'Typed alt', title: '' },
      expected: { alt: 'Typed alt' },
    },
    {
      name: 'the adapter fills what the author left out',
      metadata: {},
      adapterTitle: 'Adapter title',
      expected: { alt: 'adapter.png', title: 'Adapter title' },
    },
  ])(
    'resolves alt and title with author precedence: $name',
    async ({ metadata, adapterTitle, expected }) => {
      const uploader = {
        upload: vi.fn().mockResolvedValue({
          src: 'https://cdn.test/final.png',
          alt: 'adapter.png',
          ...(adapterTitle === undefined ? {} : { title: adapterTitle }),
        }),
      };
      const { fixture, host, coordinator } = await createHost();
      host.uploader.set(uploader);
      fixture.detectChanges();

      coordinator.start([imageFile('adapter.png')], 'button', metadata);
      await settle(fixture);

      // The image node defaults an absent title to `null`.
      const attrs = host.editor().editor()?.getJSON().content?.[0]?.attrs;
      expect({
        alt: attrs?.['alt'] ?? undefined,
        title: attrs?.['title'] ?? undefined,
      }).toEqual({ alt: expected.alt, title: expected.title });
      const [success] = host.successes as Array<{
        result: { alt?: string; title?: string };
      }>;
      expect({
        alt: success?.result.alt,
        title: success?.result.title,
        hasTitle: success !== undefined && 'title' in success.result,
      }).toEqual({
        alt: expected.alt,
        title: expected.title,
        hasTitle: expected.title !== undefined,
      });
    },
  );

  it('keeps transport and unsafe-result failures retryable with stable error codes', async () => {
    const uploader = {
      upload: vi
        .fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ src: 'javascript:alert(1)' }),
    };
    const { fixture, host, coordinator } = await createHost();
    host.uploader.set(uploader);
    fixture.detectChanges();

    const [transportId] = coordinator.start(
      [imageFile('transport.png')],
      'button',
    );
    await settle(fixture);
    const [resultId] = coordinator.start([imageFile('result.png')], 'paste');
    await settle(fixture);

    expect(coordinator.pending()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: transportId,
          status: 'failed',
          error: expect.objectContaining({ code: 'upload-transport' }),
        }),
        expect.objectContaining({
          id: resultId,
          status: 'failed',
          error: expect.objectContaining({ code: 'upload-result' }),
        }),
      ]),
    );
    expect(host.failures.map(({ error }) => error.code)).toEqual([
      'upload-transport',
      'upload-result',
    ]);
    expect(host.errors.map(({ code }) => code)).toEqual([
      'upload-transport',
      'upload-result',
    ]);
  });

  it('cancels once and ignores progress or completion from the stale request', async () => {
    const request = deferred<{ src: string }>();
    let context:
      | {
          readonly signal: AbortSignal;
          readonly reportProgress: (progress: number) => void;
        }
      | undefined;
    const uploader: MlvEditorImageUploader = {
      upload: vi.fn((_, uploadContext) => {
        context = uploadContext;
        return request.promise;
      }),
    };
    const { fixture, host, coordinator } = await createHost();
    host.uploader.set(uploader);
    fixture.detectChanges();

    const [id] = coordinator.start([imageFile()], 'drop', { position: 1 });
    coordinator.cancel(id);
    coordinator.cancel(id);
    context?.reportProgress(90);
    request.resolve({ src: 'https://cdn.test/stale.png' });
    await settle(fixture);

    expect(context?.signal.aborted).toBe(true);
    expect(coordinator.pending()).toEqual([]);
    expect(host.cancellations).toHaveLength(1);
    expect(host.successes).toEqual([]);
    expect(host.editor().editor()?.getHTML()).not.toContain('stale.png');
  });

  it('retries with a fresh signal while preserving identity, source, and metadata', async () => {
    const retry = deferred<{ src: string }>();
    const signals: AbortSignal[] = [];
    const uploader: MlvEditorImageUploader = {
      upload: vi
        .fn((_, context) => {
          signals.push(context.signal);
          return Promise.reject(new Error('first'));
        })
        .mockImplementationOnce((_, context) => {
          signals.push(context.signal);
          return Promise.reject(new Error('first'));
        })
        .mockImplementationOnce((_, context) => {
          signals.push(context.signal);
          return retry.promise;
        }),
    };
    const { fixture, host, coordinator } = await createHost();
    host.uploader.set(uploader);
    fixture.detectChanges();

    const [id] = coordinator.start([imageFile()], 'paste', {
      alt: 'Preserved alt',
      title: 'Preserved title',
    });
    await settle(fixture);
    coordinator.retry(id);

    expect(coordinator.pending()[0]).toMatchObject({
      id,
      source: 'paste',
      progress: 0,
      status: 'uploading',
    });
    expect(signals[1]).not.toBe(signals[0]);
    retry.resolve({ src: 'https://cdn.test/retried.png' });
    await settle(fixture);

    expect(host.editor().editor()?.getJSON().content?.[0]).toMatchObject({
      type: 'image',
      attrs: {
        src: 'https://cdn.test/retried.png',
        alt: 'Preserved alt',
        title: 'Preserved title',
      },
    });
  });

  it('aborts all active uploads when the editor becomes disabled or is destroyed', async () => {
    const signals: AbortSignal[] = [];
    const uploader: MlvEditorImageUploader = {
      upload: vi.fn((_, context) => {
        signals.push(context.signal);
        return new Promise(() => undefined);
      }),
    };
    const { fixture, host, coordinator } = await createHost();
    host.uploader.set(uploader);
    fixture.detectChanges();

    coordinator.start([imageFile('disabled.png')], 'button');
    host.disabled.set(true);
    fixture.detectChanges();
    await settle(fixture);
    expect(signals[0]?.aborted).toBe(true);

    host.disabled.set(false);
    fixture.detectChanges();
    coordinator.start([imageFile('destroyed.png')], 'button');
    fixture.destroy();
    expect(signals[1]?.aborted).toBe(true);
  });

  it('aborts active uploads when the editor becomes readonly and ignores stale completion', async () => {
    const request = deferred<{ src: string }>();
    let signal: AbortSignal | undefined;
    const uploader: MlvEditorImageUploader = {
      upload: vi.fn((_, context) => {
        signal = context.signal;
        return request.promise;
      }),
    };
    const { fixture, host, coordinator } = await createHost();
    host.uploader.set(uploader);
    fixture.detectChanges();

    coordinator.start([imageFile('readonly.png')], 'button');
    host.readonly.set(true);
    fixture.detectChanges();
    await settle(fixture);

    expect(signal?.aborted).toBe(true);
    request.resolve({ src: 'https://cdn.test/readonly.png' });
    await settle(fixture);

    expect(coordinator.pending()).toEqual([]);
    expect(
      host.editor().editor()?.storage.mlvEditorUploadPlaceholder.placeholders,
    ).toEqual([]);
    expect(host.editor().editor()?.getHTML()).not.toContain('readonly.png');
    expect(host.successes).toEqual([]);
    expect(host.failures).toEqual([]);
    expect(host.cancellations).toEqual([]);
    expect(host.errors).toEqual([]);
  });
});
