import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

@Directive({
  selector: '[mlvTileHeader]',
})
export class MlvTileHeader extends MlvStructural {}
