import { Directive } from '@angular/core';

/** Marks leading dock content, typically pending-change status text. */
@Directive({
  selector: '[mlvPageDockStart]',
  host: { class: 'mlv-page-dock__start' },
})
export class MlvPageDockStart {}

/** Marks the centered dock content, typically a floating tool cluster. */
@Directive({
  selector: '[mlvPageDockCenter]',
  host: { class: 'mlv-page-dock__center' },
})
export class MlvPageDockCenter {}

/** Marks trailing dock content, typically the primary workflow actions. */
@Directive({
  selector: '[mlvPageDockEnd]',
  host: { class: 'mlv-page-dock__end' },
})
export class MlvPageDockEnd {}
