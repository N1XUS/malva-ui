import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvActionBar } from '@malva-ui/core/action-bar';

@Component({
  selector: 'docs-action-bar-basic-example',
  imports: [MlvActionBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ActionBarBasicExampleComponent {}
