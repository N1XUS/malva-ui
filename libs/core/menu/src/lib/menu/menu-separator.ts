import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';

/**
 * A visual separator between groups of menu items in a `mlv-menu`.
 *
 * Renders as a horizontal rule (`<hr role="separator">`) styled to match
 * `mlv-divider` visual design.
 *
 * @example
 * ```html
 * <mlv-menu-item (itemClick)="onEdit()">Edit</mlv-menu-item>
 * <mlv-menu-separator />
 * <mlv-menu-item (itemClick)="onDelete()">Delete</mlv-menu-item>
 * ```
 */
@Component({
  selector: 'mlv-menu-separator',
  template: `<hr
    class="mlv-menu-separator__line"
    role="separator"
    aria-orientation="horizontal"
  />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-menu-separator',
    role: 'presentation',
  },
})
export class MlvMenuSeparator {}
