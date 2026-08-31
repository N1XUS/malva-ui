import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCheckbox } from '@malva-ui/core/checkbox';

@Component({
  selector: 'docs-popup-fullscreen-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPopup, MlvPopupContent, MlvPopupTrigger, MlvButton, MlvCheckbox],
  templateUrl: './index.html',
})
export default class PopupFullscreenExampleComponent {}
