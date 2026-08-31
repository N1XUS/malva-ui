import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-button-status-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class ButtonStatusExampleComponent {}
