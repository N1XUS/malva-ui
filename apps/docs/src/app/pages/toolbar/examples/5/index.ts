import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvToolbar, MlvToolbarSpacer } from '@malva-ui/core/toolbar';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-toolbar-combined-example',
  imports: [MlvToolbar, MlvToolbarSpacer, MlvButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ToolbarCombinedExampleComponent {}
