import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCombobox } from '@malva-ui/core/combobox';

@Component({
  selector: 'docs-combobox-disabled-example',
  imports: [MlvButton, MlvCombobox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ComboboxDisabledExampleComponent {
  readonly disabled = signal(true);
  readonly readonly = signal(false);
  readonly languages = [
    'CSS',
    'Go',
    'JavaScript',
    'Python',
    'Rust',
    'TypeScript',
  ];

  toggleDisabled(): void {
    this.disabled.update((v) => !v);
  }

  toggleReadonly(): void {
    this.readonly.update((v) => !v);
  }
}
