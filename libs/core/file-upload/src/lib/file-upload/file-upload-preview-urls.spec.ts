import type { ApplicationRef } from '@angular/core';
import {
  Component,
  provideZonelessChangeDetection,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { form, FormField } from '@angular/forms/signals';
import { createApplication } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvFileUpload } from './file-upload';
import type { MlvUploadedFile } from './file-upload.types';

// ---------------------------------------------------------------------------
// Preview object URL lifetime (#352).
//
// The component creates a `blob:` URL for every picked or dropped image. It
// owns exactly those URLs: each is revoked once no mounted `mlv-file-upload`
// holds it in its value any more — after `removeFile`, a single-file replace,
// or an external write (form `reset()`, `[(value)]`, signal-forms model).
// Destroying an upload whose value still holds a preview hands it on with the
// value instead of revoking it, so a re-mounted upload keeps a live preview. A
// `previewUrl` the consumer supplies is never revoked.
//
// Every assertion names the revoked URLs, never only a call count.
// ---------------------------------------------------------------------------

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

/**
 * Dispatches a native picker `change` choosing `files` on the `index`-th
 * upload under `root`, and renders nothing: the event handler and its
 * microtasks run, the render the zoneless scheduler queued does not — the
 * timing of a real `change` event.
 */
function dispatchPickIn(root: HTMLElement, files: File[], index = 0): void {
  const input = root.querySelectorAll<HTMLInputElement>(
    '.mlv-file-upload__input',
  )[index];
  Object.defineProperty(input, 'files', {
    value: fileList(files),
    configurable: true,
  });
  input.dispatchEvent(new Event('change'));
}

/** {@link dispatchPickIn} on the `index`-th upload under the fixture. */
function dispatchPick(
  fixture: ComponentFixture<unknown>,
  files: File[],
  index = 0,
): void {
  dispatchPickIn(fixture.nativeElement as HTMLElement, files, index);
}

/**
 * Simulates choosing `files` in the native picker of the `index`-th upload
 * under `root`, through the real `change` binding, then renders.
 */
function pick(
  fixture: ComponentFixture<unknown>,
  files: File[],
  index = 0,
): void {
  dispatchPick(fixture, files, index);
  fixture.detectChanges();
}

/** The `src` of every list thumbnail under `root`, in DOM order. */
function thumbnails(fixture: ComponentFixture<unknown>): string[] {
  const root = fixture.nativeElement as HTMLElement;
  return Array.from(
    root.querySelectorAll<HTMLImageElement>(
      '.mlv-file-upload-item__thumbnail-img',
    ),
  ).map((image) => image.getAttribute('src') ?? '');
}

/** A consumer-owned image descriptor seeded with its own `blob:` preview. */
function consumerImage(id: string, previewUrl: string): MlvUploadedFile {
  const file = png(`${id}.png`);
  return {
    id,
    file,
    name: file.name,
    size: file.size,
    previewUrl,
    state: 'success',
  };
}

@Component({
  template: `
    @if (show()) {
      <mlv-file-upload [(value)]="files" [multiple]="multiple()" />
    }
  `,
  imports: [MlvFileUpload],
})
class TwoWayHost {
  readonly show = signal(true);
  readonly multiple = signal(true);
  readonly files = signal<MlvUploadedFile[]>([]);
  readonly upload = viewChild(MlvFileUpload);
}

@Component({
  template: `
    @if (show()) {
      <mlv-file-upload [formControl]="control" />
    }
  `,
  imports: [MlvFileUpload, ReactiveFormsModule],
})
class ReactiveHost {
  readonly show = signal(true);
  readonly control = new FormControl<MlvUploadedFile[] | null>([]);
}

@Component({
  template: `<mlv-file-upload [formField]="fields.files" />`,
  imports: [MlvFileUpload, FormField],
})
class SignalFormsHost {
  readonly model = signal<{ files: MlvUploadedFile[] }>({ files: [] });
  readonly fields = form(this.model);
}

@Component({
  template: `
    <mlv-file-upload [(value)]="first" />
    <mlv-file-upload [(value)]="second" />
  `,
  imports: [MlvFileUpload],
})
class SharedHost {
  readonly first = signal<MlvUploadedFile[]>([]);
  readonly second = signal<MlvUploadedFile[]>([]);
  readonly uploads = viewChildren(MlvFileUpload);
}

/** A second, later upload that an `@if` creates on demand. */
@Component({
  template: `
    <mlv-file-upload [(value)]="first" />
    @if (showSecond()) {
      <mlv-file-upload [(value)]="second" />
    }
  `,
  imports: [MlvFileUpload],
})
class LateReceiverHost {
  readonly showSecond = signal(false);
  readonly first = signal<MlvUploadedFile[]>([]);
  readonly second = signal<MlvUploadedFile[]>([]);
}

