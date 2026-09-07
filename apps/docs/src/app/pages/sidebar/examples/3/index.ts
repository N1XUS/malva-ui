import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvSidebar,
  MlvSidebarItem,
  MlvSidebarItemIcon,
  MlvSidebarHeader,
  SidebarContentDirective,
  MlvSidebarTrigger,
} from '@malva-ui/core/sidebar';
import { MlvDivider } from '@malva-ui/core/divider';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import {
  LucideArchive,
  LucideBriefcase,
  LucideClock,
  LucideFileText,
  LucideHeart,
  LucideInbox,
  LucideMail,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucidePlane,
  LucideReceipt,
  LucideSend,
  LucideShieldAlert,
  LucideStar,
  LucideTrash2,
} from '@lucide/angular';

@Component({
  selector: 'docs-sidebar-badges-dividers-example',
  imports: [
    MlvSidebar,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvSidebarHeader,
    SidebarContentDirective,
    MlvSidebarTrigger,
    MlvDivider,
    MlvSpacer,
    LucideArchive,
    LucideBriefcase,
    LucideClock,
    LucideFileText,
    LucideHeart,
    LucideInbox,
    LucideMail,
    LucidePanelLeftClose,
    LucidePanelLeftOpen,
    LucidePlane,
    LucideReceipt,
    LucideSend,
    LucideShieldAlert,
    LucideStar,
    LucideTrash2,
  ],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class SidebarBadgesDividersExampleComponent {
  readonly collapsed = signal(false);
}
