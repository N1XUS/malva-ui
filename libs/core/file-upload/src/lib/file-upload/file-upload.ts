import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
  ElementRef,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  MLV_FORM_CONTROL,
  MlvSignalFormControlBase,
} from '@malva-ui/core/form-utils';
import { mlvNextId } from '@malva-ui/cdk/utils';
import { MlvButton } from '@malva-ui/core/button';
import { MlvLoader } from '@malva-ui/core/loader';
import { LucideRefreshCw, LucideTrash2, LucideUpload } from '@lucide/angular';
import type { MlvFileUploadI18n } from '@malva-ui/i18n';
import { MLV_FILE_UPLOAD_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import { MlvFileUploadItem } from '../file-upload-item/file-upload-item';
import type {
  MlvFileUploadPreviewMode,
  MlvFileValidationError,
  MlvUploadedFile,
} from './file-upload.types';

/**
 * File upload component providing a drag-and-drop zone, file validation, and
 * signal, reactive, and template-driven forms integration. Produces an array
 * of `MlvUploadedFile` values.
 */
@Component({
  selector: 'mlv-file-upload',
  templateUrl: './file-upload.html',
  styleUrl: './file-upload.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvButton,
    MlvFileUploadItem,
    MlvLoader,
    LucideUpload,
    LucideRefreshCw,
    LucideTrash2,
  ],
  providers: [
    // The connector every `MlvSignalFormUiControlBase` control publishes, so an
    // enclosing `mlv-form-field` resolves the upload zone rather than skipping
    // it and landing on whatever control sits beside it.
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvFileUpload),
    },
  ],
  host: {
    class: 'mlv-file-upload',
    // `title` is the zone's heading, not a tooltip. Written as a static
    // attribute (`title="Image"`) it also lands in the DOM, which gives the
    // whole zone a native browser tooltip repeating the heading — so strip it.
    '[attr.title]': 'null',
    '[class.mlv-file-upload--cover]': '_isCover()',
    '[class.mlv-file-upload--drag-over]': '_isDragOver()',
    '[class.mlv-file-upload--disabled]': 'computedDisabled()',
    '[class.mlv-file-upload--error]': '_errors().length > 0',
    '[class.mlv-file-upload--multiple]': 'multiple()',
    '[class.mlv-file-upload--has-files]': '_files().length > 0',
    '[class.mlv-file-upload--compact]': 'compact()',
    '(dragleave)': '_onDragLeave($event)',
    '(drop)': '_onDrop($event)',
    '(focusout)': '_markTouched()',
  },
})
export class MlvFileUpload extends MlvSignalFormControlBase<MlvUploadedFile[]> {
  /** The uploaded-file list used by all Angular forms APIs. */
  readonly value = model<MlvUploadedFile[]>([]);
  /** @protected Injected i18n translations for the file upload. */
  protected readonly _i18n = inject(MLV_FILE_UPLOAD_I18N);

  /** @private ICU MessageFormat resolver for the parameterised rejection messages. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /** Comma-separated list of accepted MIME types or file extensions (e.g. `"image/*,.pdf"`). */
  readonly accept = input<string>('');

  /**
   * Maximum allowed file size in bytes. `0` means unlimited.
   */
  readonly maxSize = input<number>(0);

  /** Whether to allow selecting multiple files. */
  readonly multiple = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** Primary heading text shown in the drop zone. */
  readonly title = input<string>('Drag & drop files here');

  /** Secondary description text shown below the title. */
  readonly subtitle = input<string>('');

  /** Label text for the browse button. */
  readonly actionLabel = input<string>('Browse files');

  /** When true, renders a compact single-row drop zone instead of the full zone. */
  readonly compact = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * How the zone presents the current selection.
   *
   * `'list'` (the default) keeps today's behaviour: the prompt and browse
   * button always show, and selected files are listed below the zone.
   *
   * `'cover'` fills the zone with the selected image and swaps the browse
   * button for a floating replace/remove toolbar. It only takes effect when
   * **all** of these hold, and silently falls back to `'list'` otherwise:
   *
   * 1. `multiple` is `false`,
   * 2. exactly one file is selected, and
   * 3. that file carries a `previewUrl`.
   *
   * `previewUrl` is generated automatically for any dropped/picked file whose
   * MIME type starts with `image/`. For an edit-mode seed, write it yourself —
   * it accepts a remote `https://…` or a `data:` URL just as happily as the
   * generated `blob:` one.
   */
  readonly previewMode = input<MlvFileUploadPreviewMode>('list');

