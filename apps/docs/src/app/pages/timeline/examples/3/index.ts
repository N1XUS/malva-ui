import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvTimeline,
  MlvTimelineItem,
  MlvTimelineItemIcon,
} from '@malva-ui/core/timeline';
import { MlvAvatar } from '@malva-ui/core/avatar';

@Component({
  selector: 'docs-timeline-avatar-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTimeline, MlvTimelineItem, MlvTimelineItemIcon, MlvAvatar],
  template: `
    <mlv-timeline>
      <mlv-timeline-item
        title="Alice commented"
        timestamp="2 hours ago"
        direction="right"
      >
        <ng-template mlvTimelineItemIcon>
          <mlv-avatar
            src="https://i.pravatar.cc/40?img=1"
            name="Alice Kim"
            size="s"
          />
        </ng-template>
        "Looks great! I have a few suggestions on the layout."
      </mlv-timeline-item>
      <mlv-timeline-item
        title="Bob approved"
        timestamp="1 hour ago"
        tone="success"
        direction="left"
      >
        <ng-template mlvTimelineItemIcon>
          <mlv-avatar
            src="https://i.pravatar.cc/40?img=3"
            name="Bob Chen"
            size="s"
          />
        </ng-template>
        Pull request approved and merged to main.
      </mlv-timeline-item>
      <mlv-timeline-item
        title="Carol deployed"
        timestamp="30 minutes ago"
        tone="info"
        direction="right"
      >
        <ng-template mlvTimelineItemIcon>
          <mlv-avatar
            src="https://i.pravatar.cc/40?img=5"
            name="Carol Davis"
            size="s"
          />
        </ng-template>
        Deployed v1.4.2 to production environment.
      </mlv-timeline-item>
      <mlv-timeline-item
        title="Dan reviewed"
        timestamp="15 minutes ago"
        tone="warning"
        direction="left"
      >
        <ng-template mlvTimelineItemIcon>
          <mlv-avatar
            src="https://i.pravatar.cc/40?img=7"
            name="Dan Miller"
            size="s"
          />
        </ng-template>
        Flagged two accessibility issues for follow-up.
      </mlv-timeline-item>
    </mlv-timeline>
  `,
})
export default class TimelineAvatarExampleComponent {}
