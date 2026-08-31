import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import {
  LucideInfo,
  LucideCircleAlert,
  LucideShieldCheck,
} from '@lucide/angular';

@Component({
  selector: 'docs-popup-focus-trigger-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvButton,
    LucideInfo,
    LucideCircleAlert,
    LucideShieldCheck,
    MlvButtonIcon,
  ],
  templateUrl: './index.html',
})
export default class PopupFocusTriggerExampleComponent {}
