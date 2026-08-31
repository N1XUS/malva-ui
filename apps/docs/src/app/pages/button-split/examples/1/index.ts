import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  MlvButton,
  MlvButtonIcon,
  MlvButtonSplit,
} from '@malva-ui/core/button';
import { LucideChevronDown } from '@lucide/angular';

@Component({
  selector: 'docs-button-split-basic-example',
  imports: [MlvButton, MlvButtonIcon, MlvButtonSplit, LucideChevronDown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonSplitBasicExampleComponent {}
