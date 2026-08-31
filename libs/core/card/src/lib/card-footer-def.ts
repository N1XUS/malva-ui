import { Directive, input } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

@Directive({
  selector: '[mlvCardFooterDef]',
})
export class MlvCardFooterDef extends MlvStructural {}

@Directive({
  selector: '[mlvCardFooter]',
  host: {
    class: 'mlv-card__footer',
    '[class.mlv-card__footer--full-width]': 'fullWidth()',
    '[class.mlv-card__footer--border]': 'withBorder()',
  },
})
export class MlvCardFooter {
  readonly withBorder = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  readonly fullWidth = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
}
