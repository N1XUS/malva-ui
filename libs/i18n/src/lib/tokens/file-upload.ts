import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvFileUploadI18n {
  /** aria-label for selected files list. */
  selectedFiles: string;
  /** aria-label for upload complete status. */
  uploadComplete: string;
  /** aria-label for upload failed status. */
  uploadFailed: string;
  /** aria-label for remove file button. ICU template with a `{name}` placeholder for the file name. */
  removeFile: string;
  /** aria-label for the cover preview's replace button, which reopens the file picker. */
  replaceFile: string;
  /** Rejection message shown when more than one file is dropped on a single-file upload. */
  errorSingleFile: string;
  /** Rejection message for a file whose type is not in `accept`. ICU template with a `{name}` placeholder. */
  errorFileType: string;
  /** Rejection message for a file over `maxSize`. ICU template with `{name}` and `{size}` (megabytes) placeholders. */
  errorFileSize: string;
}

export const MLV_FILE_UPLOAD_I18N = new InjectionToken<
  Signal<MlvFileUploadI18n>
>('MLV_FILE_UPLOAD_I18N');

export const MLV_FILE_UPLOAD_I18N_CONTEXT: Record<
  keyof MlvFileUploadI18n,
  MlvTranslationContext
> = {
  selectedFiles: {
    component: 'mlv-file-upload',
    usage: 'aria-label',
    description: 'Label for the list of selected files',
  },
  uploadComplete: {
    component: 'mlv-file-upload',
    usage: 'aria-label',
    description: 'Status indicator: file upload succeeded',
  },
  uploadFailed: {
    component: 'mlv-file-upload',
    usage: 'aria-label',
    description: 'Status indicator: file upload failed',
  },
  removeFile: {
    component: 'mlv-file-upload',
    usage: 'aria-label',
    description:
      'Button to remove a file from the upload list. `{name}` is the file name and must be preserved in the translation.',
  },
  replaceFile: {
    component: 'mlv-file-upload',
    usage: 'aria-label',
    description:
      'Button in the cover preview toolbar that reopens the file picker to swap the selected image for another one.',
  },
  errorSingleFile: {
    component: 'mlv-file-upload',
    usage: 'message',
    description:
      'Rejection message shown when the user adds more than one file to a single-file upload.',
  },
  errorFileType: {
    component: 'mlv-file-upload',
    usage: 'message',
    description:
      'Rejection message for a file whose type is not accepted. `{name}` is the file name and must be preserved in the translation.',
  },
  errorFileSize: {
    component: 'mlv-file-upload',
    usage: 'message',
    description:
      'Rejection message for a file larger than the configured limit. `{name}` is the file name and `{size}` the limit in megabytes; both must be preserved in the translation.',
  },
};
