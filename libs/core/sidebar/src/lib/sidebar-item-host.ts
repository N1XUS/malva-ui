import { Directive, input } from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MlvStructural } from '@malva-ui/cdk/utils';

@Directive({
  selector: '[mlvSidebarItem]',
  host: {
    class: 'mlv-sidebar-item',
    '[class.mlv-sidebar-item--active]': 'active()',
    role: 'treeitem',
    '[attr.aria-selected]': 'active()',
    tabindex: '0',
  },
})
export class MlvSidebarItemHost {
  /** Whether the item is the currently active navigation target. */
  readonly active = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
}

@Directive({
  selector: '[mlvSidebarItemTitle]',
})
export class MlvSidebarItemTitle extends MlvStructural {
  /**
   * Optional active state on the directive (available but not currently
   * consumed by `MlvSidebarItem`).
   */
  readonly active = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
}
