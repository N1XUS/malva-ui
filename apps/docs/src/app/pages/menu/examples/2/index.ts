import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvMenu,
  MlvMenuItem,
  MlvMenuGroup,
  MlvMenuGroupLabel,
  MlvMenuTrigger,
} from '@malva-ui/core/menu';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvButton } from '@malva-ui/core/button';
import { MlvDivider } from '@malva-ui/core/divider';

@Component({
  selector: 'docs-menu-groups-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvMenu,
    MlvMenuItem,
    MlvMenuGroup,
    MlvMenuGroupLabel,
    MlvMenuTrigger,
    MlvListItem,
    MlvButton,
    MlvDivider,
  ],
  template: `
    <div class="demo-row">
      <button mlvButton variant="secondary" [mlvMenuTrigger]="groupMenu">
        File Menu
      </button>
    </div>

    <mlv-menu #groupMenu>
      <mlv-menu-group>
        <span mlvMenuGroupLabel>File</span>
        <mlv-list-item mlvMenuItem>New</mlv-list-item>
        <mlv-list-item mlvMenuItem>Open</mlv-list-item>
        <mlv-list-item mlvMenuItem>Save</mlv-list-item>
        <mlv-list-item mlvMenuItem>Save As…</mlv-list-item>
      </mlv-menu-group>
      <mlv-divider muted />
      <mlv-menu-group>
        <span mlvMenuGroupLabel>Export</span>
        <mlv-list-item mlvMenuItem>Export as PDF</mlv-list-item>
        <mlv-list-item mlvMenuItem>Export as CSV</mlv-list-item>
      </mlv-menu-group>
      <mlv-divider muted />
      <mlv-list-item mlvMenuItem disabled>Print (unavailable)</mlv-list-item>
    </mlv-menu>
  `,
})
export default class MenuGroupsExampleComponent {}
