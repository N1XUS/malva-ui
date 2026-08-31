import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvDialog,
  MlvDialogBody,
  MlvDialogFooter,
  MlvDialogHeader,
  MlvDialogRef,
} from '@malva-ui/core/dialog';
import {
  MlvFileUpload,
  type MlvUploadedFile,
} from '@malva-ui/core/file-upload';
import { MlvInput } from '@malva-ui/core/input';
import { MlvProgress } from '@malva-ui/core/progress';
import { MlvSwitch } from '@malva-ui/core/switch';
import { MLV_EDITOR_I18N, MLV_FILE_UPLOAD_I18N } from '@malva-ui/i18n';
import { MLV_EDITOR_TOOLBAR_CONTEXT } from '../editor-toolbar-context';
import { MLV_EDITOR_OVERLAY_REGISTRY } from '../editor-toolbar-context';
import { MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR } from '../upload/editor-image-upload-coordinator';

/**
 * Malva modal content for selecting and uploading one editor image. Renders
 * the dialog surface itself; the header title comes from the service config
 * (`title`).
 */
@Component({
  selector: 'mlv-editor-image-upload-dialog',
  imports: [
    MlvButton,
    MlvDialog,
    MlvDialogBody,
    MlvDialogFooter,
    MlvDialogHeader,
    MlvFileUpload,
    MlvInput,
    MlvProgress,
    MlvSwitch,
  ],
  templateUrl: './editor-image-upload-dialog.html',
  styleUrl: './editor-image-upload-dialog.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-editor-image-upload-dialog' },
})
export class MlvEditorImageUploadDialog {
  /** @protected The exact editor-scoped upload coordinator. */
  protected readonly _coordinator = inject(MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR);

  /** @private Current editor state guarding mutation. */
  private readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Service-owned dialog lifecycle. */
  private readonly _dialogRef = inject(MlvDialogRef<void>);

  /** @private Dialog content root registered inside the editor focus composite. */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @private Editor-owned overlay registry for composite focus and teardown. */
  private readonly _overlays = inject(MLV_EDITOR_OVERLAY_REGISTRY);

  /** @private Component lifecycle for preview cleanup. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @private File-upload copy used for its localized remove action. */
  private readonly _fileI18n = inject(MLV_FILE_UPLOAD_I18N);

  /** @protected Selected descriptor retained as a single-file list. */
  protected readonly _files = signal<MlvUploadedFile[]>([]);

  /** @protected Single current selected descriptor. */
  protected readonly _file = computed(() => this._files()[0]);

  /** @protected Alternative-text draft. */
  protected readonly _alt = signal('');

  /** @protected Optional title draft. */
  protected readonly _title = signal('');

  /** @protected Whether the image is intentionally decorative. */
  protected readonly _decorative = signal(false);

  /** @protected Whether alt validation has been requested. */
  protected readonly _altInvalid = signal(false);

  /** @protected Stable coordinator ID for the submitted file. */
  protected readonly _activeId = signal<string | null>(null);

  /** @protected Current matching coordinator item. */
  protected readonly _item = computed(() => {
    const id = this._activeId();
    return id
      ? this._coordinator.pending().find((candidate) => candidate.id === id)
      : undefined;
  });

  /** @protected Polite dialog upload announcement. */
  protected readonly _announcement = signal('');

  /** @private Whether closing follows successful completion. */
  private _completed = false;

  /** @private Releases live dialog ownership for the current upload. */
  private _releaseDialogOwnership: (() => void) | undefined;

  /** @private Last preview URL whose lifecycle remains dialog-owned. */
  private _ownedPreviewUrl: string | undefined;

  /** @private Last announced ten-percent bucket. */
  private _progressBucket = -1;

  /** @protected Current accept string bound to Malva FileUpload. */
  protected readonly _accept = computed(() =>
    this._coordinator.options().accept.join(','),
  );

  /** @protected Current maximum bytes bound to Malva FileUpload. */
  protected readonly _maxSize = computed(
    () => this._coordinator.options().maxSize,
  );

  /** @protected Whether all dialog inputs/actions are blocked. */
  protected readonly _disabled = computed(
    () =>
      this._context.disabled() ||
      this._context.readonly() ||
      !this._coordinator.available(),
  );

  /** @protected Whether upload can begin exactly once. */
  protected readonly _submitDisabled = computed(
    () => this._disabled() || !this._file() || !!this._activeId(),
  );

  /** @protected Meaningful preview alt, empty only for decorative images. */
  protected readonly _previewAlt = computed(() =>
    this._decorative()
      ? ''
      : this._alt().trim() || this._file()?.name || 'Selected image',
  );

