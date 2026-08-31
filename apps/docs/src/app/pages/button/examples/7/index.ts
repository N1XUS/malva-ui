import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvButtonAfter,
  MlvButtonBefore,
  MlvButtonIcon,
} from '@malva-ui/core/button';
import { MlvButton } from '@malva-ui/core/button';
import { LucideChevronDown } from '@lucide/angular';
import { MlvFade } from '@malva-ui/cdk';
import { MlvAvatar } from '@malva-ui/core/avatar';

@Component({
  selector: 'docs-button-fade-example',
  imports: [
    MlvButton,
    MlvFade,
    MlvFade,
    MlvButtonIcon,
    MlvButtonBefore,
    MlvButtonAfter,
    MlvAvatar,
    LucideChevronDown,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonFadeExampleComponent {}
