import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvTimeline,
  MlvTimelineItem,
  MlvTimelineItemIcon,
} from '@malva-ui/core/timeline';
import {
  LucideShoppingCart,
  LucideCreditCard,
  LucideTruck,
  LucidePackageCheck,
} from '@lucide/angular';

@Component({
  selector: 'docs-timeline-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvTimeline,
    MlvTimelineItem,
    MlvTimelineItemIcon,
    LucideShoppingCart,
    LucideCreditCard,
    LucideTruck,
    LucidePackageCheck,
  ],
  template: `
    <mlv-timeline>
      <mlv-timeline-item
        title="Order placed"
        timestamp="Mar 24, 2025, 10:30 AM"
      >
        <ng-template mlvTimelineItemIcon>
          <svg lucideShoppingCart [size]="20" />
        </ng-template>
        Your order #45678 has been placed successfully.
      </mlv-timeline-item>
      <mlv-timeline-item
        title="Payment confirmed"
        timestamp="Mar 24, 2025, 10:32 AM"
      >
        <ng-template mlvTimelineItemIcon>
          <svg lucideCreditCard [size]="20" />
        </ng-template>
        Payment of $99.00 was processed.
      </mlv-timeline-item>
      <mlv-timeline-item
        title="Order shipped"
        timestamp="Mar 25, 2025, 2:15 PM"
      >
        <ng-template mlvTimelineItemIcon>
          <svg lucideTruck [size]="20" />
        </ng-template>
        Your package was handed off to the courier.
      </mlv-timeline-item>
      <mlv-timeline-item title="Delivered" timestamp="Mar 27, 2025, 11:00 AM">
        <ng-template mlvTimelineItemIcon>
          <svg lucidePackageCheck [size]="20" />
        </ng-template>
        Package delivered to your address.
      </mlv-timeline-item>
    </mlv-timeline>
  `,
})
export default class TimelineBasicExampleComponent {}
