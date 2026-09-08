import { Directive } from '@angular/core';

/** Marks the global top-navigation element projected into `mlv-page-shell`. */
@Directive({
  selector: '[mlvPageTopbar]',
  host: { class: 'mlv-page-shell__topbar', 'data-slot': 'page-topbar' },
})
export class MlvPageTopbar {}

/** Marks the primary navigation sidebar projected into `mlv-page-shell`. */
@Directive({
  selector: '[mlvPageSidebar]',
  host: { class: 'mlv-page-shell__sidebar', 'data-slot': 'page-sidebar' },
})
export class MlvPageSidebar {}

/** Marks an optional second, trailing sidebar projected into `mlv-page-shell`. */
@Directive({
  selector: '[mlvPageEndSidebar]',
  host: {
    class: 'mlv-page-shell__sidebar mlv-page-shell__sidebar--end',
    'data-slot': 'page-end-sidebar',
  },
})
export class MlvPageEndSidebar {}
