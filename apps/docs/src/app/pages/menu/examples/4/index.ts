import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvListItem, MlvListItemSuffix } from '@malva-ui/core/list';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import { MlvButton } from '@malva-ui/core/button';
import { MlvDivider } from '@malva-ui/core/divider';
import { LucideChevronRight, LucideSettings } from '@lucide/angular';

@Component({
  selector: 'docs-menu-submenu-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvListItem,
    MlvListItemSuffix,
    MlvSpacer,
    MlvButton,
    MlvDivider,
    LucideChevronRight,
    LucideSettings,
  ],
  template: `
    <div class="demo-row">
      <button mlvButton [mlvMenuTrigger]="rootMenu">
        <svg lucideSettings [size]="14" style="margin-right: 0.25rem" />
        Settings
      </button>
    </div>

    <!-- Root menu -->
    <mlv-menu #rootMenu label="Settings">
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Profile')"
        >Profile</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Notifications')"
        >Notifications</mlv-list-item
      >
      <mlv-divider muted />
      <!-- Submenu trigger — opens on hover with triangle pointer tracking -->
      <mlv-list-item
        mlvMenuItem
        [mlvMenuTrigger]="themeMenu"
        [isSubmenuTrigger]="true"
      >
        Appearance
        <mlv-spacer />
        <svg mlvListItemSuffix lucideChevronRight [size]="16" />
      </mlv-list-item>
      <mlv-divider muted />
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Sign Out')"
        >Sign Out</mlv-list-item
      >
    </mlv-menu>

    <!-- Nested submenu -->
    <mlv-menu #themeMenu label="Appearance">
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Light theme')"
        >Light</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Dark theme')"
        >Dark</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('System theme')"
        >System</mlv-list-item
      >
    </mlv-menu>

    @if (lastAction()) {
      <p style="margin-top: 1rem; color: var(--mlv-text-secondary);">
        Last action: <strong>{{ lastAction() }}</strong>
      </p>
    }
  `,
})
export default class MenuSubmenuExampleComponent {
  readonly lastAction = signal('');

  onAction(name: string): void {
    this.lastAction.set(name);
  }
}
