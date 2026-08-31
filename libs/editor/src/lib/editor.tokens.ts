import { InjectionToken } from '@angular/core';
import {
  type MlvEditorImageUploader,
  type MlvEditorImageUploadOptions,
} from './editor.types';

/** Optional dependency-injection token for a host-provided image uploader. */
export const MLV_EDITOR_IMAGE_UPLOADER =
  new InjectionToken<MlvEditorImageUploader>('MLV_EDITOR_IMAGE_UPLOADER');

/** Default restrictions for image files inserted through the editor. */
export const MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS: MlvEditorImageUploadOptions =
  {
    accept: ['image/*'],
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1,
  };
