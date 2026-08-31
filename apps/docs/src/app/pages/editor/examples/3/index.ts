import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MlvButton } from '@malva-ui/core/button';
import { MlvEditor } from '@malva-ui/editor';

@Component({
  selector: 'docs-editor-angular-forms-example',
  imports: [FormsModule, MlvButton, MlvEditor, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorAngularFormsExample {
  readonly reactive = new FormControl<string | null>(
    '<p>Reactive form value</p>',
  );
  readonly templateValue = signal<string | null>(
    '<p>Template-driven value</p>',
  );
  readonly templateDisabled = signal(false);

  protected toggleReactive(): void {
    if (this.reactive.disabled) this.reactive.enable();
    else this.reactive.disable();
  }
}
