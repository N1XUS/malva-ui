import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-tooltip-tones-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTooltip, MlvButton],
  template: `
    <div class="demo-row" style="flex-wrap: wrap;">
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'Neutral tooltip (default)'"
        tooltipTone="neutral"
      >
        Neutral
      </button>
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'Surface tooltip'"
        tooltipTone="surface"
      >
        Surface
      </button>
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'Primary color tooltip'"
        tooltipTone="primary"
      >
        Primary
      </button>
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'Success — action completed'"
        tooltipTone="success"
      >
        Success
      </button>
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'Warning — proceed with caution'"
        tooltipTone="warning"
      >
        Warning
      </button>
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'Danger — destructive action'"
        tooltipTone="danger"
      >
        Danger
      </button>
      <button
        mlvButton
        variant="secondary"
        [mlvTooltip]="'Info — additional context'"
        tooltipTone="info"
      >
        Info
      </button>
    </div>
  `,
})
export default class TooltipTonesExampleComponent {}
