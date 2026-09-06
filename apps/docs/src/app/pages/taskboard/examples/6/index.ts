import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import { MlvTaskboard, MlvTaskboardItemDef } from '@malva-ui/taskboard';
import type { MlvTaskboardColumn } from '@malva-ui/taskboard';

interface Ticket {
  readonly id: string;
  readonly title: string;
  readonly status: string;
}

const COLUMNS: readonly MlvTaskboardColumn[] = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'In progress' },
  { id: 'done', label: 'Done' },
];

const TICKETS: readonly Ticket[] = [
  { id: 'MLV-601', title: 'Measure the card rhythm', status: 'todo' },
  { id: 'MLV-602', title: 'Tune the column gutter', status: 'todo' },
  { id: 'MLV-603', title: 'Check the header row', status: 'doing' },
  { id: 'MLV-604', title: 'Mirror the drop slot', status: 'doing' },
  { id: 'MLV-605', title: 'Sign off the ramp', status: 'done' },
];

@Component({
  selector: 'docs-taskboard-density-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSegmented, MlvSegmentedItem, MlvTaskboard, MlvTaskboardItemDef],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class TaskboardDensityExampleComponent {
  /** The five steps of the shared density ramp, in order. */
  readonly densities: readonly MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];

  /** Density written onto the board's own `mlvDensity` host-directive input. */
  readonly density = signal<MlvDensity>('comfortable');

  readonly columns = signal<readonly MlvTaskboardColumn[]>(COLUMNS);

  readonly tickets = signal<readonly Ticket[]>(TICKETS);

  /** A second, independent board rendered inside a `dir="rtl"` wrapper. */
  readonly mirroredColumns = signal<readonly MlvTaskboardColumn[]>(COLUMNS);

  readonly mirroredTickets = signal<readonly Ticket[]>(TICKETS);

  /** Type carrier for the card templates; never read at runtime. */
  readonly ticketType = TICKETS[0];
}
