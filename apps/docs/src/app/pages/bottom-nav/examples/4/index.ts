import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvBottomNav } from '@malva-ui/core/bottom-nav';
import type { MlvNavItem } from '@malva-ui/cdk/utils';
import type {
  MlvBottomNavStacking,
  MlvBottomNavLabelVisibility,
} from '@malva-ui/core/bottom-nav';
import {
  provideLucideIcons,
  LucideHome,
  LucideSearch,
  LucideBell,
  LucideSettings,
} from '@lucide/angular';

@Component({
  selector: 'docs-bottom-nav-stacking-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvBottomNav],
  providers: [
    provideLucideIcons(LucideHome, LucideSearch, LucideBell, LucideSettings),
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class BottomNavStackingExampleComponent {
  readonly items: MlvNavItem[] = [
    { icon: 'home', label: 'Home', route: '/' },
    { icon: 'search', label: 'Search', route: '/combobox' },
    { icon: 'bell', label: 'Alerts', route: '/notification' },
    { icon: 'settings', label: 'Settings', route: '/sidebar' },
  ];

  stacking: MlvBottomNavStacking = 'vertical';
  labelVisibility: MlvBottomNavLabelVisibility = 'always';

  toggleStacking(): void {
    this.stacking = this.stacking === 'vertical' ? 'horizontal' : 'vertical';
  }

  toggleLabelVisibility(): void {
    this.labelVisibility =
      this.labelVisibility === 'always' ? 'active-only' : 'always';
  }
}
