import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { MlvDropdownPanel } from '@malva-ui/core/dropdown';
import { MlvSelectionService } from '@malva-ui/core/form-utils';

/** Deploy targets rendered by the panel. */
const ENVIRONMENTS: MlvSelectOption<string>[] = [
  { label: 'Production', value: 'production' },
  { label: 'Staging', value: 'staging' },
  { label: 'Preview', value: 'preview' },
  { label: 'Local', value: 'local' },
];

@Component({
  selector: 'docs-dropdown-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDropdownPanel],
  // `mlv-dropdown-panel` injects `MlvSelectionService` non-optionally; a panel
  // used outside `mlv-select` / `mlv-combobox` has to supply it itself.
  providers: [MlvSelectionService],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DropdownBasicExampleComponent {
  /** Options handed to the panel. */
  readonly environments = ENVIRONMENTS;

  /** Committed selection — always an array, even in single-select mode. */
  readonly selected = signal<string[]>(['staging']);

  /** Label of the committed option, for the live result line. */
  readonly selectedLabel = computed(
    () =>
      ENVIRONMENTS.find((option) => option.value === this.selected()[0])
        ?.label ?? 'None',
  );

  /** Keeps the last picked value; single-select emits at most one. */
  onValueChange(values: readonly string[]): void {
    this.selected.set(values.length ? [values[values.length - 1]] : []);
  }
}
