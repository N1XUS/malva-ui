import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvToolbar,
  MlvToolbarSpacer,
  MlvToolbarRoving,
  MlvToolbarWidget,
} from '@malva-ui/core/toolbar';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-toolbar-roving-example',
  imports: [
    MlvToolbar,
    MlvToolbarSpacer,
    MlvToolbarRoving,
    MlvToolbarWidget,
    MlvButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ToolbarRovingExampleComponent {}
