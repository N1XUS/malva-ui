import { Directive, inject, TemplateRef } from '@angular/core';

/**
 * Slot directive for the icon or avatar displayed inside the timeline item node.
 *
 * Use with `<ng-template mlvTimelineItemIcon>` inside a `mlv-timeline-item` element.
 * When provided, the projected content replaces the default circle node indicator.
 *
 * @example
 * ```html
 * <mlv-timeline-item title="Deployed">
 *   <ng-template mlvTimelineItemIcon>
 *     <svg lucideRocket [size]="16" />
 *   </ng-template>
 *   Deployment completed successfully.
 * </mlv-timeline-item>
 * ```
 */
@Directive({
  selector: '[mlvTimelineItemIcon]',
})
export class MlvTimelineItemIcon {
  /** The template reference for this icon slot. */
  readonly templateRef = inject(TemplateRef);
}
