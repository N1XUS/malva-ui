import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

@Directive({
  selector: '[mlvSelectListTemplate]',
})
export class MlvSelectListTemplate extends MlvStructural {}

@Directive({
  selector: '[mlvSelectItemTemplate]',
})
export class MlvSelectItemTemplate extends MlvStructural {}

@Directive({
  selector: '[mlvSelectSelectedTemplate]',
})
export class MlvSelectSelectedTemplate extends MlvStructural {}
