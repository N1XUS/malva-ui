import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';

/** Scrollable body region used by declarative and service-opened drawers. */
@Component({
  // Attribute-selector component intentionally enhances the consumer's body container.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[mlvDrawerBody]',
  template: `
    <mlv-scrollbar class="mlv-drawer__body-scrollbar">
      <ng-content />
    </mlv-scrollbar>
  `,
  imports: [MlvScrollbar],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-drawer__body' },
})
export class MlvDrawerBody {}

/** Backwards-compatible public name retained for existing imports. */
export { MlvDrawerBody as DrawerBodyDirective };
