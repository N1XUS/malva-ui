import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { LucideMinus, LucidePlus } from '@lucide/angular';

@Component({
  selector: 'docs-button-sizes-example',
  imports: [MlvButton, LucidePlus, MlvButtonIcon, LucideMinus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonSizesExampleComponent {}
