import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  ViewEncapsulation,
} from '@angular/core';
import { MlvMenuGroupLabel } from './menu-group-label';

/**
 * Groups related menu items with an optional label inside a `mlv-menu`.
 *
 * Use `[mlvMenuGroupLabel]` on a child element to provide an accessible label
 * for the group. When present, the group's `role="group"` is named via
 * `aria-labelledby` pointing at the label element.
 *
 * @example
 * ```html
 * <mlv-menu-group>
 *   <span mlvMenuGroupLabel>File</span>
 *   <mlv-menu-item (itemClick)="onNew()">New</mlv-menu-item>
 *   <mlv-menu-item (itemClick)="onOpen()">Open</mlv-menu-item>
 * </mlv-menu-group>
 * ```
 */
@Component({
  selector: 'mlv-menu-group',
  template: `<ng-content />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-menu-group',
    role: 'group',
    '[attr.aria-labelledby]': '_label()?.id ?? null',
  },
})
export class MlvMenuGroup {
  /**
   * @protected Projected `[mlvMenuGroupLabel]` element, if any. Its generated
   * id names this group via `aria-labelledby`.
   */
  protected readonly _label = contentChild(MlvMenuGroupLabel);
}
