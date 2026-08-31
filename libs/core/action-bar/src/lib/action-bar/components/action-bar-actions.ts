import { Directive } from '@angular/core';

/**
 * Marks desktop-only action-bar content that is hidden at the medium
 * breakpoint and below.
 */
@Directive({
  selector: '[mlvActionBarActions]',
  host: {
    class: 'mlv-action-bar__actions',
  },
})
export class MlvActionBarActions {}
