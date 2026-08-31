import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvSidebar,
  MlvSidebarItem,
  MlvSidebarItemIcon,
  MlvSidebarHeader,
  SidebarContentDirective,
  MlvSidebarRail,
} from '@malva-ui/core/sidebar';
import {
  LucideChartColumn,
  LucideCommand,
  LucideCreditCard,
  LucideFolderOpen,
  LucideHouse,
  LucideInbox,
  LucideListTodo,
  LucideSettings,
  LucideUsers,
} from '@lucide/angular';

@Component({
  selector: 'docs-sidebar-resize-rail-example',
  imports: [
    MlvSidebar,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvSidebarHeader,
    SidebarContentDirective,
    MlvSidebarRail,
    LucideChartColumn,
    LucideCommand,
    LucideCreditCard,
    LucideFolderOpen,
    LucideHouse,
    LucideInbox,
    LucideListTodo,
    LucideSettings,
    LucideUsers,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class SidebarResizeRailExampleComponent {
  readonly collapsed = signal(false);
  sidebarWidth = '260px';
}
