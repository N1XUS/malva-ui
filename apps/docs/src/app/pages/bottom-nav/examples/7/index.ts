import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
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
  selector: 'docs-bottom-nav-disabled-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvBottomNav],
  providers: [
    provideLucideIcons(LucideHome, LucideSearch, LucideBell, LucideSettings),
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class BottomNavDisabledExampleComponent {
  readonly items: MlvNavItem[] = [
    { icon: 'home', label: 'Home', route: '' },
    { icon: 'search', label: 'Search', route: '' },
    { icon: 'bell', label: 'Alerts', route: '', disabled: true },
    { icon: 'settings', label: 'Settings', route: '' },
  ];

  readonly activeIndex = signal(0);

  onItemClick(index: number): void {
    this.activeIndex.set(index);
  }
}
