import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MlvTitle } from '@malva-ui/core/title';

@Component({
  selector: 'docs-title-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTitle, FormField],
  templateUrl: './index.html',
})
export default class DocsTitleSignalFormsExampleComponent {
  readonly model = signal({ title: 'Editable signal title' });
  readonly fields = form(this.model);
}
