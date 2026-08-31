import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';

@Component({
  selector: 'docs-scrollbar-both-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvScrollbar],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ScrollbarBothExampleComponent {
  readonly columns = [
    'Name',
    'Role',
    'Department',
    'Location',
    'Status',
    'Last Active',
    'Actions',
  ];
  readonly rows = [
    [
      'Alice Johnson',
      'Senior Engineer',
      'Platform',
      'Berlin',
      'Active',
      '2 min ago',
      '—',
    ],
    [
      'Bob Martinez',
      'Product Designer',
      'Design',
      'London',
      'Active',
      '14 min ago',
      '—',
    ],
    [
      'Carol Chen',
      'Engineering Manager',
      'Platform',
      'Singapore',
      'Away',
      '1 h ago',
      '—',
    ],
    [
      'David Kim',
      'Data Analyst',
      'Analytics',
      'Seoul',
      'Active',
      '5 min ago',
      '—',
    ],
    [
      'Eva Müller',
      'QA Engineer',
      'Quality',
      'Munich',
      'Offline',
      '2 d ago',
      '—',
    ],
    [
      'Frank Osei',
      'Backend Engineer',
      'Platform',
      'Accra',
      'Active',
      'Just now',
      '—',
    ],
    [
      'Grace Tanaka',
      'UX Researcher',
      'Design',
      'Tokyo',
      'Active',
      '30 min ago',
      '—',
    ],
    [
      'Hiro Patel',
      'DevOps Engineer',
      'Infrastructure',
      'Mumbai',
      'Away',
      '3 h ago',
      '—',
    ],
  ];
}
