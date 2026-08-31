import {
  ChangeDetectionStrategy,
  Component,
  signal,
  type OnDestroy,
} from '@angular/core';
import {
  MlvEditor,
  type MlvEditorImageUploadContext,
  type MlvEditorImageUploader,
} from '@malva-ui/editor';

interface DemoOperation {
  readonly timer: ReturnType<typeof setInterval>;
  readonly cancel: () => void;
}

class DemoImageUploader implements MlvEditorImageUploader {
  private readonly _attempts = new WeakMap<File, number>();
  private readonly _operations = new Set<DemoOperation>();

  upload(file: File, context: MlvEditorImageUploadContext) {
    const attempt = (this._attempts.get(file) ?? 0) + 1;
    this._attempts.set(file, attempt);

    return new Promise<{
      src: string;
      alt: string;
      width: number;
      height: number;
    }>((resolve, reject) => {
      let progress = 0;
      const operation = {} as DemoOperation;
      const finish = (): void => {
        clearInterval(operation.timer);
        context.signal.removeEventListener('abort', operation.cancel);
        this._operations.delete(operation);
      };
      const cancel = (): void => {
        finish();
        reject(new DOMException('Demo upload cancelled', 'AbortError'));
      };

      const timer = setInterval(() => {
        progress += 25;
        context.reportProgress(progress);
        if (progress < 100) return;
        finish();

        if (file.name.toLowerCase().includes('retry') && attempt === 1) {
          reject(new Error('Deterministic first-attempt demo failure'));
          return;
        }

        const svg =
          '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">' +
          '<rect width="100%" height="100%" fill="rebeccapurple"/>' +
          '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ' +
          'fill="white" font-size="32">Local upload complete</text></svg>';
        resolve({
          src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
          alt: file.name,
          width: 640,
          height: 360,
        });
      }, 250);

      Object.assign(operation, { timer, cancel });
      this._operations.add(operation);
      context.signal.addEventListener('abort', cancel, { once: true });
    });
  }

  destroy(): void {
    for (const operation of [...this._operations]) operation.cancel();
  }
}

@Component({
  selector: 'docs-editor-image-upload-example',
  imports: [MlvEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorImageUploadExample implements OnDestroy {
  readonly value = signal<string | null>(
    '<p>Use the image button, or paste/drop an image here.</p>',
  );
  readonly uploader = new DemoImageUploader();
  readonly events = signal<readonly string[]>([]);
  readonly options = {
    accept: ['image/*'],
    maxSize: 1024 * 1024,
    maxFiles: 1,
    urlPolicy: (url: string) => url.startsWith('data:image/svg+xml,'),
  };

  protected log(message: string): void {
    this.events.update((events) => [message, ...events].slice(0, 6));
  }

  ngOnDestroy(): void {
    this.uploader.destroy();
  }
}
