import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

@Directive({
  selector: '[mlvCardActionsDef]',
})
export class MlvCardActionsDef extends MlvStructural {}

@Directive({
  selector: '[mlvCardActions]',
  host: {
    class: 'mlv-card__actions',
  },
})
export class MlvCardActions {}
