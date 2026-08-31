import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  type OnDestroy,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MlvLoader } from '@malva-ui/core/loader';
import type { MlvLoaderTone } from '@malva-ui/core/loader';
import { MlvButton, MlvButtonBefore } from '@malva-ui/core/button';
import { LucideUpload, LucideCheck, LucideX } from '@lucide/angular';

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

interface UploadFile {
  name: string;
  size: string;
  progress: number;
  status: UploadStatus;
}

@Component({
  selector: 'docs-loader-upload-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvLoader,
    MlvButton,
    MlvButtonBefore,
    LucideUpload,
    LucideCheck,
    LucideX,
    DecimalPipe,
  ],
  templateUrl: './index.html',
})
export default class LoaderUploadExampleComponent implements OnDestroy {
  readonly files = signal<UploadFile[]>([
    { name: 'report-q4-2025.pdf', size: '2.4 MB', progress: 0, status: 'idle' },
    { name: 'design-assets.zip', size: '18.7 MB', progress: 0, status: 'idle' },
    { name: 'backup-db.sql.gz', size: '5.1 MB', progress: 0, status: 'idle' },
  ]);

  readonly isUploading = computed(() =>
    this.files().some((f) => f.status === 'uploading'),
  );
  readonly allDone = computed(() =>
    this.files().every((f) => f.status === 'done' || f.status === 'error'),
  );

  private _intervals: ReturnType<typeof setInterval>[] = [];

  startUpload(): void {
    this.files.update((files) =>
      files.map((f) => ({
        ...f,
        progress: 0,
        status: 'uploading' as UploadStatus,
      })),
    );
    this._intervals.forEach(clearInterval);
    this._intervals = [];

    this.files().forEach((_, index) => {
      const speed = 2 + Math.random() * 4;
      const interval = setInterval(() => {
        this.files.update((files) => {
          const updated = [...files];
          const file = updated[index];
          if (file.status !== 'uploading') return files;

          const newProgress = Math.min(100, file.progress + speed);
          const done = newProgress >= 100;
          // Simulate occasional error on last file
          const hasError = done && index === 2 && Math.random() < 0.3;

          updated[index] = {
            ...file,
            progress: newProgress,
            status: done ? (hasError ? 'error' : 'done') : 'uploading',
          };

          if (done) clearInterval(interval);
          return updated;
        });
      }, 100);

      this._intervals.push(interval);
    });
  }

  reset(): void {
    this._intervals.forEach(clearInterval);
    this._intervals = [];
    this.files.update((files) =>
      files.map((f) => ({ ...f, progress: 0, status: 'idle' })),
    );
  }

  stateFor(file: UploadFile): MlvLoaderTone {
    if (file.status === 'done') return 'success';
    if (file.status === 'error') return 'danger';
    return 'default';
  }

  ngOnDestroy(): void {
    this._intervals.forEach(clearInterval);
  }
}
