import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import {
  MlvFileUpload,
  type MlvUploadedFile,
} from '@malva-ui/core/file-upload';

@Component({
  selector: 'docs-file-upload-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvFileUpload, FormField],
  templateUrl: './index.html',
})
export default class DocsFileUploadSignalFormsExampleComponent {
  readonly model = signal<{ files: MlvUploadedFile[] }>({ files: [] });
  readonly fields = form(this.model);
}