/**
 * Root component of a real application (`createApplication`), for the
 * teardown specs: TestBed destroys its fixtures before its injector, so it
 * never reaches the order `ApplicationRef.destroy()` uses.
 */
@Component({
  selector: 'mlv-test-teardown-app',
  template: `<mlv-file-upload [(value)]="files" [multiple]="multiple()" />`,
  imports: [MlvFileUpload],
})
class TeardownAppHost {
  readonly multiple = signal(true);
  readonly files = signal<MlvUploadedFile[]>([]);
  readonly upload = viewChild(MlvFileUpload);
}

/**
 * One-way `[value]` whose `(filesChange)` handler vetoes `reject.png`: the
 * pick reaches the model, then the consumer writes back a list without it in
 * the same tick.
 */
@Component({
  template: `<mlv-file-upload
    [value]="files()"
    (filesChange)="onFilesChange($event)"
  />`,
  imports: [MlvFileUpload],
})
class VetoHost {
  readonly files = signal<MlvUploadedFile[]>([]);

  onFilesChange(next: MlvUploadedFile[]): void {
    this.files.set(next.filter((file) => file.name !== 'reject.png'));
  }
}

/**
 * A single-file "current" upload whose `(filesChange)` handler archives the
 * file a pick replaced into a second, later upload — in the same handler.
 */
@Component({
  template: `
    <mlv-file-upload
      [(value)]="current"
      [multiple]="false"
      (filesChange)="archiveReplaced($event)"
    />
    <mlv-file-upload [(value)]="archive" />
  `,
  imports: [MlvFileUpload],
})
class ArchiveHost {
  readonly current = signal<MlvUploadedFile[]>([]);
  readonly archive = signal<MlvUploadedFile[]>([]);
  /** @private What the current upload showed before this change. */
  private _shown: MlvUploadedFile[] = [];

  archiveReplaced(next: MlvUploadedFile[]): void {
    const replaced = this._shown.filter((file) => !next.includes(file));
    this.archive.update((files) => [...files, ...replaced]);
    this._shown = next;
  }
}

