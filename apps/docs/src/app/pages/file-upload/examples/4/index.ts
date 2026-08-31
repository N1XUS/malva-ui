import { Component, ChangeDetectionStrategy, computed } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MlvFileUpload } from '@malva-ui/core/file-upload';
import type { MlvUploadedFile } from '@malva-ui/core/file-upload';

@Component({
  selector: 'docs-file-upload-reactive-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvFileUpload, ReactiveFormsModule],
  templateUrl: './index.html',
})
export default class FileUploadReactiveFormsExampleComponent {
  /** Reactive form control bound to the file upload component. */
  readonly filesControl = new FormControl<MlvUploadedFile[]>([]);

  /** Derived count of currently selected files. */
  readonly fileCount = computed(() => (this.filesControl.value ?? []).length);

  /** Toggle disabled state on the control. */
  toggleDisabled(): void {
    if (this.filesControl.disabled) {
      this.filesControl.enable();
    } else {
      this.filesControl.disable();
    }
  }

  /** Clear all selected files. */
  clear(): void {
    this.filesControl.reset([]);
  }
}
