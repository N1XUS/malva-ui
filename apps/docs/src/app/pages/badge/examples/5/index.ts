import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import type { MlvBadgeTone } from '@malva-ui/core/badge';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvButton, MlvButtonBefore } from '@malva-ui/core/button';
import { LucideRefreshCw } from '@lucide/angular';

interface Task {
  id: number;
  name: string;
  status: string;
  tone: MlvBadgeTone;
}

@Component({
  selector: 'docs-badge-dynamic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvBadge, MlvButton, MlvButtonBefore, LucideRefreshCw],
  templateUrl: './index.html',
})
export default class BadgeDynamicExampleComponent {
  /** Whether to use muted style for all badges. */
  readonly isMuted = signal(false);

  readonly tasks: Task[] = [
    { id: 1, name: 'Design review', status: 'Done', tone: 'success' },
    { id: 2, name: 'API integration', status: 'In Progress', tone: 'primary' },
    { id: 3, name: 'Unit tests', status: 'Blocked', tone: 'danger' },
    { id: 4, name: 'Performance audit', status: 'Scheduled', tone: 'info' },
    { id: 5, name: 'Accessibility pass', status: 'Pending', tone: 'warning' },
    { id: 6, name: 'Documentation', status: 'Not Started', tone: 'default' },
  ];

  /** Toggle muted mode for all badges. */
  toggleMuted(): void {
    this.isMuted.update((v) => !v);
  }
}
