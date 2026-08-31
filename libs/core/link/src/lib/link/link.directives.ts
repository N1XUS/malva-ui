import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

@Directive({
  selector: '[mlvLinkBefore]',
})
export class MlvLinkBefore extends MlvStructural {}

@Directive({
  selector: '[mlvLinkAfter]',
})
export class MlvLinkAfter extends MlvStructural {}
