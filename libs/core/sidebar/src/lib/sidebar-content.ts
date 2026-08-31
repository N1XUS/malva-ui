import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';

/**
 * Marks the scrollable middle region between header and footer inside the sidebar.
 * Gets `flex: 1 1 0` so it fills the remaining space. Intended to hold sidebar items and groups.
 */
@Component({
  // Attribute-selector component intentionally enhances the consumer's content container.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[mlvSidebarContent]',
  template: `
    <mlv-scrollbar class="mlv-sidebar__content-scrollbar">
      <ng-content />
    </mlv-scrollbar>
  `,
  imports: [MlvScrollbar],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-sidebar__content',
  },
})
export class MlvSidebarContent {}

/** Backwards-compatible public name retained for existing imports. */
export { MlvSidebarContent as SidebarContentDirective };
