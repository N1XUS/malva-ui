import { Directive } from '@angular/core';

/** Marks a native table cell for Malva table spacing and responsive styles. */
@Directive({
  selector: '[mlvTableCell]',
  host: {
    class: 'mlv-table__cell',
  },
})
export class MlvTableCell {}
