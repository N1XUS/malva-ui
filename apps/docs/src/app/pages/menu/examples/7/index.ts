import { ChangeDetectionStrategy, Component } from '@angular/core';
import { timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import { MlvListItem, MlvListItemSuffix } from '@malva-ui/core/list';
import { MlvMenubar, MlvMenuItem, MlvMenuItemDef } from '@malva-ui/core/menu';
import type { MlvMenuItemData, MlvMenubarEntry } from '@malva-ui/core/menu';
import { LucideChevronRight } from '@lucide/angular';

type NavigationItem = MlvMenuItemData<undefined>;

const SETTINGS_ITEMS: NavigationItem[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'team', label: 'Team settings' },
];

@Component({
  selector: 'docs-menu-reactive-menubar-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvMenubar,
    MlvMenuItem,
    MlvMenuItemDef,
    MlvListItem,
    MlvListItemSuffix,
    MlvSpacer,
    LucideChevronRight,
  ],
  template: `
    <mlv-menubar aria-label="Workspace" [dataSource]="items">
      <ng-template mlvMenuItemDef let-item let-hasChildren="hasChildren">
        <mlv-list-item mlvMenuItem>
          {{ item.label }}
          @if (hasChildren) {
            <mlv-spacer />
            <svg mlvListItemSuffix lucideChevronRight [size]="16" />
          }
        </mlv-list-item>
      </ng-template>
    </mlv-menubar>
  `,
})
export default class MenuReactiveMenubarExampleComponent {
  readonly items: MlvMenubarEntry<NavigationItem>[] = [
    {
      id: 'file',
      label: 'File',
      children: timer(500).pipe(
        map(() => [
          { id: 'new', label: 'New file' },
          { id: 'open', label: 'Open file' },
        ]),
      ),
    },
    { kind: 'divider', id: 'workspace-divider' },
    {
      id: 'settings',
      label: 'Settings',
      children: timer(700).pipe(map(() => SETTINGS_ITEMS)),
    },
  ];
}
