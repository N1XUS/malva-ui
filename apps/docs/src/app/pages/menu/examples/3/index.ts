import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvListItem, MlvListItemPrefix } from '@malva-ui/core/list';
import { MlvButton } from '@malva-ui/core/button';
import { MlvDivider } from '@malva-ui/core/divider';
import {
  LucideEdit3,
  LucideTrash2,
  LucideCopy,
  LucideShare2,
  LucideMoreHorizontal,
} from '@lucide/angular';

@Component({
  selector: 'docs-menu-with-icons-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvListItem,
    MlvListItemPrefix,
    MlvButton,
    MlvDivider,
    LucideEdit3,
    LucideCopy,
    LucideShare2,
    LucideTrash2,
    LucideMoreHorizontal,
  ],
  template: `
    <div class="demo-row">
      <button
        mlvButton
        variant="transparent"
        [mlvMenuTrigger]="iconMenu"
        aria-label="More actions"
      >
        <svg lucideMoreHorizontal [size]="18" />
      </button>
    </div>

    <mlv-menu #iconMenu label="Item actions">
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Edit')">
        <svg mlvListItemPrefix lucideEdit3 [size]="14" />
        Edit
      </mlv-list-item>
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Copy')">
        <svg mlvListItemPrefix lucideCopy [size]="14" />
        Duplicate
      </mlv-list-item>
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Share')">
        <svg mlvListItemPrefix lucideShare2 [size]="14" />
        Share
      </mlv-list-item>
      <mlv-divider muted />
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Delete')">
        <svg mlvListItemPrefix lucideTrash2 [size]="14" />
        Delete
      </mlv-list-item>
    </mlv-menu>

    @if (lastAction()) {
      <p style="margin-top: 1rem; color: var(--mlv-text-secondary);">
        Last action: <strong>{{ lastAction() }}</strong>
      </p>
    }
  `,
})
export default class MenuWithIconsExampleComponent {
  readonly lastAction = signal('');

  onAction(name: string): void {
    this.lastAction.set(name);
  }
}
