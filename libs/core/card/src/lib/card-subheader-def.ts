import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/**
 * Structural directive responsible for rendering the card subheader template
 * below the header row. Pair it with `MlvCardSubheader` on the same element:
 * `<p *mlvCardSubheaderDef mlvCardSubheader>…</p>`.
 */
@Directive({
  selector: '[mlvCardSubheaderDef]',
})
export class MlvCardSubheaderDef extends MlvStructural {}

/**
 * Subheader directive. Applies `mlv-card__subheader` — secondary-colour text
 * that scales with the card `size`.
 */
@Directive({
  selector: '[mlvCardSubheader]',
  host: {
    class: 'mlv-card__subheader',
  },
})
export class MlvCardSubheader {}
