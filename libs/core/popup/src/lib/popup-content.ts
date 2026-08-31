import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

@Directive({
  selector: '[mlvPopupContent]',
})
export class MlvPopupContent extends MlvStructural {}
