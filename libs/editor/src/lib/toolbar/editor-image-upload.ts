import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
  ViewEncapsulation,
  type Signal,
} from '@angular/core';
import { LucideImage } from '@lucide/angular';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvDialogService, type MlvDialogRef } from '@malva-ui/core/dialog';
import { MlvProgress } from '@malva-ui/core/progress';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MLV_EDITOR_I18N, MLV_FILE_UPLOAD_I18N } from '@malva-ui/i18n';
import {
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import {
  MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR,
  resolveMlvEditorImageUploadCoordinator,
} from '../upload/editor-image-upload-coordinator';
import { openMlvEditorImageUploadDialog } from './editor-image-upload-opener';
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

/** Public toolbar entry point for the editor image-upload dialog. */
@Component({
  selector: 'mlv-editor-image-upload',
  imports: [
    LucideImage,
    MlvButton,
    MlvButtonIcon,
    MlvTooltip,
    MlvEditorToolbarWidget,
  ],
  templateUrl: './editor-image-upload.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-image-upload',
    '[hidden]': '!_visible()',
  },
})
export class MlvEditorImageUpload {
  /** @protected Editor-scoped command/form state. */
  protected readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @protected Shared upload coordinator for this editor instance. */
  protected readonly _coordinator = computed(() =>
    resolveMlvEditorImageUploadCoordinator(this._context.imageUpload),
  );

  /** @private Transaction invalidation for runtime command support. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });

  /** @private Malva dialog service used for the one modal surface. */
  private readonly _dialogs = inject(MlvDialogService);

  /** @private Exact child injector passed through to the dialog portal. */
  private readonly _injector = inject(Injector);

  /** @private Trigger restored by the shared dialog lifecycle. */
  private readonly _trigger = viewChild.required('_trigger', {
    read: ElementRef,
  }) as Signal<ElementRef<HTMLButtonElement>>;

  /** @private Current dialog, preventing duplicate opens. */
  private _dialogRef: MlvDialogRef<void> | undefined;

  /** @private Component teardown closes any owned dialog. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @protected Reactive localized trigger copy. */
  protected readonly _copy = computed(
    () => this._i18n?.().uploadImage ?? 'Upload image',
  );

  /** @protected Whether the editor has both required upload commands. */
  protected readonly _supported = computed(() => {
    this._revision?.();
    const commands = this._context.editor()?.commands as
      | Record<string, unknown>
      | undefined;
    return (
      typeof commands?.['setImage'] === 'function' &&
      typeof commands?.['insertUploadPlaceholder'] === 'function' &&
      typeof commands?.['replaceUploadPlaceholder'] === 'function'
    );
  });

  /** @protected Whether the mutation entry point belongs in this toolbar. */
  protected readonly _visible = computed(
    () =>
      !!this._coordinator() &&
      !!this._coordinator()?.adapterAvailable() &&
      this._supported() &&
      !this._context.readonly(),
  );

  /** @protected Whether the visible trigger is currently inert. */
  protected readonly _disabled = computed(
    () =>
      this._context.disabled() ||
      this._context.readonly() ||
      !this._coordinator()?.available(),
  );

  constructor() {
    effect(() => {
      if (
        this._dialogRef &&
        (this._context.disabled() || this._context.readonly())
      ) {
        this._dialogRef.close();
      }
    });
    this._destroyRef.onDestroy(() => this._dialogRef?.close());
  }

  /** @protected Opens one editor-scoped Malva upload dialog. */
  protected _open(): void {
    const coordinator = this._coordinator();
    if (
      !coordinator ||
      this._disabled() ||
      !this._visible() ||
      this._dialogRef
    ) {
      return;
    }
    const trigger = this._trigger().nativeElement;
    const ref = openMlvEditorImageUploadDialog({
      dialogs: this._dialogs,
      injector: this._injector,
      coordinator,
      title: this._copy(),
    });
    this._dialogRef = ref;
    ref.afterClosed().subscribe(() => {
      if (this._dialogRef === ref) this._dialogRef = undefined;
      if (
        !this._context.disabled() &&
        trigger.isConnected &&
        trigger.ownerDocument.activeElement !== trigger
      ) {
        trigger.focus();
      }
    });
  }
}

