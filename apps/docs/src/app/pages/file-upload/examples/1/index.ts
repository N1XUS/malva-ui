import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvFileUpload } from '@malva-ui/core/file-upload';

@Component({
  selector: 'docs-file-upload-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvFileUpload],
  templateUrl: './index.html',
})
export default class FileUploadBasicExampleComponent {}
