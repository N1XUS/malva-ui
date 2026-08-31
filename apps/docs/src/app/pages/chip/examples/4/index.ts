import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvChip, MlvChipPrepend, MlvChipAppend } from '@malva-ui/core/chip';
import {
  LucideTag,
  LucideZap,
  LucideArrowRight,
  LucideCircleCheck,
} from '@lucide/angular';
import { MlvAvatar } from '@malva-ui/core/avatar';

@Component({
  selector: 'docs-chip-slots-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvChip,
    MlvChipPrepend,
    MlvChipAppend,
    LucideTag,
    LucideZap,
    LucideArrowRight,
    LucideCircleCheck,
    MlvAvatar,
  ],
  templateUrl: './index.html',
})
export default class ChipSlotsExampleComponent {}
