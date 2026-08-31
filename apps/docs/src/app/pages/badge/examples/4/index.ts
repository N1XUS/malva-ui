import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvBadge } from '@malva-ui/core/badge';
import {
  LucideCheckCircle,
  LucideClock,
  LucideAlertTriangle,
  LucideXCircle,
  LucideBell,
  LucideTag,
} from '@lucide/angular';

@Component({
  selector: 'docs-badge-inline-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvBadge,
    LucideCheckCircle,
    LucideClock,
    LucideAlertTriangle,
    LucideXCircle,
    LucideBell,
    LucideTag,
  ],
  templateUrl: './index.html',
})
export default class BadgeInlineExampleComponent {}
