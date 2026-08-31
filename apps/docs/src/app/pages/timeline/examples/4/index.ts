import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvTimeline,
  MlvTimelineItem,
  MlvTimelineItemIcon,
  MlvTimelineItemMeta,
} from '@malva-ui/core/timeline';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvChip } from '@malva-ui/core/chip';
import { LucideGitCommit, LucideGitMerge } from '@lucide/angular';

@Component({
  selector: 'docs-timeline-badge-chip-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvTimeline,
    MlvTimelineItem,
    MlvTimelineItemIcon,
    MlvTimelineItemMeta,
    MlvBadge,
    MlvChip,
    LucideGitCommit,
    LucideGitMerge,
  ],
  template: `
    <mlv-timeline>
      <mlv-timeline-item
        title="Commit pushed"
        timestamp="Mar 26, 2025"
        tone="default"
      >
        <ng-template mlvTimelineItemIcon>
          <svg lucideGitCommit [size]="16" />
        </ng-template>
        <ng-template mlvTimelineItemMeta>
          <mlv-badge tone="info" muted>feat</mlv-badge>
          <mlv-chip>main</mlv-chip>
        </ng-template>
        Added responsive grid layout to the dashboard page.
      </mlv-timeline-item>
      <mlv-timeline-item
        title="Pull request merged"
        timestamp="Mar 27, 2025"
        tone="success"
      >
        <ng-template mlvTimelineItemIcon>
          <svg lucideGitMerge [size]="16" />
        </ng-template>
        <ng-template mlvTimelineItemMeta>
          <mlv-badge tone="success" muted>merged</mlv-badge>
          <mlv-chip>release/v2.0</mlv-chip>
        </ng-template>
        PR #142: Dashboard redesign merged into release branch.
      </mlv-timeline-item>
    </mlv-timeline>
  `,
})
export default class TimelineBadgeChipExampleComponent {}
