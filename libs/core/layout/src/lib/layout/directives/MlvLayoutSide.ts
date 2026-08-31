import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

@Directive({
  selector: '[mlvLayoutSide]',
})
export class MlvLayoutSide extends MlvStructural {}
