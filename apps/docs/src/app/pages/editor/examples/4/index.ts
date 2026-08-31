import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  disabled as disabledField,
  form,
  FormField,
  required,
} from '@angular/forms/signals';
import { MlvButton } from '@malva-ui/core/button';
import { MlvEditor } from '@malva-ui/editor';

@Component({
  selector: 'docs-editor-signal-forms-example',
  imports: [FormField, MlvButton, MlvEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorSignalFormsExample {
  readonly disabled = signal(false);
  readonly model = signal<{ body: string | null }>({ body: null });
  readonly fields = form(this.model, (path) => {
    required(path.body, { message: 'A document body is required' });
    disabledField(path.body, () => this.disabled());
  });
}
