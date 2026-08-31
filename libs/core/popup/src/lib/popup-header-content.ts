import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/**
 * Marks an `<ng-template>` as extra chrome rendered inside the popup's
 * full-screen mobile header, directly beneath the title/close row.
 *
 * Generic and reusable: the popup renders it only while
 * {@link MlvPopup.isFullscreen} is `true`, and no-ops when the slot is
 * absent or the popup is trigger-anchored. Consumers use it to move controls
 * that must stay reachable inside the full-screen sheet — e.g. `mlv-combobox`
 * projects an in-sheet search input here so type-to-filter keeps working when
 * the solid backdrop and focus trap would otherwise occlude/block the outer
 * trigger input.
 */
@Directive({
  selector: '[mlvPopupHeaderContent]',
})
export class MlvPopupHeaderContent extends MlvStructural {}
