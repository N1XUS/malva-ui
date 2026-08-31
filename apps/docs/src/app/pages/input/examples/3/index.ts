import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvInput } from '@malva-ui/core/input';

@Component({
  selector: 'docs-input-disabled-example',
  imports: [MlvInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class InputDisabledExampleComponent {}
