import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvStatusIndicator } from '@malva-ui/core/status-indicator';
import { MlvAvatar } from '@malva-ui/core/avatar';

@Component({
  selector: 'docs-status-indicator-composed-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvStatusIndicator, MlvAvatar],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class StatusIndicatorComposedExampleComponent {}