describe('MlvFileUpload — preview URL lifetime', () => {
  /** Every URL handed to `URL.revokeObjectURL`, in call order. */
  let revoked: string[];

  beforeEach(async () => {
    let created = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `blob:fake/${++created}`,
    );
    revoked = [];
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
      revoked.push(String(url));
    });

    await TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Creates and stabilises a host fixture. */
  async function mount<T>(host: new () => T): Promise<ComponentFixture<T>> {
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  describe('external writes', () => {
    it('revokes every preview an external [(value)] write drops', async () => {
      const fixture = await mount(TwoWayHost);
      pick(fixture, [png('a.png'), png('b.png')]);
      expect(thumbnails(fixture)).toEqual(['blob:fake/1', 'blob:fake/2']);
      expect(revoked).toEqual([]);

      fixture.componentInstance.files.set([]);
      fixture.detectChanges();

      expect([...revoked].sort()).toEqual(['blob:fake/1', 'blob:fake/2']);
    });

    it('revokes only the preview a write drops, not one it keeps in a copied entry', async () => {
      const fixture = await mount(TwoWayHost);
      pick(fixture, [png('a.png'), png('b.png')]);

      // The consumer patches upload progress immutably and drops `a.png`.
      fixture.componentInstance.files.update((files) => [
        { ...files[1], state: 'uploading', progress: 40 },
      ]);
      fixture.detectChanges();

      expect(revoked).toEqual(['blob:fake/1']);
      expect(thumbnails(fixture)).toEqual(['blob:fake/2']);
    });

    it('revokes the previews a reactive form reset() drops', async () => {
      const fixture = await mount(ReactiveHost);
      pick(fixture, [png('a.png'), png('b.png')]);
      expect(fixture.componentInstance.control.value?.length).toBe(2);

      fixture.componentInstance.control.reset();
      fixture.detectChanges();

      expect([...revoked].sort()).toEqual(['blob:fake/1', 'blob:fake/2']);
    });

    it('revokes the preview a signal-forms model write drops', async () => {
      const fixture = await mount(SignalFormsHost);
      pick(fixture, [png('a.png')]);
      expect(fixture.componentInstance.model().files.length).toBe(1);

      fixture.componentInstance.model.set({ files: [] });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(revoked).toEqual(['blob:fake/1']);
    });

    it('revokes nothing for a write that keeps every preview', async () => {
      const fixture = await mount(TwoWayHost);
      pick(fixture, [png('a.png')]);

      fixture.componentInstance.files.update((files) =>
        files.map((file) => ({ ...file, state: 'success', progress: 100 })),
      );
      fixture.detectChanges();

      expect(revoked).toEqual([]);
      expect(thumbnails(fixture)).toEqual(['blob:fake/1']);
    });
  });

  describe('consumer-supplied previews', () => {
    it('never revokes a consumer blob: preview on removeFile', async () => {
      const fixture = await mount(TwoWayHost);
      fixture.componentInstance.files.set([
        consumerImage('seed', 'blob:consumer'),
      ]);
      fixture.detectChanges();

      fixture.componentInstance.upload()?.removeFile('seed');
      fixture.detectChanges();

      expect(fixture.componentInstance.files()).toEqual([]);
      expect(revoked).toEqual([]);
    });

    it('never revokes a consumer blob: preview on a single-file replace', async () => {
      const fixture = await mount(TwoWayHost);
      fixture.componentInstance.multiple.set(false);
      fixture.componentInstance.files.set([
        consumerImage('seed', 'blob:consumer'),
      ]);
      fixture.detectChanges();

      pick(fixture, [png('b.png')]);

      expect(fixture.componentInstance.files().map((f) => f.name)).toEqual([
        'b.png',
      ]);
      expect(revoked).toEqual([]);
    });

    it('still revokes its own preview on removeFile and on replace', async () => {
      const fixture = await mount(TwoWayHost);
      fixture.componentInstance.multiple.set(false);
      fixture.detectChanges();

      pick(fixture, [png('a.png')]);
      pick(fixture, [png('b.png')]);
      expect(revoked).toEqual(['blob:fake/1']);

      const id = fixture.componentInstance.files()[0].id;
      fixture.componentInstance.upload()?.removeFile(id);
      // The revoke waits for the render `removeFile` schedules, so a file
      // moved to another mounted upload in the same tick can be kept.
      expect(revoked).toEqual(['blob:fake/1']);

      await fixture.whenStable();
      expect(revoked).toEqual(['blob:fake/1', 'blob:fake/2']);
    });
  });

  describe('destroy', () => {
    it('revokes a preview a model write dropped just before the upload is destroyed', async () => {
      const fixture = await mount(TwoWayHost);
      pick(fixture, [png('a.png')]);

      // Same tick: the write lands in the model, and the upload is destroyed
      // in the next change detection before its own effect could run.
      fixture.componentInstance.upload()?.value.set([]);
      fixture.componentInstance.show.set(false);
      fixture.detectChanges();

      expect(fixture.componentInstance.files()).toEqual([]);
      expect(revoked).toEqual(['blob:fake/1']);
    });

    it('hands a preview the value still holds on to a re-mounted upload instead of revoking it', async () => {
      const fixture = await mount(TwoWayHost);
      pick(fixture, [png('a.png')]);

      // The shape of the docs website-builder hero image and the
      // publishing-workspace media section: the upload sits in an `@if`
      // while the value lives on in the host.
      fixture.componentInstance.show.set(false);
      fixture.detectChanges();
      expect(revoked).toEqual([]);

      fixture.componentInstance.show.set(true);
      fixture.detectChanges();
      expect(thumbnails(fixture)).toEqual(['blob:fake/1']);
      expect(revoked).toEqual([]);

      // The re-mounted upload owns the preview now: a reset revokes it.
      fixture.componentInstance.files.set([]);
      fixture.detectChanges();
      expect(revoked).toEqual(['blob:fake/1']);
    });
  });

  describe('several mounted uploads', () => {
    it('keeps a preview alive while another mounted upload still holds it', async () => {
      const fixture = await mount(SharedHost);
      pick(fixture, [png('a.png')], 0);
      const host = fixture.componentInstance;
      host.second.set(host.first());
      fixture.detectChanges();

      host.uploads()[0].removeFile(host.first()[0].id);
      fixture.detectChanges();
      expect(host.first()).toEqual([]);
      expect(revoked).toEqual([]);
      expect(thumbnails(fixture)).toEqual(['blob:fake/1']);

      host.second.set([]);
      fixture.detectChanges();
      expect(revoked).toEqual(['blob:fake/1']);
    });

    // A move between two mounted uploads in one tick: the source drops the
    // URL before the target picks it up (constructor effects run in view
    // order), so the count touches zero in between. The revoke waits for the
    // render to finish and re-checks.
    it('keeps a preview moved to a later upload by two writes in one tick', async () => {
      const fixture = await mount(SharedHost);
      pick(fixture, [png('a.png')], 0);
      const host = fixture.componentInstance;

      const moved = host.first();
      host.first.set([]);
      host.second.set(moved);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(revoked).toEqual([]);
      expect(thumbnails(fixture)).toEqual(['blob:fake/1']);

      host.second.set([]);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(revoked).toEqual(['blob:fake/1']);
    });

    it('keeps a preview copied to a later upload and removed from the first in one tick', async () => {
      const fixture = await mount(SharedHost);
      pick(fixture, [png('a.png')], 0);
      const host = fixture.componentInstance;

      // One consumer click handler: copy, then remove from the source.
      host.second.set(host.first());
      host.uploads()[0].removeFile(host.first()[0].id);
      await Promise.resolve(); // the handler's microtasks, before the render
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.first()).toEqual([]);
      expect(revoked).toEqual([]);
      expect(thumbnails(fixture)).toEqual(['blob:fake/1']);
    });

    it('keeps a preview moved into an upload an @if creates in the same tick', async () => {
      const fixture = await mount(LateReceiverHost);
      pick(fixture, [png('a.png')], 0);
      const host = fixture.componentInstance;

      // The receiver is created in the render that drops the URL from the
      // source, so it retains it only after the source released it.
      host.second.set(host.first());
      host.first.set([]);
      host.showSecond.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(revoked).toEqual([]);
      expect(thumbnails(fixture)).toEqual(['blob:fake/1']);
    });

    // The replace releases the old URL inside the `change` handler, outside
    // change detection; the archive upload retains it only in the render
    // that follows. A revoke scheduled as a microtask would run in between.
    it('keeps a replaced preview the (filesChange) handler moves to a later upload', async () => {
      const fixture = await mount(ArchiveHost);
      pick(fixture, [png('a.png')], 0);

      dispatchPick(fixture, [png('b.png')], 0);
      await Promise.resolve(); // the handler's microtasks, before the render
      fixture.detectChanges();
      await fixture.whenStable();

      const host = fixture.componentInstance;
      expect(host.current().map((file) => file.name)).toEqual(['b.png']);
      expect(host.archive().map((file) => file.name)).toEqual(['a.png']);
      expect(revoked).toEqual([]);
      expect(thumbnails(fixture)).toContain('blob:fake/1');
    });
  });

  describe('consumer veto', () => {
    it('revokes the preview of a pick the consumer filters out in (filesChange)', async () => {
      const fixture = await mount(VetoHost);

      pick(fixture, [png('reject.png')]);
      await fixture.whenStable();

      expect(fixture.componentInstance.files()).toEqual([]);
      expect(revoked).toEqual(['blob:fake/1']);
    });
  });

  // `ApplicationRef.destroy()` marks the root injector destroyed before it
  // destroys the views, so an upload that drops a URL from its destroy hook
  // cannot schedule the deferred flush. A micro-frontend or Angular Elements
  // unmount, or a Storybook story switch, hits this when the drop and the
  // teardown share a task.
  describe('application teardown', () => {
    /** Boots {@link TeardownAppHost} as a real application, outside TestBed. */
    async function bootstrapApp(): Promise<{
      appRef: ApplicationRef;
      hostElement: HTMLElement;
      host: TeardownAppHost;
    }> {
      const appRef = await createApplication({
        providers: [provideZonelessChangeDetection(), provideMlvI18nTesting()],
      });
      const hostElement = document.createElement('mlv-test-teardown-app');
      document.body.append(hostElement);
      const host = appRef.bootstrap(TeardownAppHost, hostElement).instance;
      await appRef.whenStable();
      return { appRef, hostElement, host };
    }

    /** Destroys the application; returns what it threw, or `''`. */
    function destroyApp(appRef: ApplicationRef): string {
      try {
        appRef.destroy();
        return '';
      } catch (error) {
        return String(error);
      }
    }

    it('revokes a preview dropped in the same task as the teardown, without throwing', async () => {
      const { appRef, hostElement, host } = await bootstrapApp();
      try {
        dispatchPickIn(hostElement, [png('a.png')]);
        await appRef.whenStable();

        host.upload()?.removeFile(host.files()[0].id);

        expect(destroyApp(appRef)).toBe('');
        expect(revoked).toEqual(['blob:fake/1']);
      } finally {
        hostElement.remove();
      }
    });

    it('revokes a preview queued before the teardown along with one dropped during it', async () => {
      const { appRef, hostElement, host } = await bootstrapApp();
      try {
        host.multiple.set(false);
        await appRef.whenStable();
        dispatchPickIn(hostElement, [png('a.png')]);
        await appRef.whenStable();

        // The replace queues blob:fake/1 behind a flush for the render this
        // pick requested — a render the teardown in the same task never runs.
        dispatchPickIn(hostElement, [png('b.png')]);
        host.upload()?.removeFile(host.files()[0].id);

        expect(destroyApp(appRef)).toBe('');
        expect([...revoked].sort()).toEqual(['blob:fake/1', 'blob:fake/2']);
      } finally {
        hostElement.remove();
      }
    });
  });
});
