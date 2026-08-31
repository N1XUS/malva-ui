import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvStatusIndicator } from '@malva-ui/core/status-indicator';

@Component({
  selector: 'docs-status-indicator-pulse-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvStatusIndicator],
  templateUrl: './index.html',
})
export default class StatusIndicatorPulseExampleComponent {}
