import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/**
 * Structural directive responsible for rendering the card subheader template.
 */
@Directive({
  selector: '[mlvCardSubheaderDef]',
})
export class MlvCardSubheaderDef extends MlvStructural {}

/**
 * Subheader directive. Used to apply correct classes to the element.
 */
@Directive({
  selector: '[mlvCardSubheader]',
  host: {
    class: 'mlv-card__subheader',
  },
})
export class MlvCardSubheader {}
