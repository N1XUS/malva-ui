import { Directive, input } from '@angular/core';
import type { MlvPageEndPane } from './page-end-pane';

/** Native-button trigger that toggles and describes a Page end pane. */
@Directive({
  selector: 'button[mlvPageEndPaneTrigger]',
  host: {
    '(click)': 'mlvPageEndPaneTrigger().toggle()',
    '[attr.aria-expanded]': 'mlvPageEndPaneTrigger().opened()',
    '[attr.aria-controls]': 'mlvPageEndPaneTrigger().panelId',
  },
})
export class MlvPageEndPaneTrigger {
  /** Page end pane controlled by this native button. */
  readonly mlvPageEndPaneTrigger = input.required<MlvPageEndPane>();
}
