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
import { MlvButton } from '@malva-ui/core/button';
import {
  LucideCalendar,
  LucideCommand,
  LucideFileText,
  LucideFolderOpen,
  LucideInbox,
  LucideLayoutDashboard,
  LucideMenu,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucideSettings,
  LucideUsers,
  LucideX,
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
    MlvButton,
    LucideCalendar,
    LucideCommand,
    LucideFileText,
    LucideFolderOpen,
    LucideInbox,
    LucideLayoutDashboard,
    LucideMenu,
    LucidePanelLeftClose,
    LucidePanelLeftOpen,
    LucideSettings,
    LucideUsers,
    LucideX,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class SidebarResponsiveExampleComponent {
  readonly collapsed = signal(false);
}
