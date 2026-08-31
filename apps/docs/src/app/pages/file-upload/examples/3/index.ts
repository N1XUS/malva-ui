import {
  Component,
  ChangeDetectionStrategy,
  signal,
  type OnDestroy,
} from '@angular/core';
import { MlvFileUpload } from '@malva-ui/core/file-upload';
import type { MlvUploadedFile } from '@malva-ui/core/file-upload';

@Component({
  selector: 'docs-file-upload-progress-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvFileUpload],
  templateUrl: './index.html',
})
export default class FileUploadProgressExampleComponent implements OnDestroy {
  /** Files with simulated upload progress states. */
  readonly files = signal<MlvUploadedFile[]>([]);

  /** @private Active simulation interval ids, cleared on destroy to avoid leaks. */
  private _intervals: ReturnType<typeof setInterval>[] = [];

  /** Handles new file selections and simulates upload progress. */
  onFilesAdded(newFiles: MlvUploadedFile[]): void {
    const pendingIds = new Set(this.files().map((f) => f.id));
    const addedFiles = newFiles.filter((f) => !pendingIds.has(f.id));

    if (addedFiles.length === 0) return;

    // Mark all newly added files as uploading
    const withUploading = newFiles.map((f) =>
      addedFiles.some((a) => a.id === f.id)
        ? { ...f, state: 'uploading' as const, progress: 0 }
        : f,
    );
    this.files.set(withUploading);

    // Simulate progress for each new file
    addedFiles.forEach((f) => this._simulateUpload(f.id));
  }

  /** @private Simulates incremental upload progress via setInterval. */
  private _simulateUpload(fileId: string): void {
    const interval = setInterval(() => {
      this.files.update((current) => {
        const file = current.find((f) => f.id === fileId);
        if (!file || file.state !== 'uploading') {
          clearInterval(interval);
          return current;
        }

        const next = (file.progress ?? 0) + 15;
        if (next >= 100) {
          clearInterval(interval);
          return current.map((f) =>
            f.id === fileId
              ? { ...f, state: 'success' as const, progress: 100 }
              : f,
          );
        }

        return current.map((f) =>
          f.id === fileId ? { ...f, progress: next } : f,
        );
      });
    }, 250);

    this._intervals.push(interval);
  }

  /** Clears any in-flight upload-simulation intervals on destroy. */
  ngOnDestroy(): void {
    this._intervals.forEach(clearInterval);
  }
}
