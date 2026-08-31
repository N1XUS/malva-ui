import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvCombobox } from '@malva-ui/core/combobox';

@Component({
  selector: 'docs-combobox-allow-create-example',
  imports: [MlvCombobox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ComboboxAllowCreateExampleComponent {
  tags = signal(['frontend', 'backend', 'design', 'devops']);

  onTagCreated(value: string): void {
    this.tags.update((tags) => [...tags, value]);
  }
}
