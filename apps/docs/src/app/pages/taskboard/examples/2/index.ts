import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvTaskboard,
  MlvTaskboardColumnHeaderDef,
  MlvTaskboardItemDef,
  MlvTaskboardSwimlaneDef,
} from '@malva-ui/taskboard';
import type {
  MlvTaskboardColumn,
  MlvTaskboardColumnGroup,
  MlvTaskboardKey,
  MlvTaskboardSwimlane,
} from '@malva-ui/taskboard';

interface Ticket {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly team: string;
}

const TICKETS: readonly Ticket[] = [
  { id: 'MLV-201', title: 'Token audit', status: 'triage', team: 'design' },
  { id: 'MLV-202', title: 'Focus ring pass', status: 'build', team: 'design' },
  { id: 'MLV-203', title: 'Contrast sweep', status: 'build', team: 'design' },
  { id: 'MLV-204', title: 'Release notes', status: 'review', team: 'design' },
  { id: 'MLV-205', title: 'Drag adapters', status: 'triage', team: 'core' },
  { id: 'MLV-206', title: 'Virtual cells', status: 'build', team: 'core' },
  { id: 'MLV-207', title: 'Keyboard model', status: 'review', team: 'core' },
  { id: 'MLV-208', title: 'Locale packs', status: 'shipped', team: 'core' },
];

@Component({
  selector: 'docs-taskboard-structure-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideChevronDown,
    MlvButton,
    MlvTaskboard,
    MlvTaskboardColumnHeaderDef,
    MlvTaskboardItemDef,
    MlvTaskboardSwimlaneDef,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class TaskboardStructureExampleComponent {
  /** Two phases spanning four columns; a group limit caps the whole phase. */
  readonly columnGroups: readonly MlvTaskboardColumnGroup[] = [
    { id: 'planning', label: 'Planning' },
    { id: 'delivery', label: 'Delivery', wipLimit: 5 },
  ];

  readonly columns = signal<readonly MlvTaskboardColumn[]>([
    { id: 'triage', label: 'Triage', groupId: 'planning' },
    { id: 'build', label: 'Build', groupId: 'delivery', wipLimit: 3 },
    { id: 'review', label: 'Review', groupId: 'delivery', wipLimit: 2 },
    { id: 'shipped', label: 'Shipped', groupId: 'delivery' },
  ]);

  /** One row per team; the lane limit counts every card in that row. */
  readonly swimlanes: readonly MlvTaskboardSwimlane[] = [
    { id: 'design', label: 'Design', wipLimit: 5 },
    { id: 'core', label: 'Core' },
  ];

  readonly tickets = signal<readonly Ticket[]>(TICKETS);

  /** Type carrier for the projected templates; never read at runtime. */
  readonly ticketType = TICKETS[0];

  /** Collapsed columns — the board reflects them, this example owns them. */
  readonly collapsedColumns = signal<ReadonlySet<MlvTaskboardKey>>(
    new Set<MlvTaskboardKey>(['shipped']),
  );

  /** Collapsed swimlanes, owned the same way. */
  readonly collapsedLanes = signal<ReadonlySet<MlvTaskboardKey>>(
    new Set<MlvTaskboardKey>(),
  );

  /** Whether a column currently renders collapsed. */
  isColumnCollapsed(id: MlvTaskboardKey): boolean {
    return this.collapsedColumns().has(id);
  }

  /** Whether a swimlane currently renders collapsed. */
  isLaneCollapsed(id: MlvTaskboardKey): boolean {
    return this.collapsedLanes().has(id);
  }

  /** Flips one column between collapsed and expanded. */
  toggleColumn(id: MlvTaskboardKey): void {
    this.collapsedColumns.update((current) => toggle(current, id));
  }

  /** Flips one swimlane between collapsed and expanded. */
  toggleLane(id: MlvTaskboardKey): void {
    this.collapsedLanes.update((current) => toggle(current, id));
  }
}

/** Returns a new set with `id` added when absent and removed when present. */
function toggle(
  current: ReadonlySet<MlvTaskboardKey>,
  id: MlvTaskboardKey,
): ReadonlySet<MlvTaskboardKey> {
  const next = new Set(current);
  if (!next.delete(id)) next.add(id);
  return next;
}
