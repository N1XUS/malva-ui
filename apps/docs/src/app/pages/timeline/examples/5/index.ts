import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvTimeline, MlvTimelineItem } from '@malva-ui/core/timeline';

@Component({
  selector: 'docs-timeline-alternating-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTimeline, MlvTimelineItem],
  template: `
    <mlv-timeline>
      <mlv-timeline-item
        title="Kickoff"
        timestamp="Jan 2025"
        tone="info"
        direction="left"
      >
        Scope agreed with stakeholders and the milestone plan signed off.
      </mlv-timeline-item>
      <mlv-timeline-item
        title="Design review"
        timestamp="Feb 2025"
        tone="default"
        direction="right"
      >
        Wireframes walked through with the product and accessibility teams.
      </mlv-timeline-item>
      <mlv-timeline-item
        title="Beta release"
        timestamp="Mar 2025"
        tone="warning"
        direction="left"
      >
        Shipped to the early-access group behind a feature flag.
      </mlv-timeline-item>
      <mlv-timeline-item
        title="General availability"
        timestamp="Apr 2025"
        tone="success"
        direction="right"
      >
        Flag removed and the feature rolled out to every workspace.
      </mlv-timeline-item>
    </mlv-timeline>
  `,
})
export default class TimelineAlternatingExampleComponent {}
