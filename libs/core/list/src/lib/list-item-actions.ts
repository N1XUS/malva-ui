import { Directive, input } from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

@Directive({
  selector: '[mlvListItemActions]',
  host: {
    '(click)': '$event.stopPropagation()',
  },
})
export class MlvListItemActions {
  /**
   * When true, the actions wrapper is hidden by default and revealed on row
   * hover, focus-within, or touch devices. Lets rows stay visually calm until
   * the user signals intent to interact.
   */
  readonly revealOnHover = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
}
