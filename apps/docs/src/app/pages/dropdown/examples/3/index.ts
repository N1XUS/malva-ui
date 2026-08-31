import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { MlvDropdownPanel } from '@malva-ui/core/dropdown';
import { MlvSelectionService } from '@malva-ui/core/form-utils';

/**
 * Regions clustered by continent. Consecutive same-`group` runs become one
 * section; the trailing entries carry no group and render headerless.
 */
const REGIONS: MlvSelectOption<string>[] = [
  { label: 'Frankfurt (eu-central-1)', value: 'eu-central-1', group: 'Europe' },
  { label: 'Ireland (eu-west-1)', value: 'eu-west-1', group: 'Europe' },
  { label: 'London (eu-west-2)', value: 'eu-west-2', group: 'Europe' },
  { label: 'Paris (eu-west-3)', value: 'eu-west-3', group: 'Europe' },
  {
    label: 'N. Virginia (us-east-1)',
    value: 'us-east-1',
    group: 'North America',
  },
  { label: 'Ohio (us-east-2)', value: 'us-east-2', group: 'North America' },
  {
    label: 'Oregon (us-west-2)',
    value: 'us-west-2',
    group: 'North America',
  },
  { label: 'Mumbai (ap-south-1)', value: 'ap-south-1', group: 'Asia Pacific' },
  {
    label: 'Singapore (ap-southeast-1)',
    value: 'ap-southeast-1',
    group: 'Asia Pacific',
  },
  {
    label: 'Sydney (ap-southeast-2)',
    value: 'ap-southeast-2',
    group: 'Asia Pacific',
  },
  {
    label: 'Tokyo (ap-northeast-1)',
    value: 'ap-northeast-1',
    group: 'Asia Pacific',
  },
  { label: 'Nearest to visitor', value: 'auto' },
  { label: 'Pinned by policy', value: 'policy' },
];

@Component({
  selector: 'docs-dropdown-groups-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDropdownPanel],
  providers: [MlvSelectionService],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DropdownGroupsExampleComponent {
  /** Options handed to the panel, in the order they render. */
  readonly regions = REGIONS;

  /** Committed selection. */
  readonly selected = signal<string[]>(['eu-west-1']);

  /** Label of the committed option, for the live result line. */
  readonly selectedLabel = computed(
    () =>
      REGIONS.find((option) => option.value === this.selected()[0])?.label ??
      'None',
  );

  /** Keeps the last picked value; single-select emits at most one. */
  onValueChange(values: readonly string[]): void {
    this.selected.set(values.length ? [values[values.length - 1]] : []);
  }
}
