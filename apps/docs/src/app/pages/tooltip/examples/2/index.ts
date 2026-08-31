import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-tooltip-placement-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTooltip, MlvButton],
  template: `
    <div class="demo-row" style="justify-content: center; padding: 2rem;">
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'Tooltip on top'"
        tooltipPlacement="top"
      >
        Top
      </button>
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'Tooltip on bottom'"
        tooltipPlacement="bottom"
      >
        Bottom
      </button>
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'Tooltip on left'"
        tooltipPlacement="left"
      >
        Left
      </button>
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'Tooltip on right'"
        tooltipPlacement="right"
      >
        Right
      </button>
    </div>
  `,
})
export default class TooltipPlacementExampleComponent {}
