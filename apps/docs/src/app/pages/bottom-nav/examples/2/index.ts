import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvBottomNav } from '@malva-ui/core/bottom-nav';
import type { MlvNavItem } from '@malva-ui/cdk/utils';
import {
  provideLucideIcons,
  LucideHome,
  LucideSearch,
  LucideBell,
  LucideSettings,
  LucideUser,
  LucideCalendar,
  LucideEllipsis,
} from '@lucide/angular';

@Component({
  selector: 'docs-bottom-nav-overflow-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvBottomNav],
  providers: [
    provideLucideIcons(
      LucideHome,
      LucideSearch,
      LucideBell,
      LucideSettings,
      LucideUser,
      LucideCalendar,
      LucideEllipsis,
    ),
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class BottomNavOverflowExampleComponent {
  readonly items: MlvNavItem[] = [
    { icon: 'home', label: 'Home', route: '/' },
    { icon: 'search', label: 'Search', route: '/combobox' },
    { icon: 'bell', label: 'Alerts', route: '/notification' },
    { icon: 'calendar', label: 'Calendar', route: '/calendar' },
    { icon: 'user', label: 'Profile', route: '/avatar' },
    { icon: 'settings', label: 'Settings', route: '/sidebar' },
  ];
}
