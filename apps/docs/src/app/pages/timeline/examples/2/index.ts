import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvTimeline, MlvTimelineItem } from '@malva-ui/core/timeline';

@Component({
  selector: 'docs-timeline-variants-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTimeline, MlvTimelineItem],
  template: `
    <mlv-timeline>
      <mlv-timeline-item title="Task started" timestamp="9:00 AM" tone="info">
        The deployment pipeline was initiated.
      </mlv-timeline-item>
      <mlv-timeline-item
        title="Tests passed"
        timestamp="9:05 AM"
        tone="success"
      >
        All 148 unit tests passed.
      </mlv-timeline-item>
      <mlv-timeline-item
        title="High memory usage"
        timestamp="9:07 AM"
        tone="warning"
      >
        Memory usage spiked to 85% during build.
      </mlv-timeline-item>
      <mlv-timeline-item title="Build failed" timestamp="9:09 AM" tone="danger">
        Step 3 failed: Docker image push timed out.
      </mlv-timeline-item>
      <mlv-timeline-item
        title="Retry scheduled"
        timestamp="9:10 AM"
        tone="default"
      >
        Automatic retry in 5 minutes.
      </mlv-timeline-item>
    </mlv-timeline>
  `,
})
export default class TimelineVariantsExampleComponent {}
