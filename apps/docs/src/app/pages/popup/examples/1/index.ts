import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvButton, MlvButtonBefore } from '@malva-ui/core/button';
import { LucideUser, LucideSettings, LucideLogOut } from '@lucide/angular';
import { MlvAvatar, MlvColorFromTextPipe } from '@malva-ui/core/avatar';

@Component({
  selector: 'docs-popup-click-trigger-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvButton,
    MlvButtonBefore,
    LucideSettings,
    LucideLogOut,
    LucideUser,
    MlvAvatar,
    MlvColorFromTextPipe,
  ],
  templateUrl: './index.html',
})
export default class PopupClickTriggerExampleComponent {}
