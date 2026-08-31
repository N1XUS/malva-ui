import { Directive } from '@angular/core';

/**
 * Marks a sticky top region inside the sidebar.
 * Applied to a container element that should remain visible at the top when content scrolls.
 */
@Directive({
  selector: '[mlvSidebarHeader]',
  host: {
    class: 'mlv-sidebar__header',
  },
})
export class MlvSidebarHeader {}
