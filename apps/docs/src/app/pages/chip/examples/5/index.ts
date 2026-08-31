import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvChip, MlvChipPrepend } from '@malva-ui/core/chip';
import { LucideMapPin, LucideClock, LucideFlame } from '@lucide/angular';

@Component({
  selector: 'docs-chip-floating-density-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvChip, MlvChipPrepend, LucideMapPin, LucideClock, LucideFlame],
  templateUrl: './index.html',
})
export default class ChipFloatingDensityExampleComponent {}
