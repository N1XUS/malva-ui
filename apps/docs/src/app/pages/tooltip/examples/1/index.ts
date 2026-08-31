import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-tooltip-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTooltip, MlvButton],
  template: `
    <div class="demo-row">
      <button mlvButton [mlvTooltip]="'Save changes'">Save</button>
      <button mlvButton variant="secondary" [mlvTooltip]="'Cancel and go back'">
        Cancel
      </button>
      <button
        mlvButton
        variant="transparent"
        [mlvTooltip]="'More information about this action'"
      >
        Info
      </button>
    </div>
  `,
})
export default class TooltipBasicExampleComponent {}
