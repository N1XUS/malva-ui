import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

@Directive({
  selector: '[mlvCardHeaderDef]',
})
export class MlvCardHeaderDef extends MlvStructural {}

@Directive({
  selector: '[mlvCardHeader]',
  host: {
    class: 'mlv-card__header',
  },
})
export class MlvCardHeader {}
