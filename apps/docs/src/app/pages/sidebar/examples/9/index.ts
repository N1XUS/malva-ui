import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvSidebar,
  MlvSidebarGroup,
  MlvSidebarHeader,
  MlvSidebarItem,
  MlvSidebarItemIcon,
  MlvSidebarTrigger,
  SidebarContentDirective,
} from '@malva-ui/core/sidebar';
import {
  LucideCalendar,
  LucideCommand,
  LucideFileText,
  LucideFolderOpen,
  LucideInbox,
  LucideLayoutDashboard,
  LucideSettings,
  LucideUsers,
} from '@lucide/angular';

@Component({
  selector: 'docs-sidebar-responsive-example',
  imports: [
    MlvSidebar,
    MlvSidebarGroup,
    MlvSidebarHeader,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvSidebarTrigger,
    SidebarContentDirective,
    LucideCalendar,
    LucideCommand,
    LucideFileText,
    LucideFolderOpen,
    LucideInbox,
    LucideLayoutDashboard,
    LucideSettings,
    LucideUsers,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class SidebarResponsiveExampleComponent {
  readonly collapsed = signal(false);
}
