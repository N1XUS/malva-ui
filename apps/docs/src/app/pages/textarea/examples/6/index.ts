import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MlvTextarea } from '@malva-ui/core/textarea';

@Component({
  selector: 'docs-textarea-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTextarea, FormField],
  templateUrl: './index.html',
})
export default class DocsTextareaSignalFormsExampleComponent {
  readonly model = signal({ bio: 'Building with Malva UI.' });
  readonly fields = form(this.model);
}
