import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvPopupScrollStrategy } from '@malva-ui/core/popup';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvButton } from '@malva-ui/core/button';

interface StrategyDemo {
  label: string;
  strategy: MlvPopupScrollStrategy;
  description: string;
}

@Component({
  selector: 'docs-popup-scroll-strategy-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPopup, MlvPopupContent, MlvPopupTrigger, MlvButton],
  templateUrl: './index.html',
})
export default class PopupScrollStrategyExampleComponent {
  readonly strategies: StrategyDemo[] = [
    {
      label: 'Reposition',
      strategy: 'reposition',
      description: 'Popup follows the trigger while scrolling.',
    },
    {
      label: 'Close on scroll',
      strategy: 'close',
      description: 'Popup closes as soon as you start scrolling.',
    },
    {
      label: 'No-op',
      strategy: 'noop',
      description: 'Popup stays fixed at its opening position.',
    },
  ];
}
