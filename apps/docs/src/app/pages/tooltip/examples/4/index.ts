import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MlvButton, MlvButtonBefore } from '@malva-ui/core/button';
import { LucideTrash2 } from '@lucide/angular';

@Component({
  selector: 'docs-tooltip-advanced-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTooltip, MlvButton, MlvButtonBefore, LucideTrash2],
  template: `
    <div class="demo-row" style="align-items: center;">
      <!-- Accessibility: icon-only button with tooltip as accessible label -->
      <button
        mlvButton
        variant="transparent"
        shape="circle"
        aria-label="Delete item"
        [mlvTooltip]="'Delete item'"
        tooltipPlacement="top"
        tooltipTone="danger"
      >
        <ng-template mlvButtonBefore
          ><svg lucideTrash2 [size]="16"
        /></ng-template>
      </button>

      <!-- Delayed tooltip (500ms) -->
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'This tooltip appears after 500 ms'"
        [tooltipDelay]="500"
      >
        500 ms delay
      </button>

      <!-- No arrow -->
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'Arrow hidden'"
        [tooltipArrow]="false"
        tooltipPlacement="bottom"
      >
        No arrow
      </button>

      <!-- Disabled tooltip -->
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'You will not see this'"
        [tooltipDisabled]="true"
      >
        Disabled tooltip
      </button>
    </div>
  `,
})
export default class TooltipAdvancedExampleComponent {}
