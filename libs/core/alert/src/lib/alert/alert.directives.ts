import { Directive, inject, TemplateRef } from '@angular/core';

/**
 * Slot directive for projecting a custom icon into the alert's icon area.
 *
 * Place inside an `<ng-template>` inside `<mlv-alert>` to override the
 * default tone icon with custom content.
 *
 * @example
 * ```html
 * <mlv-alert tone="info">
 *   <ng-template mlvAlertIcon>
 *     <svg lucideInfo [size]="16" />
 *   </ng-template>
 *   Your session will expire soon.
 * </mlv-alert>
 * ```
 */
@Directive({ selector: '[mlvAlertIcon]' })
export class MlvAlertIcon {
  /** The template reference for this icon slot. */
  readonly templateRef = inject(TemplateRef);
}

/**
 * Slot directive for projecting a custom title into the alert's title area.
 *
 * Place inside an `<ng-template>` inside `<mlv-alert>` to provide a structured
 * title line above the main description content.
 *
 * @example
 * ```html
 * <mlv-alert tone="warning">
 *   <ng-template mlvAlertTitle>Storage nearly full</ng-template>
 *   You have used 90% of your storage quota.
 * </mlv-alert>
 * ```
 */
@Directive({ selector: '[mlvAlertTitle]' })
export class MlvAlertTitle {
  /** The template reference for this title slot. */
  readonly templateRef = inject(TemplateRef);
}
