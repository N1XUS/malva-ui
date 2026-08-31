import { Directive } from '@angular/core';

/** Marks the global top-navigation element projected into `mlv-page-shell`. */
@Directive({
  selector: '[mlvPageTopbar]',
  host: { class: 'mlv-page-shell__topbar' },
})
export class MlvPageTopbar {}

/** Marks the primary navigation sidebar projected into `mlv-page-shell`. */
@Directive({
  selector: '[mlvPageSidebar]',
  host: { class: 'mlv-page-shell__sidebar' },
})
export class MlvPageSidebar {}

/** Marks an optional second, trailing sidebar projected into `mlv-page-shell`. */
@Directive({
  selector: '[mlvPageEndSidebar]',
  host: {
    class: 'mlv-page-shell__sidebar mlv-page-shell__sidebar--end',
  },
})
export class MlvPageEndSidebar {}
