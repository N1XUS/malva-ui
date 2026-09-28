import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MlvLoader } from '@malva-ui/core/loader';
import { LucideFile, LucideCircleCheck, LucideCircleX } from '@lucide/angular';
import { MLV_FILE_UPLOAD_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import type { MlvUploadedFile } from '../file-upload/file-upload.types';
import { MlvButtonClose } from '@malva-ui/core/button';

/**
 * Renders a single uploaded file row with thumbnail, metadata, progress bar,
 * status icon, and a remove button.
 */
@Component({
  selector: 'mlv-file-upload-item',
  templateUrl: './file-upload-item.html',
  styleUrl: './file-upload-item.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvLoader,
    LucideFile,
    LucideCircleCheck,
    LucideCircleX,
    MlvButtonClose,
  ],
  host: {
    class: 'mlv-file-upload-item',
    '[class.mlv-file-upload-item--uploading]': 'file().state === "uploading"',
    '[class.mlv-file-upload-item--success]': 'file().state === "success"',
    '[class.mlv-file-upload-item--error]': 'file().state === "error"',
  },
})
export class MlvFileUploadItem {
  /** @protected Injected i18n translations for the file upload. */
  protected readonly _i18n = inject(MLV_FILE_UPLOAD_I18N);

  /** @private ICU MessageFormat resolver for parameterised i18n strings. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /** The uploaded file descriptor to render. */
  readonly file = input.required<MlvUploadedFile>();

  /**
   * Disables the row's remove button: it leaves the tab order, does not
   * activate, and `remove` does not emit. `mlv-file-upload` binds its own
   * resolved disabled state here. The row's disabled ink comes from the
   * owning `mlv-file-upload--disabled` scope, not from this input.
   */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * @protected Accessible label for the remove button, naming the specific file
   * (e.g. `"Remove report.xlsx"`) so screen-reader users know which file the
   * button removes. Resolves the `removeFile` ICU template with the file name.
   */
  protected readonly _removeLabel = computed(() =>
    this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'removeFile',
      { name: this.file().name },
    ),
  );

  /** Emits when the user clicks the remove button. Never emits while `disabled`. */
  readonly remove = output<void>();

  /**
   * @protected Emits `remove` unless the row is disabled. The disabled inner
   * button already swallows its own click; this also covers a click dispatched
   * on the `mlv-button-close` host element itself.
   */
  protected _onRemove(): void {
    if (this.disabled()) return;
    this.remove.emit();
  }

  /** @protected Human-readable file size string (e.g. "1.2 MB"). */
  protected readonly _formattedSize = computed(() => {
    const bytes = this.file().size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  });

  /** @protected Whether to show the progress bar. */
  protected readonly _showProgress = computed(
    () => this.file().state === 'uploading',
  );

  /** @protected Current progress value for the loader bar. */
  protected readonly _progress = computed(() => this.file().progress ?? 0);
}
