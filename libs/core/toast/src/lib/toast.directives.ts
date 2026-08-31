import { Directive } from '@angular/core';

@Directive({
  selector: '[mlvToastTitle]',
  host: { class: 'mlv-toast-item__title' },
})
/**
 * @description
 * Directive to mark the title of a toast item. This directive is used to
 * identify the title content in the toast item template.
 *
 * @example
 * ```html
 * <mlv-toast-item>
 *   <span mlvToastTitle>Toast Title</span>
 *   <span mlvToastDescription>Toast Description</span>
 * </mlv-toast-item>
 * ```
 */
export class MlvToastTitle {}

@Directive({
  selector: '[mlvToastDescription]',
  host: { class: 'mlv-toast-item__description' },
})
/**
 * @description
 * Directive to mark the description of a toast item. This directive is used to
 * identify the description content in the toast item template.
 *
 * @example
 * ```html
 * <mlv-toast-item>
 *   <span mlvToastTitle>Toast Title</span>
 *   <span mlvToastDescription>Toast Description</span>
 * </mlv-toast-item>
 * ```
 */
export class MlvToastDescription {}

@Directive({
  selector: '[mlvToastIcon]',
  host: { class: 'mlv-toast-item__icon' },
})
/**
 * @description
 * Directive to mark the icon of a toast item. This directive is used to
 * identify the icon content in the toast item template.
 *
 * @example
 * ```html
 * <mlv-toast-item>
 *   <svg mlvToastIcon lucideInfo />
 *   <span mlvToastTitle>Toast Title</span>
 *   <span mlvToastDescription>Toast Description</span>
 * </mlv-toast-item>
 * ```
 */
export class MlvToastIcon {}
