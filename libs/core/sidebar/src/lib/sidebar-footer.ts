import { Directive } from '@angular/core';

/**
 * Marks a sticky bottom region inside the sidebar.
 * Applied to a container element that should remain visible at the bottom when content scrolls.
 */
@Directive({
  selector: '[mlvSidebarFooter]',
  host: {
    class: 'mlv-sidebar__footer',
  },
})
export class MlvSidebarFooter {}
