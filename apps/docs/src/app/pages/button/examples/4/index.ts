import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-button-disabled-example',
  imports: [MlvButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonDisabledExampleComponent {}