  /** @protected Reactive localized dialog copy. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      title: copy?.uploadImage ?? 'Upload image',
      alt: copy?.imageAltText ?? 'Alternative text',
      imageTitle: copy?.imageTitle ?? 'Image title',
      altRequired: copy?.imageAltRequired ?? 'Alternative text is required.',
      decorative: copy?.decorativeImage ?? 'Decorative image',
      failed: copy?.imageUploadFailed ?? 'Image upload failed.',
      cancel: copy?.cancelUpload ?? 'Cancel upload',
      retry: copy?.retryUpload ?? 'Retry upload',
      progress: copy?.uploadProgress ?? 'Uploading image: {progress}%',
    };
  });

  constructor() {
    const unregisterOverlay = this._overlays.register(
      this._host.nativeElement,
      () => this._dialogRef.close(),
    );

    effect(() => {
      const url = this._file()?.previewUrl;
      if (url && url !== this._ownedPreviewUrl) {
        // MlvFileUpload revokes a replaced/removed descriptor itself.
        this._ownedPreviewUrl = url;
      }
    });

    effect(() => {
      if (this._context.disabled() || this._context.readonly()) {
        this._dialogRef.close();
      }
    });

    effect(() => {
      const id = this._activeId();
      if (!id) return;
      const item = this._item();
      if (!item) return;
      if (item.status === 'failed') {
        this._announcement.set(this._copy().failed);
        this._progressBucket = -1;
        return;
      }
      const bucket = Math.floor(item.progress / 10) * 10;
      if (bucket !== this._progressBucket) {
        this._progressBucket = bucket;
        this._announcement.set(this._progressLabel(bucket));
      }
    });

    const stopTerminalEvents = this._coordinator.onTerminal(
      ({ id, reason }) => {
        if (id !== this._activeId()) return;
        if (reason === 'success') {
          this._completed = true;
          this._announcement.set(this._fileI18n().uploadComplete);
          this._dialogRef.close();
          return;
        }
        if (reason === 'cancelled') {
          this._announcement.set(this._copy().cancel);
          this._reset();
          return;
        }
        if (reason === 'lifecycle-abort') {
          this._reset();
          this._dialogRef.close();
          return;
        }
        this._reset();
      },
    );

    this._dialogRef.beforeClose().subscribe(() => {
      const id = this._activeId();
      const item = this._item();
      if (
        !this._completed &&
        id &&
        item?.status === 'uploading' &&
        !this._context.disabled() &&
        !this._context.readonly()
      ) {
        this._coordinator.cancel(id);
      }
      this._releaseOwnership();
      this._revokeOwnedPreview();
    });
    this._destroyRef.onDestroy(() => {
      stopTerminalEvents();
      unregisterOverlay();
      this._releaseOwnership();
      this._revokeOwnedPreview();
    });
  }

  /** @protected Retains only the current Malva selected descriptor. */
  protected _onFilesChange(files: MlvUploadedFile[]): void {
    const retained = files.slice(-1);
    const previousUrl = this._file()?.previewUrl;
    if (
      previousUrl &&
      !retained.some(({ previewUrl }) => previewUrl === previousUrl)
    ) {
      // FileUpload already revoked a descriptor it removed or replaced.
      this._ownedPreviewUrl = undefined;
    }
    this._files.set(retained);
    this._altInvalid.set(false);
  }

  /** @protected Begins exactly one normalized button upload. */
  protected _submit(): void {
    const selected = this._file();
    if (!selected || this._activeId()) return;
    const alt = this._decorative() ? '' : this._alt().trim();
    if (!this._decorative() && !alt) {
      this._altInvalid.set(true);
      return;
    }
    this._altInvalid.set(false);
    const title = this._title().trim();
    const ids = this._coordinator.start([selected.file], 'button', {
      alt,
      ...(title ? { title } : {}),
    });
    const id = ids[0];
    if (!id) return;
    this._activeId.set(id);
    this._releaseDialogOwnership = this._coordinator.claimDialogOwnership(id);
    this._progressBucket = 0;
    this._announcement.set(this._progressLabel(0));
  }

  /** @protected Cancels the current request and clears the dialog draft. */
  protected _cancel(): void {
    const id = this._activeId();
    if (!id) return;
    this._coordinator.cancel(id);
  }

  /** @protected Retries the retained failed request. */
  protected _retry(): void {
    const id = this._activeId();
    if (!id) return;
    this._progressBucket = -1;
    this._coordinator.retry(id);
  }

  /** @protected Removes the failed item and clears the draft. */
  protected _remove(): void {
    const id = this._activeId();
    if (!id) return;
    this._coordinator.remove(id);
  }

  /** @protected Creates a localized remove action label. */
  protected _removeLabel(): string {
    return this._fileI18n().removeFile.replace(
      '{name}',
      this._file()?.name ?? '',
    );
  }

  /** @protected Formats localized coarse progress. */
  protected _progressLabel(progress: number): string {
    return this._copy().progress.replace('{progress}', String(progress));
  }

  /** @private Clears selected state and revokes the remaining preview once. */
  private _reset(): void {
    this._releaseOwnership();
    this._revokeOwnedPreview();
    this._files.set([]);
    this._activeId.set(null);
    this._alt.set('');
    this._title.set('');
    this._decorative.set(false);
    this._altInvalid.set(false);
  }

  /** @private Releases live dialog ownership exactly once. */
  private _releaseOwnership(): void {
    this._releaseDialogOwnership?.();
    this._releaseDialogOwnership = undefined;
  }

  /** @private Revokes the still-owned current URL at most once. */
  private _revokeOwnedPreview(): void {
    const url = this._ownedPreviewUrl;
    this._ownedPreviewUrl = undefined;
    if (url) URL.revokeObjectURL(url);
  }
}
