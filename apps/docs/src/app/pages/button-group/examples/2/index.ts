import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvButton, MlvButtonGroup } from '@malva-ui/core/button';

@Component({
  selector: 'docs-button-group-override-example',
  imports: [MlvButton, MlvButtonGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonGroupOverrideExampleComponent {}
