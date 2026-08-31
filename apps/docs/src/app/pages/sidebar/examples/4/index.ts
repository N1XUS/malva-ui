import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvSidebar,
  MlvSidebarItem,
  MlvSidebarItemIcon,
  MlvSidebarHeader,
  MlvSidebarFooter,
  SidebarContentDirective,
} from '@malva-ui/core/sidebar';
import { MlvSkeleton } from '@malva-ui/core/skeleton';
import { MlvButton } from '@malva-ui/core/button';
import { MlvAvatar } from '@malva-ui/core/avatar';
import {
  LucideChartArea,
  LucideCommand,
  LucideFolderOpen,
  LucideHouse,
  LucideSettings,
  LucideUsers,
} from '@lucide/angular';

@Component({
  selector: 'docs-sidebar-skeleton-example',
  imports: [
    MlvSidebar,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvSidebarHeader,
    MlvSidebarFooter,
    SidebarContentDirective,
    MlvSkeleton,
    MlvButton,
    MlvAvatar,
    LucideChartArea,
    LucideCommand,
    LucideFolderOpen,
    LucideHouse,
    LucideSettings,
    LucideUsers,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class SidebarSkeletonExampleComponent {
  readonly loading = signal(true);
  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7];

  toggleLoading(): void {
    this.loading.update((v) => !v);
  }
}
