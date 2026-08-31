import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvBottomNav } from '@malva-ui/core/bottom-nav';
import type { MlvNavItem } from '@malva-ui/cdk/utils';
import {
  provideLucideIcons,
  LucideHome,
  LucideSearch,
  LucideBell,
  LucideSettings,
} from '@lucide/angular';

@Component({
  selector: 'docs-bottom-nav-aria-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvBottomNav],
  providers: [
    provideLucideIcons(LucideHome, LucideSearch, LucideBell, LucideSettings),
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class BottomNavAriaExampleComponent {
  readonly items: MlvNavItem[] = [
    { icon: 'home', label: 'Home', route: '/' },
    { icon: 'search', label: 'Search', route: '/combobox' },
    { icon: 'bell', label: 'Alerts', route: '/notification' },
    { icon: 'settings', label: 'Settings', route: '/sidebar' },
  ];
}
