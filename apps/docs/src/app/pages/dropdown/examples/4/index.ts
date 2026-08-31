import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { MlvDropdownPanel, resolveOptions } from '@malva-ui/core/dropdown';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvBadge } from '@malva-ui/core/badge';
import { LucideCheck } from '@lucide/angular';

/** A reviewer the panel can assign work to. */
interface Reviewer {
  readonly id: string;
  readonly name: string;
  readonly team: string;
  readonly available: boolean;
}

/** Domain records — not options yet. */
const REVIEWERS: Reviewer[] = [
  { id: 'ada', name: 'Ada Lovelace', team: 'Platform', available: true },
  { id: 'grace', name: 'Grace Hopper', team: 'Platform', available: true },
  { id: 'alan', name: 'Alan Turing', team: 'Security', available: false },
  { id: 'radia', name: 'Radia Perlman', team: 'Security', available: true },
  {
    id: 'katherine',
    name: 'Katherine Johnson',
    team: 'Data',
    available: false,
  },
];

@Component({
  selector: 'docs-dropdown-item-template-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDropdownPanel, MlvAvatar, MlvBadge, LucideCheck],
  providers: [MlvSelectionService],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DropdownItemTemplateExampleComponent {
  /**
   * Domain records mapped to options once. `label` still feeds type-ahead and
   * the accessible name, even though the row is drawn by the custom template.
   */
  readonly options: MlvSelectOption<Reviewer>[] = resolveOptions(
    REVIEWERS,
    (reviewer) => ({
      label: reviewer.name,
      value: reviewer,
      group: reviewer.team,
    }),
  );

  /** Committed selection — whole records, compared by reference. */
  readonly selected = signal<Reviewer[]>([REVIEWERS[0]]);

  /** Name of the assigned reviewer, for the live result line. */
  readonly assignedName = computed(() => this.selected()[0]?.name ?? 'Nobody');

  /** Keeps the last picked record; single-select emits at most one. */
  onValueChange(values: readonly Reviewer[]): void {
    this.selected.set(values.length ? [values[values.length - 1]] : []);
  }
}
