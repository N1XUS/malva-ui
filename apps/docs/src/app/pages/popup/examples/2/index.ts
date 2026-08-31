import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import type { MlvPopupPositionName } from '@malva-ui/core/popup';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-popup-positions-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPopup, MlvPopupContent, MlvPopupTrigger, MlvButton],
  templateUrl: './index.html',
})
export default class PopupPositionsExampleComponent {
  /** Currently selected named position shown in the popup. */
  readonly selectedPosition = signal<MlvPopupPositionName>('bottom');

  /** All 12 named positions available in the default POPUP_POSITION_MAP. */
  readonly positions: MlvPopupPositionName[] = [
    'top-start',
    'top',
    'top-end',
    'bottom-start',
    'bottom',
    'bottom-end',
    'left-start',
    'left',
    'left-end',
    'right-start',
    'right',
    'right-end',
  ];
}
