import { Directive } from '@angular/core';

@Directive({
  selector: '[mlvDrawerHeader]',
  host: { class: 'mlv-drawer__header' },
})
export class MlvDrawerHeader {}
