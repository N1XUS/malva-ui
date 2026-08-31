import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvIconToggle } from '@malva-ui/core/icon-toggle';
import { LucideStar } from '@lucide/angular';

@Component({
  selector: 'docs-icon-toggle-disabled-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvIconToggle, LucideStar],
  templateUrl: './index.html',
})
export default class IconToggleDisabledExampleComponent {}
