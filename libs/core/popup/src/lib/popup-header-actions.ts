import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/**
 * Marks an `<ng-template>` as a trailing action group in the popup's
 * full-screen mobile header, sitting between the title and the close button.
 *
 * Generic and reusable: the popup renders it only while
 * {@link MlvPopup.isFullscreen} is `true`, and no-ops when the slot is absent,
 * so an anchored popup is byte-identical whether or not one is supplied.
 * Consumers use it for a confirm action that belongs to the sheet chrome rather
 * than to the scrolling body — e.g. the pickers project a "Done" button here so
 * a full-screen calendar can commit a pending selection without a footer the
 * body would have to reserve space for.
 */
@Directive({
  selector: '[mlvPopupHeaderActions]',
})
export class MlvPopupHeaderActions extends MlvStructural {}
