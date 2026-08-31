import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { form, required, FormField } from '@angular/forms/signals';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';

@Component({
  selector: 'docs-segmented-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSegmented, MlvSegmentedItem, FormsModule, FormField],
  templateUrl: './index.html',
})
export default class SegmentedFormsExampleComponent {
  readonly billing = signal<'monthly' | 'yearly'>('monthly');
  readonly model = signal({ plan: 'pro' });
  readonly fields = form(this.model, (path) => {
    required(path.plan);
  });
}
