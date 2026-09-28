import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/**
 * Structural directive responsible for rendering the card actions template at
 * the end of the header row. Pair it with `MlvCardActions` on the same
 * element: `<div *mlvCardActionsDef mlvCardActions>…</div>`.
 */
@Directive({
  selector: '[mlvCardActionsDef]',
})
export class MlvCardActionsDef extends MlvStructural {}

/**
 * Actions directive. Applies `mlv-card__actions` — a non-shrinking flex row
 * for the header's icon buttons.
 */
@Directive({
  selector: '[mlvCardActions]',
  host: {
    class: 'mlv-card__actions',
  },
})
export class MlvCardActions {}
