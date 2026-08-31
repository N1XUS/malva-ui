import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

@Directive({
  selector: '[mlvComboboxItemDef]',
})
export class MlvComboboxItemDef extends MlvStructural {}

@Directive({
  selector: '[mlvComboboxSelectedItemDef]',
})
export class MlvComboboxSelectedItemDef extends MlvStructural {}