/** @internal Non-serializable pending-upload surface owned by the editor shell. */
@Component({
  selector: 'mlv-editor-image-upload-status',
  imports: [MlvButton, MlvProgress],
  template: `
    @if (_pending().length) {
      <ul class="mlv-editor-image-upload-status__list">
        @for (item of _pending(); track item.id) {
          <li class="mlv-editor-image-upload-status__item">
            <span class="mlv-editor-image-upload-status__name">{{
              item.file.name
            }}</span>
            @if (item.status === 'uploading') {
              <mlv-progress
                size="s"
                [value]="item.progress"
                [showPercentage]="true"
                [ariaLabel]="_progressLabel(item.progress)"
              />
              <button
                mlvButton
                type="button"
                variant="secondary"
                [attr.aria-label]="_copy().cancel"
                [disabled]="_disabled()"
                (click)="_cancel(item.id)"
              >
                {{ _copy().cancel }}
              </button>
            } @else {
              <span role="alert">{{ _copy().failed }}</span>
              <button
                mlvButton
                type="button"
                variant="secondary"
                [attr.aria-label]="_copy().retry"
                [disabled]="_disabled()"
                (click)="_coordinator.retry(item.id)"
              >
                {{ _copy().retry }}
              </button>
              <button
                mlvButton
                type="button"
                variant="secondary"
                [attr.aria-label]="_removeLabel(item.file.name)"
                [disabled]="_disabled()"
                (click)="_coordinator.remove(item.id)"
              >
                {{ _removeLabel(item.file.name) }}
              </button>
            }
          </li>
        }
      </ul>
    }
    <span
      class="mlv-editor-image-upload-status__live"
      aria-live="polite"
      aria-atomic="true"
      >{{ _announcement() }}</span
    >
  `,
  styleUrl: './editor-image-upload-dialog.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-editor-image-upload-status' },
})
export class MlvEditorImageUploadStatus {
  /** @protected Shared editor coordinator. */
  protected readonly _coordinator = inject(MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR);

  /** @private Editor state guarding mutation actions. */
  private readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @private Localized file removal copy. */
  private readonly _fileI18n = inject(MLV_FILE_UPLOAD_I18N);

  /** @protected Current active and retryable uploads. */
  protected readonly _pending = this._coordinator.pending;

  /** @protected Polite coarse-grained live-region text. */
  protected readonly _announcement = signal('');

  /** @private Last announced progress bucket for each active item. */
  private readonly _buckets = new Map<string, number>();

  /**
   * @private Upload whose progress or failure the live region currently
   * reads, or `null` when it reads a terminal announcement (or nothing).
   */
  private _announcedId: string | null = null;

  /** @protected Whether status actions are inert. */
  protected readonly _disabled = computed(
    () => this._context.disabled() || this._context.readonly(),
  );

  /** @protected Reactive localized status/action copy. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      cancel: copy?.cancelUpload ?? 'Cancel upload',
      retry: copy?.retryUpload ?? 'Retry upload',
      failed: copy?.imageUploadFailed ?? 'Image upload failed.',
      progress: copy?.uploadProgress ?? 'Uploading image: {progress}%',
    };
  });

  constructor() {
    effect(() => {
      const pending = this._pending();

      for (const item of pending) {
        if (item.status === 'failed') {
          this._announce(this._copy().failed, item.id);
          this._buckets.delete(item.id);
          continue;
        }
        const bucket = Math.floor(item.progress / 10) * 10;
        if (this._buckets.get(item.id) === bucket) continue;
        this._buckets.set(item.id, bucket);
        this._announce(this._progressLabel(bucket), item.id);
      }
    });
    const stopTerminalEvents = this._coordinator.onTerminal(
      ({ id, reason }) => {
        this._buckets.delete(id);
        if (reason === 'success' && !this._coordinator.hasDialogOwner(id)) {
          this._announce(this._fileI18n().uploadComplete, null);
        } else if (reason === 'cancelled') {
          this._announce(this._copy().cancel, null);
        } else if (this._announcedId === id) {
          // A dialog-owned success (the dialog announces it), a lifecycle
          // abort or a removed failure: the ended upload's progress or
          // failure text must not outlive it. Another upload's text stays.
          this._announce('', null);
        }
      },
    );
    inject(DestroyRef).onDestroy(stopTerminalEvents);
  }

  /** @protected Formats localized coarse progress. */
  protected _progressLabel(progress: number): string {
    return this._copy().progress.replace(
      '{progress}',
      String(Math.floor(progress / 10) * 10),
    );
  }

  /** @private Writes the live region and records which upload it describes. */
  private _announce(text: string, id: string | null): void {
    this._announcement.set(text);
    this._announcedId = id;
  }

  /** @protected Labels a remove action without exposing a bare icon. */
  protected _removeLabel(name: string): string {
    return this._fileI18n().removeFile.replace('{name}', name);
  }

  /** @protected Cancels an active upload and announces the semantic state. */
  protected _cancel(id: string): void {
    this._coordinator.cancel(id);
  }
}
