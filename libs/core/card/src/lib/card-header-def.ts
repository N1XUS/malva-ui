import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/**
 * Structural directive responsible for rendering the card header template at
 * the start of the header row, beside the actions. Pair it with
 * `MlvCardHeader` on the same element:
 * `<h3 *mlvCardHeaderDef mlvCardHeader>…</h3>`. `<ng-template mlvCardHeader>`
 * on its own renders nothing — the card renders only a `…Def` slot.
 */
@Directive({
  selector: '[mlvCardHeaderDef]',
})
export class MlvCardHeaderDef extends MlvStructural {}

/**
 * Header directive. Applies `mlv-card__header` — a single-line title that
 * truncates with an ellipsis and scales with the card `size`.
 */
@Directive({
  selector: '[mlvCardHeader]',
  host: {
    class: 'mlv-card__header',
  },
})
export class MlvCardHeader {}
