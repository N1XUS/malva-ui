import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvSidebar,
  MlvSidebarGroup,
  MlvSidebarItem,
  MlvSidebarItemIcon,
  MlvSidebarItemTitle,
  MlvSidebarHeader,
  MlvSidebarFooter,
  SidebarContentDirective,
} from '@malva-ui/core/sidebar';
import { MlvButton, MlvButtonBefore } from '@malva-ui/core/button';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import {
  LucideCalendar,
  LucideCircleHelp,
  LucideCommand,
  LucideFolderOpen,
  LucideGlobe,
  LucideInbox,
  LucideLayoutDashboard,
  LucideMail,
  LucideMenu,
  LucidePalette,
  LucideSettings,
  LucideSmartphone,
  LucideUser,
  LucideUsers,
} from '@lucide/angular';

@Component({
  selector: 'docs-sidebar-offcanvas-example',
  imports: [
    MlvSidebar,
    MlvSidebarGroup,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvSidebarItemTitle,
    MlvSidebarHeader,
    MlvSidebarFooter,
    SidebarContentDirective,
    MlvButton,
    MlvButtonBefore,
    MlvAvatar,
    MlvSpacer,
    LucideCalendar,
    LucideCircleHelp,
    LucideCommand,
    LucideFolderOpen,
    LucideGlobe,
    LucideInbox,
    LucideLayoutDashboard,
    LucideMail,
    LucideMenu,
    LucidePalette,
    LucideSettings,
    LucideSmartphone,
    LucideUser,
    LucideUsers,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class SidebarOffcanvasExampleComponent {
  readonly collapsed = signal(true);
}