  /** Emits the current file list whenever files are added or removed. */
  readonly filesChange = output<MlvUploadedFile[]>();

  /** @private List of selected/uploaded files managed by the component. */
  protected readonly _files = computed(() => this.value() ?? []);

  /** @private Validation errors from the last file selection or drop. */
  protected readonly _errors = signal<MlvFileValidationError[]>([]);

  /** @private Whether the user is currently dragging files over the drop zone. */
  protected readonly _isDragOver = signal(false);

  /** @private Reference to the hidden file input element. */
  private readonly _fileInput =
    viewChild<ElementRef<HTMLInputElement>>('fileInput');

  /** @private Reference to the host element for dragleave boundary detection. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  constructor() {
    super();

    // `dragover` is bound here rather than as a `(dragover)` host binding.
    // It is the one high-frequency event of the three: the browser fires it
    // continuously for as long as the pointer hovers the zone, while
    // `dragleave` and `drop` fire once each. A host binding is wrapped in
    // `wrapListenerIn_markDirtyAndPreventDefault`, which notifies the
    // change-detection scheduler on every one of those events before knowing
    // whether anything changed — and after the first, `_isDragOver.set(true)`
    // writes the value it already holds, which notifies nothing on its own.
    //
    // `{ passive: false }` is mandatory and explicit: `_onDragOver` must call
    // `preventDefault()` or the browser applies its default "no drop allowed"
    // handling and never dispatches `drop` at all. `fromEvent` defaults to
    // non-passive, but relying on that default would put a broken drop target
    // one edit away.
    //
    // The host element outlives every listener here, so the plain
    // `takeUntilDestroyed()` lifetime is the correct one.
    fromEvent<DragEvent>(this._elementRef.nativeElement, 'dragover', {
      passive: false,
    })
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this._onDragOver(event));
  }

  /** @protected Computed list of files exposed to the template. */
  protected readonly _fileList = computed(() => this._files());

  // Cover preview ----------------------------------------------------------------

  /**
   * @protected The single file rendered as a full-zone cover, or `null` when
   * the cover preconditions are not met (see `previewMode`) and the zone falls
   * back to the normal prompt.
   */
  protected readonly _coverFile = computed<MlvUploadedFile | null>(() => {
    if (this.previewMode() !== 'cover' || this.multiple()) return null;
    const files = this._files();
    if (files.length !== 1) return null;
    return files[0].previewUrl ? files[0] : null;
  });

  /** @protected Whether the zone currently renders the cover preview. */
  protected readonly _isCover = computed(() => this._coverFile() !== null);

  /**
   * @protected Whether the covered file is still uploading, which overlays a
   * determinate progress bar on the image instead of falling back to list mode.
   */
  protected readonly _coverUploading = computed(() => {
    const file = this._coverFile();
    return (
      file !== null && file.state === 'uploading' && (file.progress ?? 0) < 100
    );
  });

  /**
   * @protected Accessible name for the cover toolbar's remove button, with the
   * covered file's name interpolated into the shared `removeFile` template.
   */
  protected readonly _coverRemoveLabel = computed(() => {
    const file = this._coverFile();
    return file ? this._translate('removeFile', { name: file.name }) : '';
  });

  // Forms value ------------------------------------------------------------------

  /** Whether the control holds a clearable value — At least one file present. */
  readonly hasValue = computed(() => this._files().length > 0);

  // Public API -------------------------------------------------------------------

  /**
   * Programmatically opens the native file picker dialog.
   */
  openFilePicker(): void {
    if (this.computedDisabled()) return;
    this._fileInput()?.nativeElement.click();
  }

