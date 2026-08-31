import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

@Directive({
  selector: '[mlvTabContent]',
})
export class MlvTabContentDef extends MlvStructural {}
