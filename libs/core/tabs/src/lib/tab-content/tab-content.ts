import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';

/**
 * Wrapper for the active panel content. `role="tabpanel"`, the panel `id` and
 * `aria-labelledby` (panel → tab) are supplied by the `@angular/aria`
 * `ngTabPanel` directive applied on this element by the parent
 * `mlv-tab-group`; this component only owns the panel styling/animation slot.
 */
@Component({
  selector: 'mlv-tab-content',
  template: `<ng-content />`,
  styleUrl: './tab-content.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-tab-content',
  },
})
export class MlvTabContent {}
