import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvFileUpload } from '@malva-ui/core/file-upload';

@Component({
  selector: 'docs-file-upload-validation-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvFileUpload],
  templateUrl: './index.html',
})
export default class FileUploadValidationExampleComponent {
  /** Maximum allowed file size: 2 MB. */
  readonly maxSizeBytes = 2 * 1024 * 1024;
}
