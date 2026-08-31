import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  MlvMenubar,
  MlvMenu,
  MlvMenuItem,
  MlvMenuTrigger,
} from '@malva-ui/core/menu';
import { MlvListItem, MlvListItemSuffix } from '@malva-ui/core/list';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import { MlvButton } from '@malva-ui/core/button';
import { MlvDivider } from '@malva-ui/core/divider';
import { LucideChevronRight } from '@lucide/angular';

@Component({
  selector: 'docs-menu-menubar-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvMenubar,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvListItem,
    MlvListItemSuffix,
    MlvSpacer,
    MlvButton,
    MlvDivider,
    LucideChevronRight,
  ],
  template: `
    <div class="demo-row">
      <mlv-menubar aria-label="Application">
        <button mlvButton variant="transparent" [mlvMenuTrigger]="fileMenu">
          File
        </button>
        <button mlvButton variant="transparent" [mlvMenuTrigger]="editMenu">
          Edit
        </button>
        <button mlvButton variant="transparent" [mlvMenuTrigger]="viewMenu">
          View
        </button>
      </mlv-menubar>
    </div>

    <!-- Menu panels are declared as siblings of the menubar so its
         contentChildren query only picks up the three top-level triggers. -->
    <mlv-menu #fileMenu label="File">
      <mlv-list-item mlvMenuItem (itemClick)="onAction('New File')"
        >New File</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Open…')"
        >Open…</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Save')"
        >Save</mlv-list-item
      >
      <mlv-divider muted />
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Close Window')"
        >Close Window</mlv-list-item
      >
    </mlv-menu>

    <mlv-menu #editMenu label="Edit">
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Undo')"
        >Undo</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Redo')"
        >Redo</mlv-list-item
      >
      <mlv-divider muted />
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Cut')"
        >Cut</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Copy')"
        >Copy</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Paste')"
        >Paste</mlv-list-item
      >
    </mlv-menu>

    <mlv-menu #viewMenu label="View">
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Zoom In')"
        >Zoom In</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Zoom Out')"
        >Zoom Out</mlv-list-item
      >
      <mlv-divider muted />
      <mlv-list-item
        mlvMenuItem
        [mlvMenuTrigger]="appearanceMenu"
        [isSubmenuTrigger]="true"
      >
        Appearance
        <mlv-spacer />
        <svg mlvListItemSuffix lucideChevronRight [size]="16"></svg>
      </mlv-list-item>
    </mlv-menu>

    <mlv-menu #appearanceMenu label="Appearance">
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Light Theme')"
        >Light</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('Dark Theme')"
        >Dark</mlv-list-item
      >
      <mlv-list-item mlvMenuItem (itemClick)="onAction('System Theme')"
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
export default class MenuMenubarExampleComponent {
  readonly lastAction = signal('');

  onAction(name: string): void {
    this.lastAction.set(name);
  }
}
