import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { MlvDropdownPanel } from '@malva-ui/core/dropdown';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import { MlvChip } from '@malva-ui/core/chip';

/** Scopes an API token can be granted. */
const SCOPES: MlvSelectOption<string>[] = [
  { label: 'Read projects', value: 'projects:read' },
  { label: 'Write projects', value: 'projects:write' },
  { label: 'Read billing', value: 'billing:read' },
  { label: 'Manage members', value: 'members:write' },
  { label: 'Rotate keys', value: 'keys:rotate' },
];

@Component({
  selector: 'docs-dropdown-multiple-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDropdownPanel, MlvChip],
  providers: [MlvSelectionService],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DropdownMultipleExampleComponent {
  /** Options handed to the panel. */
  readonly scopes = SCOPES;

  /** Committed selection, in the panel's own array shape. */
  readonly selected = signal<string[]>(['projects:read']);

  /** Selected options resolved back to their labels, for the chip row. */
  readonly selectedOptions = computed(() =>
    SCOPES.filter((option) => this.selected().includes(option.value)),
  );

  /** Multi-select emits the whole selection on every toggle. */
  onValueChange(values: readonly string[]): void {
    this.selected.set([...values]);
  }

  /** Removes one scope from the chip row; the panel's check marks follow. */
  remove(value: string): void {
    this.selected.update((values) =>
      values.filter((candidate) => candidate !== value),
    );
  }
}
