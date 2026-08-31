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
  MlvSidebarTrigger,
  MlvSidebarWorkspace,
  MlvSidebarWorkspaceLogo,
  MlvSidebarWorkspaceText,
  type MlvSidebarWorkspaceOption,
} from '@malva-ui/core/sidebar';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import {
  LucideBookOpen,
  LucideChartColumn,
  LucideCircleHelp,
  LucideCommand,
  LucideDatabase,
  LucideFileText,
  LucideFolderOpen,
  LucideLayoutDashboard,
  LucideListTodo,
  LucideMessageSquare,
  LucideNewspaper,
  LucideSearch,
  LucideSettings,
  LucideUsers,
} from '@lucide/angular';

@Component({
  selector: 'docs-sidebar-header-footer-example',
  imports: [
    MlvSidebar,
    MlvSidebarGroup,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvSidebarItemTitle,
    MlvSidebarHeader,
    MlvSidebarFooter,
    SidebarContentDirective,
    MlvSidebarTrigger,
    MlvSidebarWorkspace,
    MlvSidebarWorkspaceLogo,
    MlvSidebarWorkspaceText,
    MlvAvatar,
    MlvSpacer,
    LucideBookOpen,
    LucideChartColumn,
    LucideCircleHelp,
    LucideCommand,
    LucideDatabase,
    LucideFileText,
    LucideFolderOpen,
    LucideLayoutDashboard,
    LucideListTodo,
    LucideMessageSquare,
    LucideNewspaper,
    LucideSearch,
    LucideSettings,
    LucideUsers,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class SidebarHeaderFooterExampleComponent {
  readonly collapsed = signal(false);

  readonly workspaces: readonly MlvSidebarWorkspaceOption[] = [
    { id: 'acme', label: 'Acme Inc', description: 'Enterprise' },
    { id: 'northstar', label: 'Northstar', description: 'Product' },
    { id: 'paper', label: 'Paper Studio', description: 'Creative' },
  ];

  readonly workspace = signal<MlvSidebarWorkspaceOption>(this.workspaces[0]);
}
