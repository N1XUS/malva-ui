import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MlvTimelineItemIcon } from './timeline-item-icon';
import { MlvTimelineItemMeta } from './timeline-item-meta';
import type {
  MlvTimelineItemDirection,
  MlvTimelineItemTone,
} from './timeline.types';

/**
 * A single event entry within a `mlv-timeline`.
 *
 * Renders a node circle (or projected icon), a connector line segment, a title,
 * an optional timestamp in a `<time>` element, optional meta slot content
 * (badges, chips), and a default content slot for the event description.
 *
 * The `tone` input drives the icon node accent color via BEM modifier.
 *
 * @example
 * ```html
 * <mlv-timeline-item title="Deployed" timestamp="2025-03-26T10:00:00" tone="success">
 *   <ng-template mlvTimelineItemIcon>
 *     <svg lucideRocket [size]="16" />
 *   </ng-template>
 *   Release v2.0.0 was deployed to production.
 * </mlv-timeline-item>
 * ```
 */
@Component({
  selector: 'mlv-timeline-item',
  templateUrl: './timeline-item.html',
  styleUrl: './timeline-item.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: {
    class: 'mlv-timeline-item',
    role: 'listitem',
    '[class]': '"mlv-timeline-item--" + tone()',
    '[class.mlv-timeline-item--direction-left]': 'direction() === "left"',
  },
})
export class MlvTimelineItem {
  /** The heading text for this timeline event. Required. */
  readonly title = input.required<string>();

  /**
   * The timestamp string for this event.
   * Rendered inside a `<time>` element. Should be a human-readable date/time string;
   * for machine-readable precision, use a full ISO 8601 string.
   */
  readonly timestamp = input<string>('');

  /**
   * Semantic tone controlling the icon node accent color.
   * Defaults to `'default'` (neutral).
   */
  readonly tone = input<MlvTimelineItemTone>('default');

  /**
   * MlvLayout direction for this item.
   * - `'right'` (default): node circle on the left, content on the right.
   * - `'left'`: content on the left, node circle on the right.
   *
   * Allows alternating left-right layouts within a single timeline.
   */
  readonly direction = input<MlvTimelineItemDirection>('right');

  /** @protected Template slot for the icon or avatar inside the node circle. */
  protected readonly _iconRef = contentChild(MlvTimelineItemIcon);

  /** @protected Template slot for supplementary metadata (badges, chips, etc.). */
  protected readonly _metaRef = contentChild(MlvTimelineItemMeta);
}
