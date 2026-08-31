import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvAvatar } from '@malva-ui/core/avatar';
import {
  LucideBot,
  LucideUser,
  LucideUserRound,
  LucideUserCircle2,
} from '@lucide/angular';

@Component({
  selector: 'docs-avatar-icon-example',
  imports: [
    MlvAvatar,
    LucideBot,
    LucideUser,
    LucideUserRound,
    LucideUserCircle2,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class AvatarIconExampleComponent {}
