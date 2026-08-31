import { Directive } from '@angular/core';
import { mlvNextId } from '@malva-ui/cdk/utils';

/**
 * Marks an element as the label for a `mlv-menu-group`.
 * The group applies `aria-labelledby` pointing to this element's generated id.
 *
 * @example
 * ```html
 * <mlv-menu-group>
 *   <span mlvMenuGroupLabel>File actions</span>
 *   <mlv-menu-item>Open</mlv-menu-item>
 * </mlv-menu-group>
 * ```
 */
@Directive({
  selector: '[mlvMenuGroupLabel]',
  host: {
    class: 'mlv-menu-group__label',
    '[id]': 'id',
  },
})
export class MlvMenuGroupLabel {
  /**
   * Stable DOM id applied to the label element so the parent
   * `mlv-menu-group` can reference it via `aria-labelledby`.
   */
  readonly id = mlvNextId('mlv-menu-group-label');
}
