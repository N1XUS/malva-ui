import { Directive, input } from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

/** Marks a native table row as the primary or supporting Pop In row. */
@Directive({
  selector: 'tr[mlvTableRow]',
  host: {
    class: 'mlv-table__row',
    '[class.mlv-table__row--main]': 'main()',
    '[class.mlv-table__row--secondary]': 'secondary()',
    '[attr.data-mlv-table-row]':
      'main() ? "main" : secondary() ? "secondary" : null',
  },
})
export class MlvTableRow {
  /** Identifies the row that carries the primary, interactive information. */
  readonly main = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Identifies the row that carries supporting, display-only information. */
  readonly secondary = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
}
