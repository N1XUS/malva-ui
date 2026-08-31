import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvButton } from '@malva-ui/core/button';
import { MlvDivider } from '@malva-ui/core/divider';

@Component({
  selector: 'docs-menu-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvListItem,
    MlvButton,
    MlvDivider,
  ],
  template: `
    <div class="demo-row">
      <button mlvButton [mlvMenuTrigger]="basicMenu">Open Menu</button>
    </div>

    <mlv-menu #basicMenu label="Basic actions">
      <mlv-list-item mlvMenuItem (itemClick)="onAction('New')"
        >New File</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Open')"
        >Open</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Save')"
        >Save</mlv-list-item
      >
      <mlv-divider muted />
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Delete')"
        >Delete</mlv-list-item
      >
    </mlv-menu>

    @if (lastAction()) {
      <p style="margin-top: 1rem; color: var(--mlv-text-secondary);">
        Last action: <strong>{{ lastAction() }}</strong>
      </p>
    }
  `,
})
export default class MenuBasicExampleComponent {
  readonly lastAction = signal('');

  onAction(name: string): void {
    this.lastAction.set(name);
  }
}
