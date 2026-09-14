import { Directive } from '@angular/core';
import { MlvPageChromeRegion } from '../page/page-region';

/** Leading dock content, typically pending-change status text. */
@Directive({
  selector: '[mlvPageDockStart]',
  host: { class: 'mlv-page-dock__start', 'data-slot': 'page-dock-start' },
})
export class MlvPageDockStart extends MlvPageChromeRegion {}

/** Centered dock content, typically a floating tool cluster. */
@Directive({
  selector: '[mlvPageDockCenter]',
  host: { class: 'mlv-page-dock__center', 'data-slot': 'page-dock-center' },
})
export class MlvPageDockCenter extends MlvPageChromeRegion {}

/** Trailing dock content, typically the primary workflow actions. */
@Directive({
  selector: '[mlvPageDockEnd]',
  host: { class: 'mlv-page-dock__end', 'data-slot': 'page-dock-end' },
})
export class MlvPageDockEnd extends MlvPageChromeRegion {}
