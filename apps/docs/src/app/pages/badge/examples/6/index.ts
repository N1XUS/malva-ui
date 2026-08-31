import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvBadge, MlvBadgeIcon } from '@malva-ui/core/badge';
import type { MlvDensity } from '@malva-ui/cdk/density';
import {
  LucideCheck,
  LucideCircleAlert,
  LucideClock,
  LucideGlobe,
} from '@lucide/angular';

@Component({
  selector: 'docs-badge-icon-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvBadge,
    MlvBadgeIcon,
    LucideCheck,
    LucideCircleAlert,
    LucideClock,
    LucideGlobe,
  ],
  templateUrl: './index.html',
})
export default class BadgeIconExampleComponent {
  /** Densities used to show that the icon tracks the badge font size. */
  readonly densities: readonly MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
  ];
}
