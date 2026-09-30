import { Injector, type StaticProvider } from '@angular/core';
import type { MlvDialogRef, MlvDialogService } from '@malva-ui/core/dialog';
import type { MlvEditorImageUploadCoordinator } from '../upload/editor-image-upload-coordinator';
import { MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR } from '../upload/editor-image-upload-coordinator';
import {
  MLV_EDITOR_IMAGE_UPLOAD_POSITION,
  MlvEditorImageUploadDialog,
} from './editor-image-upload-dialog';

/** @internal What {@link openMlvEditorImageUploadDialog} needs from its caller. */
export interface MlvEditorImageUploadDialogRequest {
  /** Malva dialog service of the caller. */
  readonly dialogs: MlvDialogService;
  /** Parent of the dialog's injector: the caller's own, inside its editor. */
  readonly injector: Injector;
  /** The editor's upload coordinator, provided to the dialog. */
  readonly coordinator: MlvEditorImageUploadCoordinator;
  /** Dialog title (the localized `uploadImage`). */
  readonly title: string;
  /**
   * Where the upload lands, read when the user submits; `null` (or absent)
   * uses the selection, as the toolbar's dialog does.
   */
  readonly position?: () => number | null;
}

/**
 * @internal Opens the editor-scoped image-upload dialog (#516, D-B9): shared
 * by the toolbar's `mlv-editor-image-upload` and the command menu's image
 * item, so both open the identical dialog. The caller keeps its own guards,
 * duplicate-open check and focus return.
 */
export function openMlvEditorImageUploadDialog(
  request: MlvEditorImageUploadDialogRequest,
): MlvDialogRef<void> {
  const providers: StaticProvider[] = [
    {
      provide: MLV_EDITOR_IMAGE_UPLOAD_COORDINATOR,
      useValue: request.coordinator,
    },
  ];
  if (request.position) {
    providers.push({
      provide: MLV_EDITOR_IMAGE_UPLOAD_POSITION,
      useValue: request.position,
    });
  }
  return request.dialogs.open<void>(MlvEditorImageUploadDialog, {
    title: request.title,
    injector: Injector.create({ parent: request.injector, providers }),
    size: 's',
  });
}