  /**
   * Handles changes from the hidden file input element.
   * @param event - The native change event from the input.
   */
  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this._validateAndAdd(input.files);
    }
    // Reset so the same file can be re-selected
    input.value = '';
  }

  /**
   * Removes a file by its id, revoking the preview URL if present.
   * @param id - The id of the `MlvUploadedFile` to remove.
   */
  removeFile(id: string): void {
    const target = this._files().find((f) => f.id === id);
    if (target?.previewUrl) {
      URL.revokeObjectURL(target.previewUrl);
    }
    this.value.update((files) =>
      (files ?? []).filter((file) => file.id !== id),
    );
    this._emitChange();
  }

  // Internal helpers -------------------------------------------------------------

  /**
   * @private Handles the dragover event to enable the drag-over state.
   */
  protected _onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.computedDisabled()) {
      this._isDragOver.set(true);
    }
  }

  /**
   * @private Handles the dragleave event to clear drag-over state when leaving the host.
   */
  protected _onDragLeave(event: DragEvent): void {
    if (!this._elementRef.nativeElement.contains(event.relatedTarget as Node)) {
      this._isDragOver.set(false);
    }
  }

  /**
   * @private Handles the drop event, reads dropped files and validates them.
   */
  protected _onDrop(event: DragEvent): void {
    event.preventDefault();
    this._isDragOver.set(false);
    if (this.computedDisabled()) return;
    const dt = event.dataTransfer;
    if (dt?.files) {
      this._validateAndAdd(dt.files);
    }
  }

  /**
   * @private Validates a FileList against accept/maxSize constraints and appends valid files.
   */
  private _validateAndAdd(fileList: FileList): void {
    const newErrors: MlvFileValidationError[] = [];
    const newFiles: MlvUploadedFile[] = [];
    const acceptedTypes = this._parseAccept();

    Array.from(fileList).forEach((file) => {
      // Count check
      if (!this.multiple() && this._files().length + newFiles.length >= 1) {
        newErrors.push({
          code: 'count',
          message: this._i18n().errorSingleFile,
        });
        return;
      }

      // Type check
      if (
        acceptedTypes.length > 0 &&
        !this._isTypeAccepted(file, acceptedTypes)
      ) {
        newErrors.push({
          code: 'type',
          message: this._translate('errorFileType', { name: file.name }),
        });
        return;
      }

      // Size check
      const maxBytes = this.maxSize();
      if (maxBytes > 0 && file.size > maxBytes) {
        const maxMb = (maxBytes / (1024 * 1024)).toFixed(1);
        newErrors.push({
          code: 'size',
          message: this._translate('errorFileSize', {
            name: file.name,
            size: maxMb,
          }),
        });
        return;
      }

      const isImage = file.type.startsWith('image/');
      const uploadedFile: MlvUploadedFile = {
        id: mlvNextId('mlv-file'),
        file,
        name: file.name,
        size: file.size,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        state: 'pending',
        progress: 0,
      };
      newFiles.push(uploadedFile);
    });

    this._errors.set(newErrors);

    if (newFiles.length > 0) {
      if (this.multiple()) {
        this.value.update((previous) => [...(previous ?? []), ...newFiles]);
      } else {
        // Replace previous file when multiple is false
        const previous = this._files();
        previous.forEach((f) => {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        });
        this.value.set(newFiles);
      }
      this._emitChange();
    }
  }

  /**
   * @private Resolves one of the component's ICU rejection templates with the
   * offending file's details. Keeps every user-facing validation string in the
   * language pack instead of hard-coded English.
   */
  private _translate(
    key: keyof MlvFileUploadI18n,
    params: Record<string, string>,
  ): string {
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      key,
      params,
    );
  }

  /**
   * @private Parses the accept input into a list of accepted MIME prefixes and extensions.
   */
  private _parseAccept(): string[] {
    const raw = this.accept().trim();
    if (!raw) return [];
    return raw.split(',').map((s) => s.trim().toLowerCase());
  }

  /**
   * @private Checks whether a file matches the accepted type list.
   */
  private _isTypeAccepted(file: File, accepted: string[]): boolean {
    return accepted.some((pattern) => {
      if (pattern.startsWith('.')) {
        return file.name.toLowerCase().endsWith(pattern);
      }
      if (pattern.endsWith('/*')) {
        return file.type.startsWith(pattern.slice(0, -1));
      }
      return file.type === pattern;
    });
  }

  /**
   * @private Emits the current file list through the public change output.
   */
  private _emitChange(): void {
    this.filesChange.emit(this._files());
  }
}
