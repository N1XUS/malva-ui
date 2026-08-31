import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

@Directive({
  selector: '[mlvDrawerContent]',
})
export class MlvDrawerContent extends MlvStructural {}
