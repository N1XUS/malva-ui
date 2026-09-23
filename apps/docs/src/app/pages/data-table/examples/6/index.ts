import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  MlvDataTableColumn,
  MlvEditSaveEvent,
} from '@malva-ui/core/data-table';
import {
  MlvDataTable,
  MlvDataTableCell,
  MlvDataTableEditCell,
} from '@malva-ui/core/data-table';
import { MlvInput } from '@malva-ui/core/input';
import { MlvBadge } from '@malva-ui/core/badge';

interface TeamMember {
  id: number;
  name: string;
  role: string;
  email: string;
  location: string;
  status: 'active' | 'on-leave' | 'inactive';
}

const INITIAL_TEAM: TeamMember[] = [
  {
    id: 1,
    name: 'Sofia Andersson',
    role: 'Lead Engineer',
    email: 'sofia@example.com',
    location: 'Stockholm',
    status: 'active',
  },
  {
    id: 2,
    name: 'Marcus Chen',
    role: 'Senior Designer',
    email: 'marcus@example.com',
    location: 'San Francisco',
    status: 'active',
  },
  {
    id: 3,
    name: 'Priya Sharma',
    role: 'Product Manager',
    email: 'priya@example.com',
    location: 'London',
    status: 'on-leave',
  },
  {
    id: 4,
    name: "James O'Connor",
    role: 'Backend Developer',
    email: 'james@example.com',
    location: 'Dublin',
    status: 'active',
  },
  {
    id: 5,
    name: 'Yuki Tanaka',
    role: 'QA Engineer',
    email: 'yuki@example.com',
    location: 'Tokyo',
    status: 'active',
  },
  {
    id: 6,
    name: 'Elena Popova',
    role: 'DevOps Engineer',
    email: 'elena@example.com',
    location: 'Berlin',
    status: 'inactive',
  },
  {
    id: 7,
    name: 'Omar Hassan',
    role: 'Frontend Dev',
    email: 'omar@example.com',
    location: 'Cairo',
    status: 'active',
  },
  {
    id: 8,
    name: 'Ana Silva',
    role: 'Data Analyst',
    email: 'ana@example.com',
    location: 'Lisbon',
    status: 'active',
  },
];

@Component({
  selector: 'docs-data-table-editable-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MlvDataTable,
    MlvDataTableCell,
    MlvDataTableEditCell,
    MlvInput,
    MlvBadge,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DataTableEditableExampleComponent {
  readonly team = signal<TeamMember[]>(structuredClone(INITIAL_TEAM));
  readonly lastAction = signal('');

  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: '#', width: '60px', align: 'center' },
    { key: 'name', title: 'Name', sortable: true },
    { key: 'role', title: 'Role', sortable: true },
    { key: 'email', title: 'Email' },
    { key: 'location', title: 'Location', sortable: true },
    { key: 'status', title: 'Status', width: '110px' },
  ];

  onSave(event: MlvEditSaveEvent): void {
    // Write back by identity: `sourceRow` is the object this table was given,
    // while `index` is a position in the current (sorted) view, not in `team`.
    const saved = event.row as unknown as TeamMember;
    const source = event.sourceRow as unknown as TeamMember;
    this.team.update((rows) =>
      rows.map((row) => (row === source ? saved : row)),
    );
    this.lastAction.set(`Saved ${saved.name}`);
  }

  onAddRow(): void {
    const rows = [...this.team()];
    const newId = Math.max(...rows.map((r) => r.id)) + 1;
    rows.push({
      id: newId,
      name: '',
      role: '',
      email: '',
      location: '',
      status: 'active',
    });
    this.team.set(rows);
    this.lastAction.set(`Added new row #${newId}`);
  }
}
