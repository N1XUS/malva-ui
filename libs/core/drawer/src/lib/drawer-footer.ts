import { Directive } from '@angular/core';

@Directive({
  selector: '[mlvDrawerFooter]',
  host: { class: 'mlv-drawer__footer' },
})
export class MlvDrawerFooter {}
