import { Directive, inject, TemplateRef } from '@angular/core';

/**
 * Slot directive for supplementary metadata content displayed in the timeline item.
 *
 * Use with `<ng-template mlvTimelineItemMeta>` inside a `mlv-timeline-item` element.
 * Intended for badges, chips, status indicators, or other compact metadata.
 *
 * @example
 * ```html
 * <mlv-timeline-item title="Review">
 *   <ng-template mlvTimelineItemMeta>
 *     <mlv-badge tone="warning">Pending</mlv-badge>
 *   </ng-template>
 *   Awaiting code review.
 * </mlv-timeline-item>
 * ```
 */
@Directive({
  selector: '[mlvTimelineItemMeta]',
})
export class MlvTimelineItemMeta {
  /** The template reference for this meta slot. */
  readonly templateRef = inject(TemplateRef);
}
