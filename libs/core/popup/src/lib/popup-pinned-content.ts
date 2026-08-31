import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/**
 * Marks an `<ng-template>` as extra chrome pinned above the popup's scroll
 * region in every mode — never scrolls with the content.
 *
 * Generic and reusable: the popup stamps it directly above
 * `.mlv-popup__scrollbar` whether the panel is trigger-anchored or a
 * full-screen sheet (where it sits below the header), and no-ops when the slot
 * is absent. Consumers use it for chrome that must stay visible no matter how
 * far the content scrolls — e.g. `mlv-select` projects its in-dropdown search
 * field here so a long option list cannot push it out of view.
 */
@Directive({
  selector: '[mlvPopupPinnedContent]',
})
export class MlvPopupPinnedContent extends MlvStructural {}
