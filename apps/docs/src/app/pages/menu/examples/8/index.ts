import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  MlvContextMenuTrigger,
  MlvMenu,
  MlvMenuItem,
  MlvMenuTrigger,
} from '@malva-ui/core/menu';
import { MlvListItem, MlvListItemSuffix } from '@malva-ui/core/list';
import { MlvDivider } from '@malva-ui/core/divider';
import { LucideChevronRight } from '@lucide/angular';

@Component({
  selector: 'docs-menu-context-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvContextMenuTrigger,
    MlvListItem,
    MlvListItemSuffix,
    MlvDivider,
    LucideChevronRight,
  ],
  styleUrl: './index.scss',
  template: `
    <div class="context-demo" [mlvContextMenuTrigger]="pageMenu" global>
      <div
        class="context-demo__card"
        tabindex="0"
        [mlvContextMenuTrigger]="cardMenu"
      >
        <strong>Quarterly report.pdf</strong>
        <span>Right-click the card, or press Shift+F10</span>
      </div>

      <p class="context-demo__hint">
        Right-click anywhere in this region for the global menu.
      </p>
    </div>

    <mlv-menu #cardMenu label="File actions">
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Open')"
        >Open</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Rename')"
        >Rename</mlv-list-item
      >
      <mlv-list-item
        mlvMenuItem
        [mlvMenuTrigger]="shareMenu"
        [isSubmenuTrigger]="true"
      >
        Share
        <svg mlvListItemSuffix lucideChevronRight [size]="14"></svg>
      </mlv-list-item>
      <mlv-divider muted />
      <mlv-list-item mlvMenuItem disabled>Restore version</mlv-list-item>
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Delete')"
        >Delete</mlv-list-item
      >
    </mlv-menu>

    <mlv-menu #shareMenu label="Share with">
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Copy link')"
        >Copy link</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Email')"
        >Email</mlv-list-item
      >
    </mlv-menu>

    <mlv-menu #pageMenu label="Page actions">
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Reload')"
        >Reload</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Select all')"
        >Select all</mlv-list-item
      >
    </mlv-menu>

    @if (lastAction()) {
      <p class="context-demo__result">
        Last action: <strong>{{ lastAction() }}</strong>
      </p>
    }
  `,
})
export default class MenuContextExampleComponent {
  readonly lastAction = signal('');

  onAction(name: string): void {
    this.lastAction.set(name);
  }
}
