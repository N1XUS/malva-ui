import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

@Directive({
  selector: '[mlvButtonBefore]',
})
export class MlvButtonBefore extends MlvStructural {}

@Directive({
  selector: '[mlvButtonAfter]',
})
export class MlvButtonAfter extends MlvStructural {}

@Directive({
  selector: '[mlvButtonIcon]',
  host: {
    class: 'mlv-button__icon',
  },
})
export class MlvButtonIcon {}
