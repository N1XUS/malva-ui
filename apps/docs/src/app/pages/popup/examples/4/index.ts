import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvButton, MlvButtonAfter } from '@malva-ui/core/button';
import { LucideChevronDown } from '@lucide/angular';

@Component({
  selector: 'docs-popup-fallback-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvButton,
    MlvButtonAfter,
    LucideChevronDown,
  ],
  templateUrl: './index.html',
})
export default class PopupFallbackExampleComponent {}
