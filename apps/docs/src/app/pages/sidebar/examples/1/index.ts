import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvSidebar,
  MlvSidebarGroup,
  MlvSidebarItem,
  MlvSidebarItemIcon,
  SidebarContentDirective,
  MlvSidebarTrigger,
} from '@malva-ui/core/sidebar';
import {
  LucideCalendar,
  LucideChartArea,
  LucideChartColumn,
  LucideChartPie,
  LucideCircleHelp,
  LucideFolderOpen,
  LucideGlobe,
  LucideHouse,
  LucideInbox,
  LucideMail,
  LucidePalette,
  LucideServer,
  LucideSettings,
  LucideShieldCheck,
  LucideSmartphone,
  LucideTrendingUp,
  LucideUser,
  LucideUsers,
} from '@lucide/angular';
import { MlvSpacer } from '@malva-ui/cdk/utils';

@Component({
  selector: 'docs-sidebar-basic-example',
  imports: [
    MlvSidebar,
    MlvSidebarGroup,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    SidebarContentDirective,
    MlvSidebarTrigger,
    MlvSpacer,
    LucideCalendar,
    LucideChartArea,
    LucideChartColumn,
    LucideChartPie,
    LucideCircleHelp,
    LucideFolderOpen,
    LucideGlobe,
    LucideHouse,
    LucideInbox,
    LucideMail,
    LucidePalette,
    LucideServer,
    LucideSettings,
    LucideShieldCheck,
    LucideSmartphone,
    LucideTrendingUp,
    LucideUser,
    LucideUsers,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class SidebarBasicExampleComponent {
  readonly collapsed = signal(false);
}
