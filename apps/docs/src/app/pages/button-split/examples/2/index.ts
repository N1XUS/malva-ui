import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { MlvButtonVariant } from '@malva-ui/core/button';
import {
  MlvButton,
  MlvButtonIcon,
  MlvButtonSplit,
} from '@malva-ui/core/button';
import { LucideChevronDown } from '@lucide/angular';

@Component({
  selector: 'docs-button-split-variants-example',
  imports: [MlvButton, MlvButtonIcon, MlvButtonSplit, LucideChevronDown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonSplitVariantsExampleComponent {
  readonly variants: MlvButtonVariant[] = ['secondary', 'accent', 'outlined'];
}
