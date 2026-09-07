import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvSidebar,
  MlvSidebarItem,
  MlvSidebarItemIcon,
  MlvSidebarHeader,
  SidebarContentDirective,
  MlvSidebarTrigger,
} from '@malva-ui/core/sidebar';
import { MlvButton } from '@malva-ui/core/button';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import {
  LucideCalendar,
  LucideChartColumn,
  LucideCommand,
  LucideFolderOpen,
  LucideHouse,
  LucideInbox,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucideSettings,
  LucideTrendingUp,
  LucideUsers,
} from '@lucide/angular';

@Component({
  selector: 'docs-sidebar-floating-example',
  imports: [
    MlvSidebar,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvSidebarHeader,
    SidebarContentDirective,
    MlvSidebarTrigger,
    MlvButton,
    MlvSpacer,
    LucideCalendar,
    LucideChartColumn,
    LucideCommand,
    LucideFolderOpen,
    LucideHouse,
    LucideInbox,
    LucidePanelLeftClose,
    LucidePanelLeftOpen,
    LucideSettings,
    LucideTrendingUp,
    LucideUsers,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class SidebarFloatingExampleComponent {
  readonly collapsed = signal(false);
}
