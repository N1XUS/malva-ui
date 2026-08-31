import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvChip } from '@malva-ui/core/chip';

@Component({
  selector: 'docs-chip-muted-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvChip],
  templateUrl: './index.html',
})
export default class ChipMutedExampleComponent {}
