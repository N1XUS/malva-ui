import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvToolbar } from '@malva-ui/core/toolbar';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-toolbar-equal-size-example',
  imports: [MlvToolbar, MlvButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ToolbarEqualSizeExampleComponent {}
